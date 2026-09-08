#!/usr/bin/env python3
"""Render Constellore Voyage frames from an authoritative offline plan.

This script runs inside Blender 5.1. Review output is deliberately non-shipping.
Production mode writes storage-efficient multilayer EXR and requires an explicit
OCIO configuration; it still does not constitute grading or creative approval.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
THREE_TO_BLENDER = Matrix(((1.0, 0.0, 0.0), (0.0, 0.0, -1.0), (0.0, 1.0, 0.0)))
LOOKDEV_MANIFEST_PATH = "production/voyage-projection/lookdev/lookdev-manifest.json"
LOOKDEV_PLATE_IDS = (
    "far-field-nebula",
    "warp-caustics",
    "singularity-corona",
    "beyond-color-field",
)


def parse_arguments() -> argparse.Namespace:
    raw = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--mode", choices=("smoke", "review", "production"), default="smoke")
    parser.add_argument("--frames", default="")
    parser.add_argument("--width", type=int, default=960)
    parser.add_argument("--height", type=int, default=540)
    parser.add_argument("--samples", type=int, default=16)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--save-blend", default="")
    parser.add_argument("--lookdev-plates", action="store_true")
    return parser.parse_args(raw)


def bounded(root: Path, declared: str) -> Path:
    candidate = (root / declared).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError as error:
        raise RuntimeError(f"Path escapes project root: {declared}") from error
    return candidate


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def to_blender(values) -> Vector:
    x, y, z = (float(value) for value in values)
    return Vector((x, -z, y))


def converted_rotation(values):
    source = Euler(tuple(float(value) for value in values), "XYZ").to_matrix()
    return (THREE_TO_BLENDER @ source @ THREE_TO_BLENDER.transposed()).to_quaternion()


def set_tree_visibility(root, visible: bool):
    for obj in (root, *root.children_recursive):
        obj.hide_render = not visible
        obj.hide_viewport = not visible


def hex_color(value: int, alpha: float = 1.0):
    value = int(value)
    return (
        ((value >> 16) & 255) / 255.0,
        ((value >> 8) & 255) / 255.0,
        (value & 255) / 255.0,
        alpha,
    )


def node_input(node, *names):
    for name in names:
        if name in node.inputs:
            return node.inputs[name]
    return None


def material(name: str, color: int, *, emission: int | None = None, strength=0.0,
             roughness=0.5, metallic=0.0, alpha=1.0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = hex_color(color, alpha)
    result.surface_render_method = "DITHERED" if alpha < 1.0 else "DITHERED"
    principled = result.node_tree.nodes.get("Principled BSDF")
    if principled:
        node_input(principled, "Base Color").default_value = hex_color(color, alpha)
        node_input(principled, "Roughness").default_value = roughness
        node_input(principled, "Metallic").default_value = metallic
        if node_input(principled, "Alpha"):
            node_input(principled, "Alpha").default_value = alpha
        if emission is not None and node_input(principled, "Emission Color", "Emission"):
            node_input(principled, "Emission Color", "Emission").default_value = hex_color(emission)
            node_input(principled, "Emission Strength").default_value = strength
    return result


def emission_material(name: str, color: int, strength=2.0, alpha=1.0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = hex_color(color, alpha)
    emission.inputs["Strength"].default_value = strength
    if alpha < 1.0:
        transparent = nodes.new("ShaderNodeBsdfTransparent")
        mix = nodes.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = 1.0 - alpha
        links.new(transparent.outputs[0], mix.inputs[1])
        links.new(emission.outputs[0], mix.inputs[2])
        links.new(mix.outputs[0], output.inputs[0])
        result.surface_render_method = "BLENDED"
    else:
        links.new(emission.outputs[0], output.inputs[0])
    return result


def engine_plume_material(name: str, *, tail: int, middle: int, core: int,
                          strength: float, opacity: float, noise_scale: float):
    """Create a soft deterministic exhaust layer without compositor bloom.

    Nested translucent meshes retain colored energy in Blender's validated
    headless beauty path, while the axial/noise masks prevent the old opaque
    cone silhouette from reading as review VFX.
    """
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = hex_color(middle, opacity)
    result.surface_render_method = "BLENDED"
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Strength"].default_value = strength
    mix_shader = nodes.new("ShaderNodeMixShader")

    coordinates = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coordinates.outputs["Generated"], separate.inputs["Vector"])

    color = nodes.new("ShaderNodeValToRGB")
    _configure_ramp(color, [
        (0.00, hex_color(tail, 0.0)),
        (0.18, hex_color(tail, 1.0)),
        (0.58, hex_color(middle, 1.0)),
        (1.00, hex_color(core, 1.0)),
    ])
    links.new(separate.outputs["Z"], color.inputs["Fac"])
    links.new(color.outputs["Color"], emission.inputs["Color"])

    axial = nodes.new("ShaderNodeValToRGB")
    _configure_ramp(axial, [
        (0.00, (0.0, 0.0, 0.0, 1.0)),
        (0.12, (0.24, 0.24, 0.24, 1.0)),
        (0.42, (0.82, 0.82, 0.82, 1.0)),
        (0.90, (1.0, 1.0, 1.0, 1.0)),
        (1.00, (0.72, 0.72, 0.72, 1.0)),
    ])
    links.new(separate.outputs["Z"], axial.inputs["Fac"])

    noise = nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    node_input(noise, "Scale").default_value = noise_scale
    node_input(noise, "Detail").default_value = 4.2
    node_input(noise, "Roughness").default_value = 0.68
    node_input(noise, "Distortion").default_value = 0.16
    node_input(noise, "W").default_value = 0.618034
    links.new(coordinates.outputs["Generated"], noise.inputs["Vector"])
    noise_mask = nodes.new("ShaderNodeValToRGB")
    _configure_ramp(noise_mask, [
        (0.00, (0.18, 0.18, 0.18, 1.0)),
        (0.35, (0.48, 0.48, 0.48, 1.0)),
        (0.72, (0.90, 0.90, 0.90, 1.0)),
        (1.00, (1.0, 1.0, 1.0, 1.0)),
    ])
    links.new(noise.outputs["Fac"], noise_mask.inputs["Fac"])
    alpha = nodes.new("ShaderNodeMath")
    alpha.operation = "MULTIPLY"
    links.new(axial.outputs["Color"], alpha.inputs[0])
    links.new(noise_mask.outputs["Color"], alpha.inputs[1])
    alpha_scale = nodes.new("ShaderNodeMath")
    alpha_scale.operation = "MULTIPLY"
    alpha_scale.inputs[1].default_value = opacity
    links.new(alpha.outputs[0], alpha_scale.inputs[0])

    links.new(alpha_scale.outputs[0], mix_shader.inputs[0])
    links.new(transparent.outputs[0], mix_shader.inputs[1])
    links.new(emission.outputs[0], mix_shader.inputs[2])
    links.new(mix_shader.outputs[0], output.inputs[0])
    return result


def radial_halo_material(name: str, color: int, *, strength: float, opacity: float):
    """Create a camera-facing soft halo with no opaque destination surface."""
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.surface_render_method = "BLENDED"
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = hex_color(color)
    emission.inputs["Strength"].default_value = strength
    coordinates = nodes.new("ShaderNodeTexCoord")
    vector = nodes.new("ShaderNodeVectorMath")
    vector.operation = "DISTANCE"
    vector.inputs[1].default_value = (0.5, 0.5, 0.5)
    links.new(coordinates.outputs["Generated"], vector.inputs[0])
    falloff = nodes.new("ShaderNodeValToRGB")
    _configure_ramp(falloff, [
        (0.00, (opacity, opacity, opacity, 1.0)),
        (0.13, (opacity * 0.72, opacity * 0.72, opacity * 0.72, 1.0)),
        (0.34, (opacity * 0.18, opacity * 0.18, opacity * 0.18, 1.0)),
        (0.52, (0.0, 0.0, 0.0, 1.0)),
    ])
    links.new(vector.outputs["Value"], falloff.inputs["Fac"])
    mix = nodes.new("ShaderNodeMixShader")
    links.new(falloff.outputs["Color"], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs[0])
    return result


def image_emission_material(name: str, path: Path, *, horizontal_anchor=None,
                            vertical_anchor=None):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Strength"].default_value = 1.0
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(path), check_existing=True)
    texture.interpolation = "Linear"
    texture.extension = "EXTEND"
    if horizontal_anchor is not None or vertical_anchor is not None:
        # Reframe a documented feature inside a full-frame review plate without
        # leaving uncovered edges or baking another derivative. The piecewise
        # UV warp keeps both source edges pinned while moving the declared
        # aperture to screen centre for the authoritative 3D core overlay.
        coordinates = nodes.new("ShaderNodeTexCoord")
        separate = nodes.new("ShaderNodeSeparateXYZ")
        links.new(coordinates.outputs["Generated"], separate.inputs["Vector"])
        def anchored_axis(source, anchor):
            if anchor is None:
                return source
            lower_scale = float(anchor) / 0.5
            upper_scale = (1.0 - float(anchor)) / 0.5
            lower = nodes.new("ShaderNodeMath")
            lower.operation = "MULTIPLY"
            lower.inputs[1].default_value = lower_scale
            links.new(source, lower.inputs[0])
            upper = nodes.new("ShaderNodeMath")
            upper.operation = "MULTIPLY"
            upper.inputs[1].default_value = upper_scale
            links.new(source, upper.inputs[0])
            upper_offset = nodes.new("ShaderNodeMath")
            upper_offset.operation = "ADD"
            upper_offset.inputs[1].default_value = 1.0 - upper_scale
            links.new(upper.outputs[0], upper_offset.inputs[0])
            side = nodes.new("ShaderNodeMath")
            side.operation = "LESS_THAN"
            side.inputs[1].default_value = 0.5
            links.new(source, side.inputs[0])
            remapped = nodes.new("ShaderNodeMixRGB")
            links.new(side.outputs[0], remapped.inputs[0])
            links.new(upper_offset.outputs[0], remapped.inputs[1])
            links.new(lower.outputs[0], remapped.inputs[2])
            return remapped.outputs["Color"]

        remapped_x = anchored_axis(separate.outputs["X"], horizontal_anchor)
        remapped_y = anchored_axis(separate.outputs["Y"], vertical_anchor)
        vector = nodes.new("ShaderNodeCombineXYZ")
        links.new(remapped_x, vector.inputs["X"])
        links.new(remapped_y, vector.inputs["Y"])
        links.new(separate.outputs["Z"], vector.inputs["Z"])
        links.new(vector.outputs["Vector"], texture.inputs["Vector"])
    links.new(texture.outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return result


def rim_shell_material(name: str, color: int, strength=1.0, opacity=0.24):
    """Create a deterministic Fresnel shell without a literal wire cage."""
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = hex_color(color, opacity)
    result.surface_render_method = "BLENDED"
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = hex_color(color)
    emission.inputs["Strength"].default_value = strength
    layer_weight = nodes.new("ShaderNodeLayerWeight")
    invert = nodes.new("ShaderNodeMath")
    invert.operation = "SUBTRACT"
    invert.inputs[0].default_value = 1.0
    links.new(layer_weight.outputs["Facing"], invert.inputs[1])
    power = nodes.new("ShaderNodeMath")
    power.operation = "POWER"
    power.inputs[1].default_value = 3.4
    links.new(invert.outputs[0], power.inputs[0])
    alpha = nodes.new("ShaderNodeMath")
    alpha.operation = "MULTIPLY"
    alpha.inputs[1].default_value = opacity
    links.new(power.outputs[0], alpha.inputs[0])
    mix = nodes.new("ShaderNodeMixShader")
    links.new(alpha.outputs[0], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs[0])
    return result


def nebula_volume_material(name: str):
    """Create a restrained procedural volume for the Completion destination."""
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    volume = nodes.new("ShaderNodeVolumePrincipled")
    coordinates = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    node_input(noise, "Scale").default_value = 1.18
    node_input(noise, "Detail").default_value = 5.4
    node_input(noise, "Roughness").default_value = 0.72
    threshold = nodes.new("ShaderNodeMath")
    threshold.operation = "SUBTRACT"
    threshold.inputs[1].default_value = 0.48
    positive = nodes.new("ShaderNodeMath")
    positive.operation = "MAXIMUM"
    positive.inputs[1].default_value = 0.0
    density = nodes.new("ShaderNodeMath")
    density.operation = "MULTIPLY"
    density.inputs[1].default_value = 0.035
    ramp = nodes.new("ShaderNodeValToRGB")
    _configure_ramp(ramp, [
        (0.00, (0.006, 0.02, 0.035, 1.0)),
        (0.42, (0.025, 0.18, 0.22, 1.0)),
        (0.72, (0.19, 0.055, 0.31, 1.0)),
        (1.00, (0.08, 0.45, 0.39, 1.0)),
    ])
    links.new(coordinates.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], threshold.inputs[0])
    links.new(threshold.outputs[0], positive.inputs[0])
    links.new(positive.outputs[0], density.inputs[0])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(density.outputs[0], volume.inputs["Density"])
    links.new(ramp.outputs["Color"], volume.inputs["Color"])
    links.new(ramp.outputs["Color"], volume.inputs["Emission Color"])
    volume.inputs["Emission Strength"].default_value = 0.08
    volume.inputs["Anisotropy"].default_value = 0.18
    links.new(volume.outputs["Volume"], output.inputs["Volume"])
    return result


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def import_glb(path: Path, name: str, scale: float):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path), import_pack_images=True)
    imported = [item for item in bpy.context.scene.objects if item not in before]
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    imported_set = set(imported)
    for item in imported:
        if item.parent not in imported_set:
            world = item.matrix_world.copy()
            item.parent = root
            item.matrix_world = world
        if item.type == "MESH":
            item.pass_index = 2
    root.scale = (scale, scale, scale)
    return root


def add_uv_sphere(name: str, radius: float, color: int, location=(0, 0, 0),
                  segments=48, pass_index=2, emissive=None):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=max(16, segments // 2),
        radius=radius,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.pass_index = pass_index
    obj.data.materials.append(material(
        f"{name}-material", color,
        emission=emissive,
        strength=2.2 if emissive is not None else 0.0,
        roughness=0.72,
    ))
    return obj


def smooth_mesh(obj):
    if obj and getattr(obj, "type", None) == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def add_torus(name: str, major: float, minor: float, color: int, *, pass_index=13,
              strength=4.0, alpha=1.0):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=96,
        minor_segments=16,
    )
    obj = bpy.context.object
    obj.name = name
    obj.pass_index = pass_index
    obj.data.materials.append(emission_material(f"{name}-material", color, strength, alpha))
    return obj


def add_engine_plume_mesh(name: str, *, radius: float, depth: float,
                           segments=40, rings=14, phase=0.0):
    """Build an open, tapered exhaust envelope with a non-geometric silhouette."""
    vertices = []
    faces = []
    for ring_index in range(rings + 1):
        progress = ring_index / rings  # tail=0, nozzle=1
        envelope = math.sin(math.pi * (progress ** 0.82)) ** 0.82
        envelope *= 0.88 + 0.12 * progress
        ring_radius = radius * (0.025 + envelope * 0.94)
        z = -depth * (1.0 - progress)
        for segment_index in range(segments):
            angle = math.tau * segment_index / segments
            turbulence = 1.0 + 0.055 * math.sin(
                angle * 5.0 + progress * 11.0 + phase
            )
            vertices.append((
                math.cos(angle) * ring_radius * turbulence,
                math.sin(angle) * ring_radius * turbulence,
                z,
            ))
    for ring_index in range(rings):
        row = ring_index * segments
        next_row = (ring_index + 1) * segments
        for segment_index in range(segments):
            next_segment = (segment_index + 1) % segments
            faces.append((
                row + segment_index,
                row + next_segment,
                next_row + next_segment,
                next_row + segment_index,
            ))
    mesh = bpy.data.meshes.new(f"{name}-mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _configure_ramp(ramp, stops):
    """Set a color ramp from explicit, deterministic stops."""
    elements = ramp.color_ramp.elements
    while len(elements) > 2:
        elements.remove(elements[-1])
    first, last = elements[0], elements[1]
    first.position, first.color = stops[0]
    last.position, last.color = stops[-1]
    for position, color in stops[1:-1]:
        element = elements.new(position)
        element.color = color
    ramp.color_ramp.interpolation = "EASE"


def accretion_material(name: str, *, strength=7.5, alpha_scale=0.92,
                       haze=False, inner_hot=False):
    """Create a textured, alpha-bearing authored accretion material.

    The material is entirely procedural and deterministic. It deliberately
    stays in the clean authored-3D layer; it is not an AI VFX substitute and
    does not change the production truth boundary.
    """
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = hex_color(0xD55D24, alpha_scale)
    result.surface_render_method = "BLENDED"
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Strength"].default_value = strength
    mix_shader = nodes.new("ShaderNodeMixShader")

    texcoord = nodes.new("ShaderNodeTexCoord")
    uv = nodes.new("ShaderNodeSeparateXYZ")
    generated = nodes.new("ShaderNodeSeparateXYZ")
    links.new(texcoord.outputs["UV"], uv.inputs["Vector"])
    links.new(texcoord.outputs["Generated"], generated.inputs["Vector"])

    radial_color = nodes.new("ShaderNodeValToRGB")
    color_stops = [
        (0.00, hex_color(0xFFF4CE)),
        (0.12, hex_color(0xFFD17A)),
        (0.42, hex_color(0xFF7D2F)),
        (0.78, hex_color(0x8F211B)),
        (1.00, hex_color(0x150308)),
    ] if inner_hot else [
        (0.00, hex_color(0xFFE6A2)),
        (0.10, hex_color(0xFFB24B)),
        (0.32, hex_color(0xE35424)),
        (0.68, hex_color(0x6B1522)),
        (1.00, hex_color(0x0B0208)),
    ]
    _configure_ramp(radial_color, color_stops)
    links.new(uv.outputs["Y"], radial_color.inputs["Fac"])

    # A restrained left/right temperature split suggests relativistic
    # Doppler shift without drawing another geometric hoop around the core.
    doppler = nodes.new("ShaderNodeValToRGB")
    _configure_ramp(doppler, [
        (0.00, hex_color(0x59B8D6)),
        (0.36, hex_color(0xF3C178)),
        (0.58, hex_color(0xFFDB8A)),
        (1.00, hex_color(0xD14A24)),
    ])
    links.new(generated.outputs["X"], doppler.inputs["Fac"])
    temperature_mix = nodes.new("ShaderNodeMixRGB")
    temperature_mix.blend_type = "MIX"
    temperature_mix.inputs[0].default_value = 0.20 if not haze else 0.08
    links.new(radial_color.outputs["Color"], temperature_mix.inputs[1])
    links.new(doppler.outputs["Color"], temperature_mix.inputs[2])

    noise = nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    node_input(noise, "Scale").default_value = 7.5 if not haze else 3.2
    node_input(noise, "Detail").default_value = 5.0
    node_input(noise, "Roughness").default_value = 0.72
    node_input(noise, "Distortion").default_value = 0.24
    node_input(noise, "W").default_value = 0.314159
    links.new(texcoord.outputs["UV"], noise.inputs["Vector"])
    noise_ramp = nodes.new("ShaderNodeValToRGB")
    _configure_ramp(noise_ramp, [
        (0.00, (0.12, 0.12, 0.12, 1.0)),
        (0.38, (0.36, 0.36, 0.36, 1.0)),
        (0.64, (0.82, 0.82, 0.82, 1.0)),
        (1.00, (1.0, 1.0, 1.0, 1.0)),
    ])
    links.new(noise.outputs["Fac"], noise_ramp.inputs["Fac"])

    filaments = nodes.new("ShaderNodeTexWave")
    filaments.wave_type = "BANDS"
    filaments.bands_direction = "X"
    node_input(filaments, "Scale").default_value = 24.0
    node_input(filaments, "Distortion").default_value = 7.0
    node_input(filaments, "Detail Scale").default_value = 2.2
    radial_twist = nodes.new("ShaderNodeMath")
    radial_twist.operation = "MULTIPLY"
    radial_twist.inputs[1].default_value = 3.6
    links.new(uv.outputs["Y"], radial_twist.inputs[0])
    spiral_coordinate = nodes.new("ShaderNodeMath")
    spiral_coordinate.operation = "ADD"
    links.new(uv.outputs["X"], spiral_coordinate.inputs[0])
    links.new(radial_twist.outputs[0], spiral_coordinate.inputs[1])
    spiral_vector = nodes.new("ShaderNodeCombineXYZ")
    links.new(spiral_coordinate.outputs[0], spiral_vector.inputs["X"])
    links.new(uv.outputs["Y"], spiral_vector.inputs["Y"])
    links.new(spiral_vector.outputs["Vector"], filaments.inputs["Vector"])

    noise_mix = nodes.new("ShaderNodeMixRGB")
    noise_mix.blend_type = "MULTIPLY"
    noise_mix.inputs[0].default_value = 0.70 if inner_hot else 0.62 if not haze else 0.34
    links.new(noise_ramp.outputs["Color"], noise_mix.inputs[1])
    links.new(filaments.outputs["Color"], noise_mix.inputs[2])
    surface_color = nodes.new("ShaderNodeMixRGB")
    surface_color.blend_type = "MULTIPLY"
    surface_color.inputs[0].default_value = 0.64 if inner_hot else 0.54 if not haze else 0.24
    links.new(temperature_mix.outputs["Color"], surface_color.inputs[1])
    links.new(noise_mix.outputs["Color"], surface_color.inputs[2])
    links.new(surface_color.outputs["Color"], emission.inputs["Color"])

    radial_alpha = nodes.new("ShaderNodeValToRGB")
    _configure_ramp(radial_alpha, [
        (0.00, (0.0, 0.0, 0.0, 1.0)),
        (0.035, (1.0, 1.0, 1.0, 1.0)),
        (0.22, (0.96, 0.96, 0.96, 1.0)),
        (0.72, (0.52, 0.52, 0.52, 1.0)),
        (1.00, (0.0, 0.0, 0.0, 1.0)),
    ])
    links.new(uv.outputs["Y"], radial_alpha.inputs["Fac"])
    noise_weight = nodes.new("ShaderNodeMath")
    noise_weight.operation = "MULTIPLY"
    noise_weight.inputs[1].default_value = 0.58
    links.new(noise.outputs["Fac"], noise_weight.inputs[0])
    noise_floor = nodes.new("ShaderNodeMath")
    noise_floor.operation = "ADD"
    noise_floor.inputs[1].default_value = 0.42
    links.new(noise_weight.outputs[0], noise_floor.inputs[0])
    alpha = nodes.new("ShaderNodeMath")
    alpha.operation = "MULTIPLY"
    links.new(radial_alpha.outputs["Color"], alpha.inputs[0])
    links.new(noise_floor.outputs[0], alpha.inputs[1])
    alpha_scale_node = nodes.new("ShaderNodeMath")
    alpha_scale_node.operation = "MULTIPLY"
    alpha_scale_node.inputs[1].default_value = alpha_scale
    links.new(alpha.outputs[0], alpha_scale_node.inputs[0])

    links.new(alpha_scale_node.outputs[0], mix_shader.inputs[0])
    links.new(transparent.outputs[0], mix_shader.inputs[1])
    links.new(emission.outputs[0], mix_shader.inputs[2])
    links.new(mix_shader.outputs[0], output.inputs[0])
    return result


def add_accretion_annulus(name: str, inner: float, outer: float, *, radial_steps=14,
                          segments=192, pass_index=13, haze=False, inner_hot=False,
                          strength=None, alpha_scale=None):
    """Build a UV-authored annulus with slight deterministic surface flow."""
    columns = segments + 1
    vertices = []
    faces = []
    for radial_index in range(radial_steps + 1):
        radial_progress = radial_index / radial_steps
        radius = inner + (outer - inner) * radial_progress
        for segment_index in range(columns):
            angle = math.tau * segment_index / segments
            ripple = math.sin(angle * 5.0 + radial_progress * 13.0) * 0.022
            ripple *= math.sin(math.pi * radial_progress)
            vertices.append((math.cos(angle) * radius, math.sin(angle) * radius, ripple))
    for radial_index in range(radial_steps):
        row = radial_index * columns
        next_row = (radial_index + 1) * columns
        for segment_index in range(segments):
            faces.append((
                row + segment_index,
                row + segment_index + 1,
                next_row + segment_index + 1,
                next_row + segment_index,
            ))
    mesh = bpy.data.meshes.new(f"{name}-mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="Accretion UV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            radial_index, segment_index = divmod(vertex_index, columns)
            uv_layer.data[loop_index].uv = (
                segment_index / segments,
                radial_index / radial_steps,
            )
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.pass_index = pass_index
    obj.data.materials.append(accretion_material(
        f"{name}-material",
        strength=float(strength if strength is not None else (0.65 if haze else 2.8)),
        alpha_scale=float(alpha_scale if alpha_scale is not None else (0.12 if haze else 0.88)),
        haze=haze,
        inner_hot=inner_hot,
    ))
    return obj


def add_lensing_arc(name: str, *, radius_x: float, radius_z: float,
                    start_degrees: float, end_degrees: float, y: float,
                    color: int, bevel: float, strength: float, alpha: float):
    """Build a restrained camera-side gravitational-lensing arc."""
    steps = 72
    points = []
    for index in range(steps + 1):
        progress = index / steps
        angle = math.radians(start_degrees + (end_degrees - start_degrees) * progress)
        points.append(Vector((math.cos(angle) * radius_x, y, math.sin(angle) * radius_z)))
    return add_curve(name, points, color, bevel, 14, strength, alpha)


def add_accretion_sparks(name: str, *, count: int, inner: float, outer: float,
                          color: int, seed: int):
    """Create one deterministic low-cost mesh of hot accretion fragments."""
    rng = random.Random(seed)
    mesh = bpy.data.meshes.new(f"{name}-mesh")
    bm = bmesh.new()
    for _ in range(count):
        radius = inner + (outer - inner) * (rng.random() ** 0.72)
        angle = rng.random() * math.tau
        vertical = (rng.random() - 0.5) * 0.13 * (1.0 - (radius - inner) / (outer - inner))
        size = 0.010 + rng.random() * 0.026
        position = Vector((math.cos(angle) * radius, math.sin(angle) * radius, vertical))
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=size, matrix=Matrix.Translation(position))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.pass_index = 14
    obj.data.materials.append(emission_material(f"{name}-material", color, 2.6, 0.72))
    return obj


def add_point_field(name: str, count: int, radius: float, size_range, color: int, seed: int,
                    pass_index: int):
    rng = random.Random(seed)
    mesh = bpy.data.meshes.new(f"{name}-mesh")
    bm = bmesh.new()
    for _ in range(count):
        distance = radius * (0.35 + rng.random() * 0.65)
        theta = rng.random() * math.tau
        z = rng.random() * 2.0 - 1.0
        radial = math.sqrt(max(0.0, 1.0 - z * z))
        position = Vector((math.cos(theta) * radial * distance, math.sin(theta) * radial * distance, z * distance))
        size = size_range[0] + rng.random() * (size_range[1] - size_range[0])
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=size, matrix=Matrix.Translation(position))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.pass_index = pass_index
    obj.data.materials.append(emission_material(f"{name}-material", color, 3.0))
    return obj


def add_curve(name: str, points, color: int, bevel=0.018, pass_index=12, strength=3.0,
              alpha=1.0):
    curve = bpy.data.curves.new(f"{name}-curve", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = bevel
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, values in zip(spline.points, points):
        point.co = (*values, 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.pass_index = pass_index
    obj.data.materials.append(emission_material(f"{name}-material", color, strength, alpha))
    return obj


class VoyageScene:
    def __init__(self, plan, args):
        self.plan = plan
        self.args = args
        self.scene = bpy.context.scene
        self.groups = {}
        self.bodies = {}
        self.body_rings = {}
        self.flames = []
        self.lookdev_plates = {}
        self.lookdev_provenance = None
        self.camera = None
        self.lights = {}
        self.world_nodes = {}
        self.review_polish = {
            "agx": False,
            "contrastLook": None,
            "fogGlow": False,
            "fogGlowError": None,
            "proceduralWorld": False,
            "layeredEnginePlume": False,
            "layeredAccretion": False,
            "gravitationalLensing": False,
            "unresolvedBeyondBeacon": False,
            "plateReplacesBlackHoleGeometry": False,
        }
        self.effective_samples = None
        self._configure_scene()
        self._build()

    def _configure_scene(self):
        scene = self.scene
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = self.args.width
        scene.render.resolution_y = self.args.height
        scene.render.resolution_percentage = 100
        scene.render.fps = int(self.plan["fps"])
        if hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples"):
            scene.eevee.taa_render_samples = int(self.args.samples)
            self.effective_samples = int(scene.eevee.taa_render_samples)
        else:
            self.effective_samples = None
        scene.render.image_settings.color_mode = "RGBA"
        scene.render.film_transparent = False
        scene.render.use_file_extension = True
        # Blender otherwise writes wall-clock date and render duration into
        # PNG metadata, making byte hashes drift even when every pixel is
        # identical. Review renders are evidence, so their files must remain
        # reproducible as well as their image content.
        scene.render.use_stamp = False
        for stamp_property in (
            "use_stamp_date", "use_stamp_time", "use_stamp_render_time",
            "use_stamp_frame", "use_stamp_camera", "use_stamp_scene",
            "use_stamp_filename", "use_stamp_hostname", "use_stamp_memory",
        ):
            if hasattr(scene.render, stamp_property):
                setattr(scene.render, stamp_property, False)
        scene.render.image_settings.file_format = "OPEN_EXR_MULTILAYER" if self.args.mode == "production" else "PNG"
        if self.args.mode == "production":
            if not os.environ.get("OCIO"):
                raise RuntimeError("Production mode requires an explicit project-owned ACES OCIO configuration in OCIO.")
            scene.render.image_settings.color_depth = "16"
            scene.render.image_settings.exr_codec = "ZIP"
        scene.render.image_settings.color_depth = "16" if self.args.mode == "production" else "8"
        view_layer = scene.view_layers[0]
        view_layer.use_pass_z = True
        view_layer.use_pass_normal = True
        view_layer.use_pass_vector = True
        view_layer.use_pass_object_index = True
        if hasattr(view_layer, "use_pass_cryptomatte_object"):
            view_layer.use_pass_cryptomatte_object = True
        self._configure_color_management()
        self._configure_review_compositor()
        self._configure_world()

    def _configure_color_management(self):
        view = self.scene.view_settings
        try:
            transforms = [item.identifier for item in view.bl_rna.properties["view_transform"].enum_items]
            if "AgX" in transforms:
                view.view_transform = "AgX"
                self.review_polish["agx"] = True
        except Exception:
            pass
        self.review_polish["agx"] = str(view.view_transform).casefold() == "agx"
        try:
            looks = [item.identifier for item in view.bl_rna.properties["look"].enum_items]
            preferred = next((item for item in looks if "MEDIUM" in item.upper() and "HIGH" in item.upper()), None)
            if preferred:
                view.look = preferred
                self.review_polish["contrastLook"] = preferred
            elif self.args.mode != "production":
                # The pinned Blender build exposes only the neutral AgX look.
                # A restrained exposure lift avoids inventing a release grade.
                view.exposure = 0.32
        except Exception:
            if self.args.mode != "production":
                view.exposure = 0.32

    def _configure_review_compositor(self):
        if self.args.mode == "production":
            return
        tree = None
        modern_group = hasattr(self.scene, "compositing_node_group")
        if modern_group:
            # Blender 5.1's reusable compositor group evaluates to a blank
            # still when driven through render(write_still=True) in this
            # pinned headless path. Keep the clean beauty render instead of
            # reporting an effect that was not actually applied. The
            # luminance probe below guards this contract independently.
            self.review_polish["fogGlowError"] = (
                "Disabled on Blender 5.1 headless stills after blank-output validation; "
                "clean beauty path retained."
            )
            return
        try:
            if modern_group:
                tree = bpy.data.node_groups.new("Voyage Review Compositor", "CompositorNodeTree")
                self.scene.compositing_node_group = tree
                output = tree.nodes.new("NodeGroupOutput")
                tree.interface.new_socket(name="Output", in_out="OUTPUT", socket_type="NodeSocketColor")
                output.is_active_output = True
            else:
                self.scene.use_nodes = True
                tree = self.scene.node_tree
                output = tree.nodes.new("CompositorNodeComposite")
            nodes = tree.nodes
            links = tree.links
            for node in list(nodes):
                if node is not output:
                    nodes.remove(node)
            source = nodes.new("CompositorNodeRLayers")
            glare = nodes.new("CompositorNodeGlare")
            if hasattr(glare, "glare_type"):
                glare.glare_type = "FOG_GLOW"
                glare.quality = "HIGH"
                glare.threshold = 1.35
                glare.size = 6
                glare.mix = -0.9
            else:
                glare.inputs["Type"].default_value = "Fog Glow"
                glare.inputs["Quality"].default_value = "High"
                glare.inputs["Threshold"].default_value = 1.35
                glare.inputs["Size"].default_value = 0.46
                glare.inputs["Strength"].default_value = 0.16
            links.new(source.outputs["Image"], glare.inputs["Image"])
            links.new(glare.outputs["Image"], output.inputs["Image"])
            self.review_polish["fogGlow"] = True
        except Exception as error:
            if modern_group and getattr(self.scene, "compositing_node_group", None) is tree:
                self.scene.compositing_node_group = None
            if modern_group and tree and tree.users == 0:
                bpy.data.node_groups.remove(tree)
            self.review_polish["fogGlow"] = False
            self.review_polish["fogGlowError"] = f"{type(error).__name__}: {error}"
            print(f"VOYAGE_REVIEW_COMPOSITOR_ERROR={self.review_polish['fogGlowError']}", file=sys.stderr)

    def _configure_world(self):
        world = bpy.data.worlds.new("Voyage World") if not self.scene.world else self.scene.world
        self.scene.world = world
        world.use_nodes = True
        nodes = world.node_tree.nodes
        links = world.node_tree.links
        nodes.clear()
        output = nodes.new("ShaderNodeOutputWorld")
        background = nodes.new("ShaderNodeBackground")
        background.inputs["Strength"].default_value = 0.32
        coordinates = nodes.new("ShaderNodeTexCoord")
        noise = nodes.new("ShaderNodeTexNoise")
        noise.noise_dimensions = "4D"
        node_input(noise, "Scale").default_value = 1.65
        node_input(noise, "Detail").default_value = 3.2
        node_input(noise, "Roughness").default_value = 0.68
        node_input(noise, "W").default_value = 0.271828
        links.new(coordinates.outputs["Normal"], noise.inputs["Vector"])
        base_ramp = nodes.new("ShaderNodeValToRGB")
        _configure_ramp(base_ramp, [
            (0.00, (0.0005, 0.0012, 0.0045, 1.0)),
            (0.46, (0.003, 0.0065, 0.022, 1.0)),
            (0.72, (0.015, 0.026, 0.068, 1.0)),
            (1.00, (0.05, 0.015, 0.075, 1.0)),
        ])
        beyond_ramp = nodes.new("ShaderNodeValToRGB")
        _configure_ramp(beyond_ramp, [
            (0.00, (0.001, 0.002, 0.012, 1.0)),
            (0.42, (0.018, 0.012, 0.07, 1.0)),
            (0.72, (0.014, 0.08, 0.095, 1.0)),
            (1.00, (0.16, 0.065, 0.18, 1.0)),
        ])
        links.new(noise.outputs["Fac"], base_ramp.inputs["Fac"])
        links.new(noise.outputs["Fac"], beyond_ramp.inputs["Fac"])
        mix = nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MIX"
        mix.inputs[0].default_value = 0.0
        links.new(base_ramp.outputs["Color"], mix.inputs[1])
        links.new(beyond_ramp.outputs["Color"], mix.inputs[2])
        links.new(mix.outputs["Color"], background.inputs["Color"])
        links.new(background.outputs["Background"], output.inputs["Surface"])
        self.world_nodes = {"background": background, "mix": mix}
        self.review_polish["proceduralWorld"] = True

    def _asset(self, key, name, scale):
        record = self.plan["assets"][key]
        path = bounded(ROOT, record["path"])
        if not path.is_file() or sha256(path) != record["sha256"]:
            raise RuntimeError(f"Authoritative {key} asset failed its hash check.")
        return import_glb(path, name, scale)

    def _build(self):
        self._build_camera()
        if self.args.lookdev_plates:
            self._build_lookdev_plates()
        self._build_solar()
        self._build_rocket()
        self.groups["stars"] = add_point_field("Voyage Stars", 650, 78.0, (0.018, 0.052), 0xD9EDFF, 0x51F15E, 10)
        self.groups["debris"] = add_point_field("Voyage Debris", 110, 34.0, (0.025, 0.095), 0x6F829C, 0xDE8715, 11)
        self._build_warp()
        self._build_systems()
        self._build_heliopause()
        self._build_black_hole()
        self._build_beyond_field()
        self._build_lights()

    def _build_camera(self):
        camera_data = bpy.data.cameras.new("Voyage Camera")
        camera_data.lens = 50
        camera_data.clip_start = 0.05
        camera_data.clip_end = 220
        self.camera = bpy.data.objects.new("Voyage Camera", camera_data)
        bpy.context.scene.collection.objects.link(self.camera)
        self.scene.camera = self.camera

    def _build_lookdev_plates(self):
        if self.args.mode == "production":
            raise RuntimeError("Look-development plates are review-only and cannot enter production mode.")
        manifest_path = bounded(ROOT, LOOKDEV_MANIFEST_PATH)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (manifest.get("status") != "non-shipping-look-development"
                or manifest.get("releaseEligible") is not False
                or manifest.get("contractSha256") != self.plan.get("contractSha256")):
            raise RuntimeError("Look-development manifest lost its review-only contract identity.")
        records = {record.get("id"): record for record in manifest.get("assets", [])}
        provenance_assets = []
        for plate_id in LOOKDEV_PLATE_IDS:
            record = records.get(plate_id)
            if not record:
                raise RuntimeError(f"Look-development plate {plate_id} is missing from its manifest.")
            path = bounded(ROOT, record["path"])
            if not path.is_file() or sha256(path) != record.get("sha256"):
                raise RuntimeError(f"Look-development plate {plate_id} failed its hash check.")
            bpy.ops.mesh.primitive_plane_add(size=2.0)
            plate = bpy.context.object
            plate.name = f"Voyage Review Underlay {plate_id}"
            plate.data.materials.append(image_emission_material(
                f"Voyage Review Underlay {plate_id} Material", path,
                horizontal_anchor=0.292 if plate_id == "singularity-corona" else None,
                vertical_anchor=0.435 if plate_id == "singularity-corona" else None,
            ))
            plate.pass_index = 0
            if hasattr(plate, "visible_shadow"):
                plate.visible_shadow = False
            plate.hide_render = True
            plate.hide_viewport = True
            self.lookdev_plates[plate_id] = plate
            provenance_assets.append({
                "id": plate_id,
                "path": record["path"],
                "sha256": record["sha256"],
                "compositionMode": "underlay",
            })
        self.lookdev_provenance = {
            "reviewOnly": True,
            "compositionMode": "underlay",
            "manifest": {
                "path": LOOKDEV_MANIFEST_PATH,
                "sha256": sha256(manifest_path),
            },
            "assets": provenance_assets,
        }
        self.review_polish["plateReplacesBlackHoleGeometry"] = True

    def _apply_lookdev_underlay(self, record):
        if not self.lookdev_plates:
            return
        shot_id = record["shotId"]
        active_id = (
            "beyond-color-field" if shot_id == "beyond"
            else "warp-caustics" if shot_id == "warp"
            else "singularity-corona" if shot_id in ("black-hole", "singularity")
            else "far-field-nebula"
        )
        camera = record["camera"]
        direction = to_blender(camera["target"]) - self.camera.location
        if direction.length_squared <= 1e-8:
            direction = Vector((0.0, 1.0, 0.0))
        direction.normalize()
        distance = min(160.0, float(self.camera.data.clip_end) * 0.9)
        half_height = math.tan(math.radians(float(camera["fov"])) * 0.5) * distance * 1.08
        half_width = half_height * (float(self.args.width) / float(self.args.height))
        for plate_id, plate in self.lookdev_plates.items():
            visible = plate_id == active_id
            plate.hide_render = not visible
            plate.hide_viewport = not visible
            if not visible:
                continue
            plate.location = self.camera.location + direction * distance
            plate.rotation_mode = "QUATERNION"
            plate.rotation_quaternion = (-direction).to_track_quat("Z", "Y")
            approach_zoom = 1.0
            if active_id == "singularity-corona" and shot_id == "singularity":
                approach_zoom += (float(record.get("shotProgress", 0.0)) ** 1.55) * 0.72
            plate.scale = (half_width * approach_zoom, half_height * approach_zoom, 1.0)

    def _build_solar(self):
        root = bpy.data.objects.new("Voyage Solar System", None)
        bpy.context.scene.collection.objects.link(root)
        self.groups["solar"] = root
        layout = {body["id"]: body for body in self.plan["bodyLayout"]}
        profiles = self.plan["bodyShaderProfiles"]
        colors = {body["id"]: int(body["color"]) for body in self.plan["bodyLayout"]}
        asset_scales = {"earth": 0.46, "moon": 0.125, "sun": 3.2}
        roots = {
            key: self._asset(key, f"Voyage {key.title()}", scale)
            for key, scale in asset_scales.items()
        }
        for body_id, body in layout.items():
            location = list(body["position"])
            if body.get("parentId"):
                parent = layout[body["parentId"]]
                location = [location[index] + parent["position"][index] for index in range(3)]
            if body_id in roots:
                obj = roots[body_id]
                obj.location = to_blender(location)
            else:
                profile = profiles.get(body_id, {})
                obj = add_uv_sphere(
                    f"Voyage {body_id.title()}",
                    float(body["radius"]),
                    int(profile.get("base", colors[body_id])),
                    to_blender(location),
                    emissive=int(body.get("emissive", 0)) if body.get("emissive") else None,
                )
            obj.parent = root
            obj["spin_rate"] = float(body.get("spinRate", 0.0))
            obj["base_visual_scale_xyz"] = [float(value) for value in obj.scale]
            self.bodies[body_id] = obj
            if body.get("rings"):
                ring = add_torus(f"Voyage {body_id.title()} Rings", float(body["radius"]) * 1.65,
                                 float(body["radius"]) * 0.035, 0xCDB879, pass_index=2, strength=0.22)
                ring.rotation_euler.x = math.pi / 2.0
                ring.location = obj.location
                ring.parent = root
                self.body_rings[body_id] = ring

    def _build_rocket(self):
        rocket = self._asset("rocket", "Voyage Rocket", 0.9)
        rocket["base_visual_scale"] = 0.9
        rocket.pass_index = 1
        for child in rocket.children_recursive:
            if child.type == "MESH":
                child.pass_index = 1
        self.groups["rocket"] = rocket
        plume_layers = (
            # radius, depth, tail, middle, core, strength, opacity, noise, response, phase
            (0.132, 1.58, 0x91240F, 0xF45D1C, 0xFFD17A, 1.8, 0.24, 3.8, 1.38, 0.0),
            (0.074, 1.18, 0xD13B13, 0xFFA632, 0xFFE8B0, 2.8, 0.43, 5.2, 1.14, 1.7),
            (0.032, 0.82, 0x2A8FC8, 0x68DFFF, 0xFFFFFF, 3.6, 0.58, 7.4, 0.92, 3.1),
        )
        for index, (radius, depth, tail, middle, core, strength, opacity,
                    noise_scale, response, phase) in enumerate(plume_layers):
            flame = add_engine_plume_mesh(
                f"Voyage Engine Plume Layer {index + 1}",
                radius=radius,
                depth=depth,
                segments=40,
                rings=14,
                phase=phase,
            )
            flame.name = f"Voyage Engine Plume Layer {index + 1}"
            flame.location = (0, 0, 0)
            flame.parent = rocket
            flame.pass_index = 11
            flame["plume_depth"] = depth
            flame["plume_response"] = response
            flame["plume_phase"] = phase
            flame.data.materials.append(engine_plume_material(
                f"Voyage Engine Plume Layer {index + 1} Material",
                tail=tail,
                middle=middle,
                core=core,
                strength=strength,
                opacity=opacity,
                noise_scale=noise_scale,
            ))
            self.flames.append(flame)
        nozzle = add_torus(
            "Voyage Engine Nozzle Glow", 0.082, 0.012, 0x8FE8FF,
            pass_index=11, strength=2.2, alpha=0.42,
        )
        nozzle.location = (0, 0, -0.012)
        nozzle.parent = rocket
        self.groups["engineNozzle"] = nozzle
        self.review_polish["layeredEnginePlume"] = True
        rim_data = bpy.data.lights.new("Voyage Rocket Rim", "POINT")
        rim_data.energy = 145
        rim_data.color = (0.28, 0.78, 1.0)
        rim_data.shadow_soft_size = 1.4
        rim_data.use_shadow = False
        rim = bpy.data.objects.new("Voyage Rocket Rim", rim_data)
        rim.location = (1.0, -1.15, 0.75)
        rim.parent = rocket
        bpy.context.scene.collection.objects.link(rim)
        engine_data = bpy.data.lights.new("Voyage Engine Light", "POINT")
        engine_data.energy = 0
        engine_data.color = (1.0, 0.32, 0.06)
        engine_data.shadow_soft_size = 0.8
        engine_data.use_shadow = False
        engine = bpy.data.objects.new("Voyage Engine Light", engine_data)
        engine.location = (0, 0, -1.15)
        engine.parent = rocket
        bpy.context.scene.collection.objects.link(engine)
        self.lights["rocketRim"] = rim
        self.lights["engine"] = engine

    def _build_warp(self):
        rng = random.Random(0x7A11C0DE)
        root = bpy.data.objects.new("Voyage Warp", None)
        bpy.context.scene.collection.objects.link(root)
        for index in range(58):
            x = (rng.random() - 0.5) * 22
            y = (rng.random() - 0.5) * 13
            z = -rng.random() * 45
            length = 2.2 + rng.random() * 7
            line = add_curve(
                f"Warp {index:03d}",
                [to_blender((x, y, z)), to_blender((x, y, z - length))],
                0x9EDFFF, 0.0055, 12, 2.2, 0.3,
            )
            line.parent = root
        self.groups["warp"] = root

    def _build_systems(self):
        root = bpy.data.objects.new("Voyage Interstellar Systems", None)
        bpy.context.scene.collection.objects.link(root)
        route = []
        for system in self.plan["interstellarSystems"]:
            position = to_blender(system["position"])
            star = add_uv_sphere(f"System {system['id']}", float(system["radius"]), int(system["starColor"]), position, segments=24, pass_index=2, emissive=int(system["starColor"]))
            star.parent = root
            companion = add_uv_sphere(f"System {system['id']} companion", float(system["radius"]) * 0.22,
                                      int(system["companionColor"]), position + Vector((float(system["radius"]) * 1.9, 0, 0)),
                                      segments=16, pass_index=2, emissive=int(system["companionColor"]))
            companion.parent = root
            route.append(position)
        route_obj = add_curve("Voyage System Route", route, 0x79E3EC, 0.004, 12, 0.55, 0.018)
        route_obj.parent = root
        root["route_object"] = route_obj.name
        self.groups["systems"] = root

    def _build_heliopause(self):
        obj = add_uv_sphere("Voyage Heliopause", 28.5, 0x3FB7CF, segments=48, pass_index=11, emissive=0x3FB7CF)
        smooth_mesh(obj)
        obj.data.materials.clear()
        obj.data.materials.append(rim_shell_material("Voyage Heliopause Material", 0x55D7E5, 1.25, 0.18))
        self.groups["heliopause"] = obj

    def _build_black_hole(self):
        root = bpy.data.objects.new("Voyage Black Hole", None)
        bpy.context.scene.collection.objects.link(root)
        core = add_uv_sphere("Voyage Event Horizon", 1.65, 0x000000, segments=64, pass_index=14)
        core.data.materials.clear()
        core.data.materials.append(emission_material("Voyage Event Horizon Void", 0x000000, 0.0))
        core.parent = root

        # Keep spin and inclination on separate transforms. This lets the
        # authored rotation move material filaments around the disc normal
        # without wobbling the whole plane in world space.
        tilt = bpy.data.objects.new("Voyage Accretion Tilt", None)
        bpy.context.scene.collection.objects.link(tilt)
        tilt.rotation_euler.x = math.radians(24.0)
        tilt.parent = root
        spin = bpy.data.objects.new("Voyage Accretion Spin", None)
        bpy.context.scene.collection.objects.link(spin)
        spin.parent = tilt

        disk = add_accretion_annulus(
            "Voyage Accretion Disc", 1.78, 5.18,
            radial_steps=26, segments=256, strength=1.04, alpha_scale=0.56,
        )
        disk.parent = spin
        hot = add_accretion_annulus(
            "Voyage Accretion Hot Core", 1.68, 2.62,
            radial_steps=16, segments=256, inner_hot=True, strength=2.35, alpha_scale=0.72,
        )
        hot.location.z = -0.026
        hot.parent = spin
        haze = add_accretion_annulus(
            "Voyage Accretion Haze", 1.64, 5.84,
            radial_steps=16, segments=224, haze=True, strength=0.18, alpha_scale=0.04,
        )
        haze.location.z = -0.018
        haze.parent = spin
        sparks = add_accretion_sparks(
            "Voyage Accretion Sparks", count=72, inner=1.86, outer=5.08,
            color=0xFFAD55, seed=0xB14C0DE,
        )
        sparks.location.z = -0.044
        sparks.parent = spin

        # Camera-facing photon traces preserve an opaque authored event horizon.
        nominal_view = Vector((0.0, -22.0, 3.0)).normalized()
        photon_orientation = Vector((0.0, 0.0, 1.0)).rotation_difference(nominal_view)
        warm_rim = add_torus(
            "Voyage Photon Ring Warm", 1.712, 0.018, 0xF4A75D,
            pass_index=14, strength=0.56, alpha=0.12,
        )
        warm_rim.rotation_mode = "QUATERNION"
        warm_rim.rotation_quaternion = photon_orientation
        warm_rim.parent = root
        cool_rim = add_torus(
            "Voyage Photon Ring Cool", 1.758, 0.008, 0x65C8E3,
            pass_index=14, strength=0.05, alpha=0.004,
        )
        cool_rim.rotation_mode = "QUATERNION"
        cool_rim.rotation_quaternion = photon_orientation
        cool_rim.parent = root

        root["accretion_disk"] = spin.name
        root["accretion_main"] = disk.name
        root["accretion_hot"] = hot.name
        root["accretion_haze"] = haze.name
        root["accretion_sparks"] = sparks.name
        root["photon_warm"] = warm_rim.name
        root["photon_cool"] = cool_rim.name
        self.groups["blackHole"] = root
        self.review_polish["layeredAccretion"] = True
        self.review_polish["gravitationalLensing"] = True

    def _build_beyond_field(self):
        root = bpy.data.objects.new("Voyage Beyond Field", None)
        bpy.context.scene.collection.objects.link(root)
        destination = to_blender((0, 0, -34))
        beacon = bpy.data.objects.new("Voyage Beyond Beacon", None)
        beacon.location = destination
        beacon.parent = root
        bpy.context.scene.collection.objects.link(beacon)
        bpy.ops.mesh.primitive_plane_add(size=2.0)
        halo = bpy.context.object
        halo.name = "Voyage Beyond Beacon Soft Halo"
        halo.rotation_euler.x = math.pi / 2.0
        halo.scale = (0.72, 0.44, 0.72)
        halo.pass_index = 15
        halo.data.materials.append(radial_halo_material(
            "Voyage Beyond Beacon Soft Halo Material", 0x39B8C8,
            strength=1.75, opacity=0.24,
        ))
        halo.parent = beacon
        if hasattr(halo, "visible_shadow"):
            halo.visible_shadow = False
        caustic_points = []
        for index in range(65):
            progress = index / 64
            angle = progress * math.tau * 1.65
            radius = 0.035 + progress * 0.78
            caustic_points.append(Vector((
                math.cos(angle) * radius,
                -0.018 * math.sin(progress * math.tau),
                math.sin(angle) * radius * 0.58,
            )))
        caustic = add_curve(
            "Voyage Beyond Beacon Caustic", caustic_points,
            0x61DAE8, 0.004, 15, 0.82, 0.075,
        )
        caustic.parent = beacon
        for index, (angle, length, color) in enumerate((
            (0.0, 0.48, 0xDFFFFF),
            (math.pi / 2.0, 0.30, 0x8DE7FF),
            (math.pi / 4.0, 0.24, 0xD0A5FF),
        ), start=1):
            direction = Vector((math.cos(angle), 0.0, math.sin(angle)))
            ray = add_curve(
                f"Voyage Beyond Beacon Ray {index}",
                [-direction * length, direction * length],
                color, 0.003, 15, 0.72, 0.045,
            )
            ray.parent = beacon
        root["beacon"] = beacon.name
        glow = smooth_mesh(add_uv_sphere(
            "Voyage Beyond Nebula", 4.2, 0x2B788F,
            destination, segments=48, pass_index=15,
        ))
        glow.data.materials.clear()
        glow.data.materials.append(nebula_volume_material("Voyage Beyond Nebula Material"))
        glow.scale = (1.35, 1.0, 0.55)
        glow.parent = root
        root["nebula"] = glow.name
        landmarks = (
            (-5.2, 1.8, -35.5, 0.22, 0x83D9EE),
            (4.7, -2.1, -37.2, 0.17, 0xD0A5FF),
            (2.8, 4.1, -39.5, 0.13, 0x8FF3CF),
            (-2.1, -4.4, -40.8, 0.10, 0xFFC47A),
        )
        for index, (x, y, z, radius, color) in enumerate(landmarks, start=1):
            landmark = smooth_mesh(add_uv_sphere(
                f"Voyage Beyond Landmark {index}", radius, color,
                to_blender((x, y, z)), segments=20, pass_index=15,
            ))
            landmark.data.materials.clear()
            landmark.data.materials.append(emission_material(
                f"Voyage Beyond Landmark {index} Material", color, 1.7, 0.8,
            ))
            landmark.parent = root
        self.groups["beyondField"] = root
        self.review_polish["unresolvedBeyondBeacon"] = True

    def _build_lights(self):
        world_light = bpy.data.lights.new("Voyage Key", "AREA")
        world_light.energy = 1100
        world_light.color = (0.70, 0.84, 1.0)
        world_light.shape = "DISK"
        world_light.size = 9
        world_light.use_shadow = False
        key = bpy.data.objects.new("Voyage Key", world_light)
        key.location = (9, -11, 13)
        bpy.context.scene.collection.objects.link(key)
        self.lights["key"] = key
        fill_data = bpy.data.lights.new("Voyage Planet Fill", "AREA")
        fill_data.energy = 760
        fill_data.color = (0.24, 0.52, 1.0)
        fill_data.shape = "DISK"
        fill_data.size = 14
        fill_data.use_shadow = False
        fill = bpy.data.objects.new("Voyage Planet Fill", fill_data)
        fill.location = (-9, -6, 7)
        bpy.context.scene.collection.objects.link(fill)
        self.lights["fill"] = fill
        sun_data = bpy.data.lights.new("Voyage Sun Light", "POINT")
        sun_data.energy = 2600
        sun_data.color = (1.0, 0.56, 0.22)
        sun_data.shadow_soft_size = 3.2
        sun_data.use_shadow = False
        sun = bpy.data.objects.new("Voyage Sun Light", sun_data)
        bpy.context.scene.collection.objects.link(sun)
        self.lights["sun"] = sun

    def apply(self, record):
        visibility = record["visibility"]
        effects = record["effects"]
        for key, obj in self.groups.items():
            source_key = "blackHole" if key == "blackHole" else key
            set_tree_visibility(obj, bool(visibility.get(source_key, False)))
        earth_focus = effects.get("solarFocus") == "earth"
        if visibility.get("solar", False):
            for body_id, body in self.bodies.items():
                set_tree_visibility(body, not earth_focus or body_id == "earth")
            for body_id, ring in self.body_rings.items():
                set_tree_visibility(ring, not earth_focus or body_id == "earth")
        camera = record["camera"]
        self.camera.location = to_blender(camera["position"])
        target = to_blender(camera["target"])
        self.camera.rotation_euler = (target - self.camera.location).to_track_quat("-Z", "Y").to_euler()
        self.camera.data.angle = math.radians(float(camera["fov"]))
        self._apply_lookdev_underlay(record)
        beyond_nebula_name = self.groups["beyondField"].get("nebula")
        if beyond_nebula_name and beyond_nebula_name in bpy.data.objects:
            # The review-only Beyond plate already supplies the distant color
            # field.  Keep the authored destination core/landmarks in front,
            # but remove the redundant procedural volume that otherwise reads
            # as a large opaque oval over the plate.  Clean/no-plate renders
            # retain the deterministic procedural fallback.
            beyond_visible = bool(visibility.get("beyondField", False))
            plate_replaces_volume = bool(
                self.args.lookdev_plates and record["shotId"] == "beyond"
            )
            bpy.data.objects[beyond_nebula_name].hide_render = (
                not beyond_visible or plate_replaces_volume
            )
        # The generated corona plate is explicitly a review-only underlay. In
        # those frames it replaces only the procedural disc/haze/sparks; the
        # opaque authored event horizon and photon traces remain in front, so
        # the plate cannot become the geometry or create a doubled static disc.
        plate_replaces_accretion = bool(
            self.args.lookdev_plates and record["shotId"] in ("black-hole", "singularity")
        )
        if plate_replaces_accretion:
            set_tree_visibility(self.groups["blackHole"], False)
            set_tree_visibility(self.groups["stars"], False)
            set_tree_visibility(self.groups["debris"], False)
        for property_name in ("accretion_main", "accretion_hot", "accretion_haze", "accretion_sparks"):
            object_name = self.groups["blackHole"].get(property_name)
            if object_name and object_name in bpy.data.objects:
                bpy.data.objects[object_name].hide_render = (
                    not bool(visibility.get("blackHole", False)) or plate_replaces_accretion
                )
        for property_name in ("photon_warm", "photon_cool"):
            object_name = self.groups["blackHole"].get(property_name)
            if object_name and object_name in bpy.data.objects:
                bpy.data.objects[object_name].hide_render = (
                    not bool(visibility.get("blackHole", False)) or plate_replaces_accretion
                )
        self.groups["blackHole"].scale = (1.0, 1.0, 1.0)
        rocket = record["rocket"]
        self.groups["rocket"].location = to_blender(rocket["position"])
        self.groups["rocket"].rotation_mode = "QUATERNION"
        self.groups["rocket"].rotation_quaternion = converted_rotation(rocket["rotation"])
        base_scale = float(self.groups["rocket"].get("base_visual_scale", 0.9))
        visual_scale = max(0.25, min(3.0, float(rocket.get("visualScale", 1.0))))
        rendered_scale = base_scale * visual_scale
        self.groups["rocket"].scale = (rendered_scale, rendered_scale, rendered_scale)
        flame = max(0.0, float(rocket["flame"]))
        for index, obj in enumerate(self.flames):
            obj.hide_render = flame <= 0.02
            response = float(obj.get("plume_response", 1.0))
            phase = float(obj.get("plume_phase", 0.0))
            pulse = 0.94 + 0.075 * math.sin(float(record["timelineSeconds"]) * 16.0 + phase)
            length_scale = 0.08 + flame * response * pulse
            width_scale = 0.22 + math.sqrt(flame) * 0.62 + index * 0.02 * flame
            obj.scale = (width_scale, width_scale, length_scale)
            obj.location.z = -0.018
        if "engineNozzle" in self.groups:
            self.groups["engineNozzle"].hide_render = flame <= 0.02
            nozzle_scale = 0.88 + flame * 0.16
            self.groups["engineNozzle"].scale = (nozzle_scale, nozzle_scale, nozzle_scale)
        if "engine" in self.lights:
            self.lights["engine"].data.energy = 420 * flame
            self.lights["engine"].hide_render = flame <= 0.02
        if "rocketRim" in self.lights:
            self.lights["rocketRim"].data.energy = 120 + 55 * flame
        self.groups["stars"].rotation_euler.z = float(effects["starRotation"])
        self.groups["debris"].rotation_euler.z = float(effects["debrisRotation"])
        self.groups["warp"].location = to_blender((0, 0, -float(effects["warpOffset"]) * 12))
        self.groups["systems"].location = to_blender((0, 0, float(effects["systemTransitOffset"])))
        route_name = self.groups["systems"].get("route_object")
        if route_name and route_name in bpy.data.objects:
            # The authored systems remain readable without a debug-like line
            # crossing the beauty plate. Route data stays in the scene for
            # non-beauty inspection and future dedicated mattes.
            bpy.data.objects[route_name].hide_render = True
        disk_name = self.groups["blackHole"].get("accretion_disk")
        if disk_name and disk_name in bpy.data.objects:
            bpy.data.objects[disk_name].rotation_euler.z = float(effects["accretionRotation"])
        singularity_progress = float(record.get("shotProgress", 0.0)) if record["shotId"] == "singularity" else 0.0
        haze_name = self.groups["blackHole"].get("accretion_haze")
        if haze_name and haze_name in bpy.data.objects:
            haze_scale = 1.0 + singularity_progress * 0.08
            bpy.data.objects[haze_name].scale = (haze_scale, haze_scale, 1.0)
        beyond_ring = self.groups["beyondField"].get("ring")
        if beyond_ring and beyond_ring in bpy.data.objects:
            bpy.data.objects[beyond_ring].rotation_euler.z = float(effects.get("beyondRotation", 0.0))
            bpy.data.objects[beyond_ring].rotation_euler.x = math.pi / 2.0
        beacon_name = self.groups["beyondField"].get("beacon")
        if beacon_name and beacon_name in bpy.data.objects:
            beacon = bpy.data.objects[beacon_name]
            pulse = 0.96 + 0.055 * math.sin(float(record["timelineSeconds"]) * 3.4)
            beacon.scale = (pulse, pulse, pulse)
            beacon.rotation_euler = (0.0, 0.0, 0.0)
        beyond_mix = 0.88 if record["shotId"] == "beyond" else 0.0
        if self.world_nodes.get("mix"):
            self.world_nodes["mix"].inputs[0].default_value = beyond_mix
        if self.world_nodes.get("background"):
            self.world_nodes["background"].inputs["Strength"].default_value = (
                0.46 if record["shotId"] == "beyond" else 0.32
            )
        if "key" in self.lights:
            self.lights["key"].data.energy = 1450 if record["shotId"] in ("earth", "solar", "return") else 980
        if "fill" in self.lights:
            self.lights["fill"].data.energy = 920 if record["shotId"] in ("earth", "solar", "return") else 650
        for body_id, body in self.bodies.items():
            base_scale = body.get("base_visual_scale_xyz", [1.0, 1.0, 1.0])
            plate_scale = float(effects.get("earthPlateScale", 1.0)) if body_id == "earth" else 1.0
            body.scale = tuple(float(value) * plate_scale for value in base_scale)
            body.rotation_mode = "XYZ"
            body.rotation_euler.z = float(record["timelineSeconds"]) * float(body.get("spin_rate", 0.0))


def requested_frames(plan, value: str):
    available = {int(record["frame"]): record for record in plan["frames"]}
    if not value:
        return [available[key] for key in sorted(available)]
    frames = []
    for token in value.split(","):
        frame = int(token.strip())
        if frame not in available:
            raise RuntimeError(f"Requested frame {frame} is not present in the offline plan.")
        frames.append(available[frame])
    return frames


def luminance_probe(path: Path):
    """Reject blank compositor output before it can masquerade as evidence."""
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        image.scale(32, 18)
        pixels = list(image.pixels[:])
        samples = max(1, len(pixels) // 4)
        luminance = []
        for index in range(0, len(pixels), 4):
            red, green, blue = pixels[index:index + 3]
            luminance.append(red * 0.2126 + green * 0.7152 + blue * 0.0722)
        mean_value = sum(luminance) / samples
        maximum = max(luminance, default=0.0)
        return {
            "mean": round(mean_value, 8),
            "maximum": round(maximum, 8),
            "nearBlack": maximum < 0.015 and mean_value < 0.002,
        }
    finally:
        bpy.data.images.remove(image)


def main():
    args = parse_arguments()
    plan_path = bounded(ROOT, args.plan)
    output_dir = bounded(ROOT, args.output_dir)
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    if plan.get("schemaVersion") != 1 or plan.get("purpose") != "authoritative-offline-render-input":
        raise RuntimeError("Unsupported or non-authoritative Voyage offline plan.")
    if plan.get("releaseEligible") is not False:
        raise RuntimeError("Offline plan lost its non-shipping truth boundary.")
    if not (320 <= args.width <= 7680 and 180 <= args.height <= 4320):
        raise RuntimeError("Render dimensions are outside the bounded production range.")
    if not (1 <= args.samples <= 512):
        raise RuntimeError("Render samples are outside the bounded production range.")
    output_dir.mkdir(parents=True, exist_ok=True)
    clear_scene()
    voyage = VoyageScene(plan, args)
    if args.save_blend:
        blend_path = bounded(ROOT, args.save_blend)
        blend_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), check_existing=False)

    extension = ".exr" if args.mode == "production" else ".png"
    report_files = []
    for record in requested_frames(plan, args.frames):
        frame = int(record["frame"])
        voyage.scene.frame_set(frame)
        voyage.apply(record)
        destination = output_dir / plan["variant"] / record["shotId"] / f"frame-{frame:04d}{extension}"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not (args.resume and destination.is_file() and destination.stat().st_size > 0):
            voyage.scene.render.filepath = str(destination)
            bpy.ops.render.render(write_still=True)
        probe = luminance_probe(destination)
        if probe["nearBlack"]:
            raise RuntimeError(
                f"Rendered frame {frame} is near-black; compositor/output validation failed."
            )
        report_files.append({
            "frame": frame,
            "shotId": record["shotId"],
            "path": destination.relative_to(ROOT).as_posix(),
            "bytes": destination.stat().st_size,
            "sha256": sha256(destination),
            "luminanceProbe": probe,
        })

    shot_ids = {record["shotId"] for record in report_files}
    frame_hashes = {record["sha256"] for record in report_files}
    if len(shot_ids) > 1 and len(frame_hashes) == 1:
        raise RuntimeError("Distinct Voyage shots produced byte-identical output; refusing the render report.")

    report = {
        "schemaVersion": 1,
        "status": "non-shipping-review" if args.mode != "production" else "unapproved-production-render",
        "releaseEligible": False,
        "planPath": plan_path.relative_to(ROOT).as_posix(),
        "planSha256": sha256(plan_path),
        "contractSha256": plan["contractSha256"],
        "variant": plan["variant"],
        "mode": args.mode,
        "renderer": {"name": "Blender", "version": bpy.app.version_string, "engine": voyage.scene.render.engine},
        "resolution": {"width": args.width, "height": args.height},
        "sampling": {
            "requested": args.samples,
            "effective": voyage.effective_samples,
            "controlled": voyage.effective_samples == args.samples,
        },
        "colorManagement": {
            "viewTransform": voyage.scene.view_settings.view_transform,
            "look": voyage.scene.view_settings.look,
            "exposure": voyage.scene.view_settings.exposure,
        },
        "lookdevPlatesEnabled": bool(args.lookdev_plates),
        "reviewPolish": voyage.review_polish,
        "frames": report_files,
        "truthBoundary": "A render report is technical evidence, not color, rights, protected-pixel, or creative approval.",
    }
    if args.lookdev_plates:
        report["lookdevProvenance"] = voyage.lookdev_provenance
    report_path = output_dir / f"render-report-{plan['variant']}-{args.mode}.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"VOYAGE_RENDER_REPORT={report_path}")


if __name__ == "__main__":
    main()
