"""Build the Constellore Moon Settlement Gate-1 modular kit in Blender.

The script is intentionally deterministic and headless-friendly. It creates a
packed, editable .blend source, a lit contact-sheet render, and uncompressed
portable GLBs for the standard and low browser tiers.

Run through scripts/moon-settlement-assets.mjs so paths and validation remain
bounded to this workspace.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Vector


ASSET_IDS = (
    "solar-power",
    "lunar-power",
    "bastion-shelter",
    "hive-shelter",
    "haven-shelter",
    "beacon-signal",
    "stars-signal",
    "starter-vault",
    "processor",
    "storage",
    "reservoir",
    "greenhouse",
)

PALETTE = {
    "hull": (0.72, 0.75, 0.75, 1.0),
    "graphite": (0.125, 0.157, 0.169, 1.0),
    "regolith": (0.466, 0.427, 0.392, 1.0),
    "power": (0.867, 0.667, 0.259, 1.0),
    "material": (0.710, 0.475, 0.306, 1.0),
    "life": (0.388, 0.682, 0.514, 1.0),
    "signal": (0.361, 0.639, 0.780, 1.0),
    "matter": (0.506, 0.455, 0.714, 1.0),
    "damage": (0.788, 0.333, 0.333, 1.0),
    "solar": (0.040, 0.120, 0.220, 1.0),
    "glass": (0.350, 0.720, 0.780, 0.36),
    "soil": (0.300, 0.160, 0.070, 1.0),
    "window": (0.035, 0.150, 0.200, 1.0),
    "ceramic": (0.800, 0.820, 0.790, 1.0),
    "warm": (0.950, 0.500, 0.120, 1.0),
    "trim": (0.220, 0.280, 0.280, 1.0),
}

MATERIAL_SETTINGS = {
    "hull": (0.52, 0.04, 0.0),
    "graphite": (0.40, 0.82, 0.0),
    "regolith": (0.92, 0.02, 0.0),
    "power": (0.46, 0.04, 0.025),
    "material": (0.38, 0.84, 0.0),
    "life": (0.50, 0.04, 0.0),
    "signal": (0.36, 0.05, 0.035),
    "matter": (0.34, 0.18, 0.075),
    "damage": (0.48, 0.05, 0.02),
    "solar": (0.22, 0.05, 0.0),
    "glass": (0.10, 0.0, 0.0),
    "soil": (0.94, 0.0, 0.0),
    "window": (0.14, 0.05, 0.0),
    "ceramic": (0.58, 0.03, 0.0),
    "warm": (0.42, 0.05, 0.045),
    "trim": (0.34, 0.88, 0.0),
}

NORMAL_STRENGTH = {
    "hull": 0.34,
    "graphite": 0.28,
    "regolith": 0.62,
    "power": 0.24,
    "material": 0.26,
    "life": 0.24,
    "signal": 0.22,
    "matter": 0.20,
    "damage": 0.38,
    "solar": 0.22,
    "glass": 0.08,
    "soil": 0.54,
    "window": 0.10,
    "ceramic": 0.30,
    "warm": 0.24,
    "trim": 0.25,
}

TILE_INDEX = {name: index for index, name in enumerate(PALETTE)}
PORT_MATERIAL = {
    "Power": "power",
    "Material": "material",
    "Life": "life",
    "Signal": "signal",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--review", required=True)
    argv = []
    if "--" in __import__("sys").argv:
        argv = __import__("sys").argv[__import__("sys").argv.index("--") + 1 :]
    return parser.parse_args(argv)


def srgb_to_linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def stable_seed(value: str) -> int:
    return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:8], 16)


def make_atlas(name: str, size: int, path: Path) -> bpy.types.Image:
    image = bpy.data.images.new(name, width=size, height=size, alpha=True)
    pixels = [0.0] * (size * size * 4)
    tile_size = size // 4
    for material_name, tile_index in TILE_INDEX.items():
        col = tile_index % 4
        row = tile_index // 4
        base = PALETTE[material_name]
        rng = random.Random(stable_seed(f"{name}:{material_name}"))
        scratches = [(rng.randrange(tile_size), rng.randrange(tile_size), rng.randrange(7, 19)) for _ in range(9)]
        for local_y in range(tile_size):
            for local_x in range(tile_size):
                edge = min(local_x, local_y, tile_size - local_x - 1, tile_size - local_y - 1)
                grain = (rng.random() - 0.5) * (0.025 if material_name not in {"glass", "window"} else 0.009)
                panel_line = 0.0
                if local_x in {2, tile_size - 3} or local_y in {2, tile_size - 3}:
                    panel_line = -0.075
                if material_name == "solar" and (local_x % max(4, tile_size // 8) <= 1 or local_y % max(4, tile_size // 8) <= 1):
                    panel_line += 0.065
                scratch = 0.0
                for sx, sy, length in scratches:
                    if abs(local_y - sy) <= 1 and sx <= local_x <= min(tile_size - 1, sx + length):
                        scratch = 0.055
                        break
                dust = 0.0
                if local_y < tile_size * 0.18 and material_name in {"hull", "graphite", "ceramic", "trim"}:
                    dust = -0.045 * (1.0 - local_y / (tile_size * 0.18))
                wear = 0.035 if edge < 2 and material_name not in {"glass", "window", "soil"} else 0.0
                factor = 1.0 + grain + panel_line + scratch + dust + wear
                x = col * tile_size + local_x
                y = row * tile_size + local_y
                offset = (y * size + x) * 4
                pixels[offset + 0] = srgb_to_linear(max(0.0, min(1.0, base[0] * factor)))
                pixels[offset + 1] = srgb_to_linear(max(0.0, min(1.0, base[1] * factor)))
                pixels[offset + 2] = srgb_to_linear(max(0.0, min(1.0, base[2] * factor)))
                pixels[offset + 3] = base[3]
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def set_input(node, name: str, value) -> None:
    socket = node.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def load_pbr_atlas_set(lod: str, root: Path) -> dict[str, bpy.types.Image]:
    atlases: dict[str, bpy.types.Image] = {}
    for channel in ("basecolor", "orm", "normal"):
        path = root / f"fieldkit-{channel}-{lod}.png"
        if not path.is_file():
            raise RuntimeError(f"Missing generated Moon settlement PBR atlas: {path}")
        image = bpy.data.images.load(str(path), check_existing=False)
        image.name = f"MoonSettlement_FieldKit_{channel}_{lod}"
        if channel != "basecolor":
            image.colorspace_settings.name = "Non-Color"
        image.pack()
        atlases[channel] = image
    return atlases


def make_material(name: str, material_name: str, lod: str, atlases: dict[str, bpy.types.Image]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    base_texture = nodes.new("ShaderNodeTexImage")
    base_texture.name = "FieldKit Base Color"
    base_texture.image = atlases["basecolor"]
    base_texture.interpolation = "Linear"
    base_texture.extension = "CLIP"
    links.new(base_texture.outputs["Color"], principled.inputs["Base Color"])

    orm_texture = nodes.new("ShaderNodeTexImage")
    orm_texture.name = "FieldKit ORM"
    orm_texture.image = atlases["orm"]
    orm_texture.interpolation = "Linear"
    orm_texture.extension = "CLIP"
    separate = nodes.new("ShaderNodeSeparateColor")
    links.new(orm_texture.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], principled.inputs["Roughness"])
    links.new(separate.outputs["Blue"], principled.inputs["Metallic"])

    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.name = "FieldKit Normal"
    normal_texture.image = atlases["normal"]
    normal_texture.interpolation = "Linear"
    normal_texture.extension = "CLIP"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.space = "TANGENT"
    normal_map.inputs["Strength"].default_value = NORMAL_STRENGTH[material_name]
    links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    roughness, metallic, emission = MATERIAL_SETTINGS[material_name]
    set_input(principled, "Roughness", roughness)
    set_input(principled, "Metallic", metallic)
    if emission:
        emission_color = PALETTE[material_name][:3] + (1.0,)
        set_input(principled, "Emission Color", emission_color)
        set_input(principled, "Emission", emission_color)
        set_input(principled, "Emission Strength", emission)
    if material_name == "glass":
        set_input(principled, "Alpha", 0.34 if lod == "standard" else 0.52)
        set_input(principled, "Transmission Weight", 0.12 if lod == "standard" else 0.0)
        set_input(principled, "IOR", 1.38)
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
        elif hasattr(material, "blend_method"):
            material.blend_method = "BLEND"
        material.use_transparency_overlap = False
    material.diffuse_color = PALETTE[material_name]
    material["constellore_material_role"] = material_name
    material["constellore_atlas_tile"] = TILE_INDEX[material_name]
    return material


def make_export_material(name: str, material_name: str, lod: str, atlas: bpy.types.Image) -> bpy.types.Material:
    """Create the lightweight portable fallback embedded in each GLB.

    The editable Blender source keeps the full PBR graph. The game applies one
    shared high-resolution PBR set after import, avoiding twelve copies of the
    same maps in network payloads while every standalone GLB retains a credible
    base-color fallback and exact material-role names.
    """
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = atlas
    texture.interpolation = "Linear"
    texture.extension = "CLIP"
    links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    roughness, metallic, emission = MATERIAL_SETTINGS[material_name]
    set_input(principled, "Roughness", roughness)
    set_input(principled, "Metallic", metallic)
    if emission:
        emission_color = PALETTE[material_name][:3] + (1.0,)
        set_input(principled, "Emission Color", emission_color)
        set_input(principled, "Emission", emission_color)
        set_input(principled, "Emission Strength", emission)
    if material_name == "glass":
        set_input(principled, "Alpha", 0.34 if lod == "standard" else 0.52)
        set_input(principled, "Transmission Weight", 0.12 if lod == "standard" else 0.0)
        set_input(principled, "IOR", 1.38)
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
        elif hasattr(material, "blend_method"):
            material.blend_method = "BLEND"
        material.use_transparency_overlap = False
    material.diffuse_color = PALETTE[material_name]
    material["constellore_material_role"] = material_name
    material["constellore_atlas_tile"] = TILE_INDEX[material_name]
    return material


@dataclass
class AssetBuilder:
    asset_id: str
    lod: str
    collection: bpy.types.Collection
    root: bpy.types.Object
    materials: dict[str, bpy.types.Material]
    radial: int
    bevel_segments: int

    def move_to_collection(self, obj: bpy.types.Object) -> bpy.types.Object:
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        self.collection.objects.link(obj)
        obj.parent = self.root
        return obj

    def apply(self, obj: bpy.types.Object, bevel: float = 0.0) -> bpy.types.Object:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel > 0.0 and obj.type == "MESH":
            modifier = obj.modifiers.new("FieldKit edge roll", "BEVEL")
            modifier.width = bevel
            modifier.segments = self.bevel_segments
            modifier.limit_method = "ANGLE"
            if hasattr(modifier, "harden_normals"):
                modifier.harden_normals = True
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
        return obj

    def remap_uv(self, obj: bpy.types.Object, material_name: str) -> None:
        if obj.type != "MESH" or not obj.data.uv_layers:
            return
        tile = TILE_INDEX[material_name]
        col = tile % 4
        row = tile // 4
        uv_layer = obj.data.uv_layers.active.data
        for loop in uv_layer:
            u = loop.uv.x - math.floor(loop.uv.x)
            v = loop.uv.y - math.floor(loop.uv.y)
            loop.uv.x = (col + 0.035 + u * 0.93) / 4.0
            loop.uv.y = (row + 0.035 + v * 0.93) / 4.0

    def smooth_mesh(self, obj: bpy.types.Object, keep_ngon_caps_flat: bool = False) -> None:
        """Smooth manufactured curves without rounding flat cylinder caps.

        The primitive builders deliberately retain separate objects for animation
        and interaction anchors, so this operates directly on exported polygon
        normals instead of relying on a viewport-only modifier.
        """
        if obj.type != "MESH":
            return
        for polygon in obj.data.polygons:
            polygon.use_smooth = not (keep_ngon_caps_flat and len(polygon.vertices) > 4)

    def finish(
        self,
        obj: bpy.types.Object,
        material_name: str,
        bevel: float = 0.0,
        smooth: bool = False,
        keep_ngon_caps_flat: bool = False,
    ) -> bpy.types.Object:
        self.move_to_collection(obj)
        self.apply(obj, bevel)
        if smooth:
            self.smooth_mesh(obj, keep_ngon_caps_flat)
        obj.data.materials.append(self.materials[material_name])
        self.remap_uv(obj, material_name)
        return obj

    def cube(self, name: str, location, dimensions, material: str, bevel: float = 0.035, rotation=(0, 0, 0)):
        bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = dimensions
        return self.finish(obj, material, bevel)

    def cylinder(self, name: str, location, radius: float, depth: float, material: str, vertices=None, rotation=(0, 0, 0), bevel: float = 0.02):
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices or self.radial, radius=radius, depth=depth, location=location, rotation=rotation)
        obj = bpy.context.object
        obj.name = name
        return self.finish(obj, material, bevel, smooth=True, keep_ngon_caps_flat=True)

    def cone(self, name: str, location, radius1: float, radius2: float, depth: float, material: str, rotation=(0, 0, 0), vertices=None, bevel: float = 0.018):
        bpy.ops.mesh.primitive_cone_add(vertices=vertices or self.radial, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
        obj = bpy.context.object
        obj.name = name
        return self.finish(obj, material, bevel, smooth=True, keep_ngon_caps_flat=True)

    def sphere(self, name: str, location, radius: float, material: str, scale=(1, 1, 1), segments=None, rings=None):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments or self.radial, ring_count=rings or max(6, self.radial // 2), radius=radius, location=location)
        obj = bpy.context.object
        obj.name = name
        obj.scale = scale
        self.finish(obj, material, 0.0, smooth=True)
        return obj

    def torus(self, name: str, location, major_radius: float, minor_radius: float, material: str, rotation=(0, 0, 0), major_segments=None, minor_segments=None):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=major_radius,
            minor_radius=minor_radius,
            major_segments=major_segments or self.radial,
            minor_segments=minor_segments or max(4, self.radial // 3),
            location=location,
            rotation=rotation,
        )
        obj = bpy.context.object
        obj.name = name
        return self.finish(obj, material, 0.0, smooth=True)

    def fastener_ring(
        self,
        name: str,
        center,
        radius: float,
        plane: str = "XY",
        count: int = 8,
        material: str = "ceramic",
        bolt_radius: float = 0.012,
        bolt_depth: float = 0.012,
        phase: float = 0.0,
    ) -> None:
        """Add a sparse, readable flange pattern without expensive micro-geometry."""
        visible_count = count if self.lod == "standard" else max(3, count // 2)
        cx, cy, cz = center
        for index in range(visible_count):
            angle = phase + index * math.tau / visible_count
            if plane == "XZ":
                location = (cx + math.cos(angle) * radius, cy, cz + math.sin(angle) * radius)
                rotation = (math.pi / 2, 0, 0)
            elif plane == "YZ":
                location = (cx, cy + math.cos(angle) * radius, cz + math.sin(angle) * radius)
                rotation = (0, math.pi / 2, 0)
            else:
                location = (cx + math.cos(angle) * radius, cy + math.sin(angle) * radius, cz)
                rotation = (0, 0, 0)
            self.cylinder(
                f"{name}_BOLT_{index}",
                location,
                bolt_radius,
                bolt_depth,
                material,
                vertices=6 if self.lod == "low" else 8,
                rotation=rotation,
                bevel=0.0,
            )

    def pipe(self, name: str, start, end, radius: float, material: str, vertices=None):
        start_v = Vector(start)
        end_v = Vector(end)
        delta = end_v - start_v
        midpoint = (start_v + end_v) * 0.5
        obj = self.cylinder(name, midpoint, radius, delta.length, material, vertices=vertices, bevel=0.0)
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
        return obj

    def empty(self, name: str, location, empty_type="PLAIN_AXES", size=0.12):
        obj = bpy.data.objects.new(name, None)
        obj.empty_display_type = empty_type
        obj.empty_display_size = size
        obj.location = location
        self.collection.objects.link(obj)
        obj.parent = self.root
        return obj


def add_common_anchors(builder: AssetBuilder, height: float, depth: float, ports: list[tuple[str, tuple[float, float, float]]]) -> None:
    builder.empty("LABEL_ANCHOR", (0, 0, height + 0.16), "SPHERE", 0.06)
    builder.empty("DOOR_FRONT", (0, -depth * 0.5 - 0.04, min(0.48, height * 0.46)), "ARROWS", 0.10)
    counts: dict[str, int] = {}
    for port_type, location in ports:
        index = counts.get(port_type, 0)
        counts[port_type] = index + 1
        builder.empty(f"SOCKET_{port_type}_{index}", location, "CIRCLE", 0.10)


def port(builder: AssetBuilder, port_type: str, location, rotation=(math.pi / 2, 0, 0), scale=1.0):
    material = PORT_MATERIAL[port_type]
    if port_type == "Power":
        return builder.cone(f"PORT_{port_type}", location, 0.105 * scale, 0.0, 0.075 * scale, material, vertices=3, rotation=rotation, bevel=0.0)
    if port_type == "Material":
        return builder.cylinder(f"PORT_{port_type}", location, 0.095 * scale, 0.07 * scale, material, vertices=6, rotation=rotation, bevel=0.005)
    if port_type == "Life":
        return builder.torus(f"PORT_{port_type}", location, 0.085 * scale, 0.022 * scale, material, rotation=rotation, major_segments=12, minor_segments=5)
    return builder.torus(f"PORT_{port_type}", location, 0.085 * scale, 0.016 * scale, material, rotation=rotation, major_segments=14, minor_segments=4)


def build_solar(builder: AssetBuilder):
    builder.cylinder("Solar_Base", (0, 0, 0.08), 0.28, 0.16, "graphite")
    # A single azimuth pedestal replaces the previous battery-shaped duplicate.
    builder.cylinder("Solar_Pedestal", (0, 0, 0.35), 0.14, 0.54, "hull", bevel=0.012)
    builder.torus("Solar_Azimuth_Bearing", (0, 0, 0.18), 0.17, 0.018, "ceramic")
    builder.cube("Solar_Service_Box", (0, -0.145, 0.32), (0.20, 0.10, 0.21), "graphite", bevel=0.012)
    builder.torus("Solar_Collar", (0, 0, 0.50), 0.18, 0.022, "power")
    builder.cylinder("Solar_Hinge", (0, 0, 0.66), 0.10, 0.50, "graphite", rotation=(0, math.pi / 2, 0))
    builder.fastener_ring("Solar_Base_Flange", (0, 0, 0.165), 0.22, count=8, material="ceramic", bolt_radius=0.010, bolt_depth=0.010)
    builder.pipe("Solar_Power_Loom", (0, -0.16, 0.36), (0, -0.09, 0.61), 0.012, "power", vertices=6 if builder.lod == "low" else 8)
    panel_width = 0.31 if builder.lod == "standard" else 0.30
    for side in (-1, 1):
        for index in (0, 1):
            x = side * (0.18 + index * 0.31)
            panel = builder.cube(
                f"ANIM_PANEL_{'LEFT' if side < 0 else 'RIGHT'}_{index}",
                (x, 0, 0.69 + 0.035 * index),
                (panel_width, 0.72, 0.045),
                "solar",
                bevel=0.018,
                rotation=(0, side * 0.08, side * -0.03),
            )
            if builder.lod == "standard":
                for rail in (-0.095, 0.095):
                    builder.cube(f"Panel_Rail_{side}_{index}_{rail}", (x + rail, 0, 0.724 + 0.035 * index), (0.014, 0.68, 0.018), "power", bevel=0.003)
                for edge_y in (-0.325, 0.325):
                    builder.cube(f"Panel_Frame_{side}_{index}_{edge_y}", (x, edge_y, 0.724 + 0.035 * index), (panel_width * 0.92, 0.014, 0.018), "ceramic", bevel=0.003)
            builder.pipe(
                f"Solar_Hinge_Link_{side}_{index}",
                (side * 0.16, 0, 0.66),
                (x - side * panel_width * 0.42, 0, 0.70 + 0.035 * index),
                0.014,
                "graphite",
                vertices=6,
            )
    port(builder, "Power", (0.19, -0.21, 0.18))
    port(builder, "Signal", (-0.19, -0.21, 0.18))
    add_common_anchors(builder, 0.93, 0.92, [("Power", (0.19, -0.25, 0.18)), ("Signal", (-0.19, -0.25, 0.18))])


def build_lunar_power(builder: AssetBuilder):
    builder.cylinder("Lunar_Base", (0, 0, 0.07), 0.46, 0.14, "regolith", vertices=builder.radial)
    builder.cylinder("Lunar_Core", (0, 0, 0.48), 0.24, 0.72, "graphite")
    builder.cylinder("Lunar_Glow", (0, 0, 0.52), 0.17, 0.54, "power")
    builder.torus("Lunar_Core_Ring", (0, 0, 0.52), 0.255, 0.027, "material")
    builder.fastener_ring("Lunar_Base_Flange", (0, 0, 0.145), 0.35, count=9, material="ceramic", bolt_radius=0.011, bolt_depth=0.010)
    builder.cube("Lunar_Service_Panel", (0, -0.247, 0.49), (0.20, 0.026, 0.27), "hull", bevel=0.010)
    for slot in (-0.055, 0.0, 0.055):
        builder.cube(f"Lunar_Service_Vent_{slot}", (slot, -0.264, 0.51), (0.026, 0.010, 0.13), "graphite", bevel=0.003)
    for index, angle in enumerate((0, 2 * math.pi / 3, 4 * math.pi / 3)):
        x, y = math.cos(angle) * 0.40, math.sin(angle) * 0.40
        builder.cone(f"Feed_Petal_{index}", (x, y, 0.22), 0.22, 0.10, 0.28, "hull", vertices=6, rotation=(0.30, 0, -angle))
        builder.pipe(f"Feed_Line_{index}", (x * 0.92, y * 0.92, 0.28), (x * 0.45, y * 0.45, 0.48), 0.025, "material", vertices=8)
    builder.cone("Lunar_Hopper", (0, 0, 0.95), 0.21, 0.10, 0.22, "hull", vertices=builder.radial)
    builder.torus("Lunar_Hopper_Lip", (0, 0, 1.045), 0.115, 0.012, "graphite")
    for angle in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
        builder.pipe(
            f"Lunar_Core_Brace_{angle}",
            (math.cos(angle) * 0.28, math.sin(angle) * 0.28, 0.15),
            (math.cos(angle) * 0.22, math.sin(angle) * 0.22, 0.70),
            0.015,
            "ceramic",
            vertices=6,
        )
    port(builder, "Power", (0.18, -0.39, 0.16))
    port(builder, "Material", (-0.18, -0.39, 0.16))
    add_common_anchors(builder, 1.06, 1.05, [("Power", (0.18, -0.46, 0.16)), ("Material", (-0.18, -0.46, 0.16))])


def build_bastion(builder: AssetBuilder):
    builder.cylinder("Bastion_Foundation", (0, 0, 0.08), 0.64, 0.16, "regolith", vertices=8)
    builder.cylinder("Bastion_Shell", (0, 0, 0.48), 0.56, 0.76, "hull", vertices=10 if builder.lod == "low" else 16)
    builder.cone("Bastion_Roof", (0, 0, 0.91), 0.53, 0.25, 0.22, "regolith", vertices=10 if builder.lod == "low" else 16)
    builder.torus("Bastion_Pressure_Seam_Low", (0, 0, 0.34), 0.555, 0.012, "ceramic")
    builder.torus("Bastion_Pressure_Seam_High", (0, 0, 0.69), 0.555, 0.012, "ceramic")
    for index, angle in enumerate((math.pi / 4, 3 * math.pi / 4, 5 * math.pi / 4, 7 * math.pi / 4)):
        x, y = math.cos(angle) * 0.58, math.sin(angle) * 0.58
        builder.cube(f"Bastion_Buttress_{index}", (x, y, 0.28), (0.18, 0.18, 0.52), "graphite", bevel=0.025, rotation=(0, 0, -angle))
        builder.cube(f"Bastion_Foot_{index}", (x, y, 0.075), (0.20, 0.20, 0.055), "regolith", bevel=0.010, rotation=(0, 0, -angle))
    builder.cube("Bastion_Airlock", (0, -0.58, 0.39), (0.42, 0.25, 0.58), "graphite", bevel=0.055)
    builder.cube("Bastion_Door", (0, -0.716, 0.39), (0.26, 0.024, 0.42), "signal", bevel=0.018)
    builder.fastener_ring("Bastion_Hatch", (0, -0.716, 0.39), 0.185, plane="XZ", count=8, material="ceramic", bolt_radius=0.010, bolt_depth=0.010, phase=math.pi / 8)
    builder.cube("Bastion_Service_Hatch", (0.43, -0.344, 0.48), (0.18, 0.025, 0.22), "graphite", bevel=0.010, rotation=(0, 0, -0.42))
    for x in (-0.30, 0.30):
        builder.cube(f"Bastion_Slit_{x}", (x, -0.515, 0.63), (0.14, 0.02, 0.08), "window", bevel=0.012)
    port(builder, "Power", (0.36, -0.50, 0.18))
    port(builder, "Material", (-0.36, -0.50, 0.18))
    add_common_anchors(builder, 1.02, 1.30, [("Power", (0.36, -0.64, 0.18)), ("Material", (-0.36, -0.64, 0.18))])


def build_hive(builder: AssetBuilder):
    builder.cylinder("Hive_Foundation", (0, 0, 0.06), 0.64, 0.12, "graphite", vertices=8)
    cells = ((-0.34, 0.08, 0.45, 0.38), (0.34, 0.08, 0.45, 0.38), (0, 0.25, 0.78, 0.42))
    for index, (x, y, z, radius) in enumerate(cells):
        builder.cylinder(f"Hive_Cell_{index}", (x, y, z), radius, radius * 1.30, "hull", vertices=10 if builder.lod == "low" else 16)
        builder.sphere(f"Hive_Dome_{index}", (x, y, z + radius * 0.60), radius * 0.98, "hull", scale=(1, 1, 0.58))
        builder.torus(f"Hive_Seam_{index}", (x, y, z + radius * 0.22), radius * 0.88, 0.025, "life")
        if index < 2:
            builder.cube(f"Hive_Service_Panel_{index}", (x, y - radius * 0.84, z), (0.16, 0.020, 0.16), "graphite", bevel=0.012)
    builder.pipe("Hive_Connector_Left", (-0.22, 0.13, 0.62), (-0.06, 0.21, 0.72), 0.13, "graphite", vertices=10 if builder.lod == "low" else 16)
    builder.pipe("Hive_Connector_Right", (0.22, 0.13, 0.62), (0.06, 0.21, 0.72), 0.13, "graphite", vertices=10 if builder.lod == "low" else 16)
    builder.cube("Hive_Airlock", (0, -0.46, 0.38), (0.40, 0.27, 0.55), "graphite", bevel=0.08)
    builder.cube("Hive_Door", (0, -0.604, 0.38), (0.25, 0.02, 0.38), "signal", bevel=0.03)
    builder.fastener_ring("Hive_Hatch", (0, -0.604, 0.38), 0.17, plane="XZ", count=8, material="ceramic", bolt_radius=0.010, bolt_depth=0.009, phase=math.pi / 8)
    for x in (-0.40, 0.40):
        builder.cube(f"Hive_Foot_{x}", (x, 0.08, 0.075), (0.23, 0.28, 0.055), "regolith", bevel=0.012)
    port(builder, "Power", (0.40, -0.43, 0.16))
    port(builder, "Life", (-0.40, -0.43, 0.16))
    add_common_anchors(builder, 1.22, 1.18, [("Power", (0.40, -0.58, 0.16)), ("Life", (-0.40, -0.58, 0.16))])


def build_haven(builder: AssetBuilder):
    builder.cylinder("Haven_Foundation", (0, 0, 0.06), 0.62, 0.12, "graphite", vertices=builder.radial)
    builder.sphere("Haven_Shell", (0, 0.08, 0.53), 0.62, "hull", scale=(1.0, 0.92, 0.78))
    builder.torus("Haven_Water_Band", (0, 0.08, 0.53), 0.57, 0.035, "signal")
    builder.torus("Haven_Shell_Seam_Low", (0, 0.08, 0.38), 0.575, 0.011, "ceramic")
    builder.torus("Haven_Shell_Seam_High", (0, 0.08, 0.69), 0.535, 0.011, "ceramic")
    builder.cube("Haven_Airlock", (0, -0.57, 0.39), (0.48, 0.33, 0.60), "hull", bevel=0.12)
    builder.cube("Haven_Door", (0, -0.744, 0.40), (0.29, 0.025, 0.42), "life", bevel=0.07)
    builder.fastener_ring("Haven_Hatch", (0, -0.744, 0.40), 0.19, plane="XZ", count=8, material="ceramic", bolt_radius=0.010, bolt_depth=0.009, phase=math.pi / 8)
    builder.cube("Haven_Window", (0, -0.519, 0.78), (0.52, 0.025, 0.16), "window", bevel=0.06)
    for x in (-0.24, 0.24):
        builder.cube(f"Haven_Window_Mullion_{x}", (x, -0.535, 0.78), (0.018, 0.012, 0.14), "ceramic", bevel=0.003)
    for x in (-0.47, 0.47):
        builder.pipe(f"Haven_Canopy_{x}", (x, -0.38, 0.20), (x * 0.90, 0.23, 0.91), 0.026, "ceramic", vertices=8)
    builder.cube("Haven_Life_Service", (0.47, 0.02, 0.35), (0.16, 0.22, 0.30), "graphite", bevel=0.025)
    port(builder, "Life", (0.38, -0.49, 0.16))
    port(builder, "Signal", (-0.38, -0.49, 0.16))
    add_common_anchors(builder, 1.06, 1.28, [("Life", (0.38, -0.64, 0.16)), ("Signal", (-0.38, -0.64, 0.16))])


def build_beacon(builder: AssetBuilder):
    builder.cylinder("Beacon_Base", (0, 0, 0.08), 0.35, 0.16, "graphite", vertices=8)
    builder.fastener_ring("Beacon_Base_Flange", (0, 0, 0.165), 0.27, count=9, material="ceramic", bolt_radius=0.010, bolt_depth=0.010)
    for index, angle in enumerate((0, 2 * math.pi / 3, 4 * math.pi / 3)):
        builder.pipe(f"Beacon_Leg_{index}", (math.cos(angle) * 0.28, math.sin(angle) * 0.28, 0.12), (math.cos(angle) * 0.12, math.sin(angle) * 0.12, 0.92), 0.035, "hull", vertices=8)
        builder.cylinder(
            f"Beacon_Foot_{index}",
            (math.cos(angle) * 0.28, math.sin(angle) * 0.28, 0.045),
            0.060,
            0.035,
            "regolith",
            vertices=8,
            bevel=0.006,
        )
    builder.cylinder("Beacon_Mast", (0, 0, 0.90), 0.065, 1.48, "graphite", vertices=10)
    for index, z in enumerate((0.53, 0.91, 1.27)):
        builder.torus(f"Beacon_Mast_Collar_{index}", (0, 0, z), 0.073, 0.012, "ceramic", major_segments=12, minor_segments=4)
    builder.torus("Beacon_Array_Low", (0, 0, 0.76), 0.24, 0.025, "signal")
    builder.torus("Beacon_Array_High", (0, 0, 1.20), 0.32, 0.028, "signal", rotation=(math.pi / 2, 0.22, 0))
    builder.cone("Beacon_Dish", (0.03, -0.06, 1.36), 0.28, 0.07, 0.16, "hull", rotation=(math.pi / 2 + 0.30, 0, 0), vertices=builder.radial)
    builder.torus("Beacon_Dish_Rim", (0.03, -0.06, 1.36), 0.272, 0.011, "ceramic", rotation=(math.pi / 2 + 0.30, 0, 0), major_segments=builder.radial, minor_segments=4)
    builder.pipe("Beacon_Dish_Feed", (0.03, -0.05, 1.36), (0.03, -0.19, 1.42), 0.014, "signal", vertices=6)
    builder.pipe("Beacon_Signal_Loom", (-0.05, -0.02, 0.42), (-0.04, -0.08, 1.28), 0.010, "signal", vertices=6)
    builder.sphere("Beacon_Light", (0, 0, 1.56), 0.095, "signal")
    port(builder, "Power", (0.17, -0.26, 0.16))
    port(builder, "Signal", (-0.17, -0.26, 0.16))
    add_common_anchors(builder, 1.66, 0.72, [("Power", (0.17, -0.34, 0.16)), ("Signal", (-0.17, -0.34, 0.16))])


def build_star_map(builder: AssetBuilder):
    builder.cylinder("StarMap_Base", (0, 0, 0.09), 0.50, 0.18, "graphite", vertices=builder.radial)
    builder.cylinder("StarMap_Platform", (0, 0, 0.27), 0.39, 0.22, "hull", vertices=builder.radial)
    builder.fastener_ring("StarMap_Base_Flange", (0, 0, 0.185), 0.40, count=10, material="ceramic", bolt_radius=0.010, bolt_depth=0.010)
    builder.cube("StarMap_Control_Deck", (0, -0.34, 0.32), (0.34, 0.16, 0.16), "graphite", bevel=0.020)
    builder.cube("StarMap_Control_Screen", (0, -0.427, 0.34), (0.22, 0.012, 0.085), "signal", bevel=0.008)
    builder.torus("ANIM_GIMBAL_X", (0, 0, 0.82), 0.42, 0.028, "signal", rotation=(math.pi / 2, 0, 0))
    builder.torus("ANIM_GIMBAL_Y", (0, 0, 0.82), 0.42, 0.028, "matter", rotation=(0, math.pi / 2, 0.35))
    builder.torus("StarMap_Gimbal_Z", (0, 0, 0.82), 0.42, 0.022, "ceramic", rotation=(0.25, 0.0, 0))
    for side in (-1, 1):
        builder.cylinder(f"StarMap_Gimbal_Bearing_{side}", (side * 0.415, 0, 0.82), 0.060, 0.070, "graphite", vertices=10, rotation=(0, math.pi / 2, 0), bevel=0.008)
        builder.pipe(f"StarMap_Gimbal_Cable_{side}", (side * 0.32, -0.05, 0.52), (side * 0.39, -0.02, 0.78), 0.010, "signal", vertices=6)
    builder.sphere("StarMap_Core", (0, 0, 0.82), 0.17, "matter")
    for index, direction in enumerate(((0.22, 0.12, 1.05), (-0.26, 0.06, 0.90), (0.08, -0.27, 0.68))):
        builder.sphere(f"Star_Point_{index}", direction, 0.025 if builder.lod == "standard" else 0.035, "signal", segments=8, rings=5)
    port(builder, "Signal", (0.24, -0.41, 0.17))
    port(builder, "Life", (-0.24, -0.41, 0.17))
    add_common_anchors(builder, 1.30, 1.12, [("Signal", (0.24, -0.51, 0.17)), ("Life", (-0.24, -0.51, 0.17))])


def build_vault(builder: AssetBuilder):
    builder.cube("Vault_Shock_Base", (0, 0, 0.09), (0.82, 0.66, 0.18), "graphite", bevel=0.06)
    builder.cylinder("Vault_Capsule", (0, 0, 0.48), 0.30, 0.74, "hull", rotation=(0, math.pi / 2, 0))
    builder.cylinder("Vault_Window", (0, -0.012, 0.49), 0.225, 0.76, "glass", rotation=(0, math.pi / 2, 0), bevel=0.0)
    for x in (-0.37, 0.37):
        builder.torus(f"Vault_Collar_{x}", (x, 0, 0.48), 0.31, 0.035, "material", rotation=(0, math.pi / 2, 0))
        builder.fastener_ring(f"Vault_Endcap_{x}", (x, 0, 0.48), 0.255, plane="YZ", count=8, material="ceramic", bolt_radius=0.009, bolt_depth=0.010, phase=math.pi / 8)
    for x in (-0.22, 0, 0.22):
        builder.cylinder(f"Vault_Seed_{x}", (x, -0.03, 0.48), 0.055, 0.36, "life", rotation=(math.pi / 2, 0, 0), vertices=10)
    for x in (-0.30, 0.30):
        builder.cube(f"Vault_Shock_Mount_{x}", (x, 0.22, 0.17), (0.15, 0.14, 0.20), "regolith", bevel=0.018)
    builder.pipe("Vault_Cryo_Line", (-0.28, -0.235, 0.26), (0.27, -0.235, 0.26), 0.012, "life", vertices=6)
    builder.cube("Vault_Control_Panel", (0, -0.326, 0.25), (0.23, 0.018, 0.14), "graphite", bevel=0.010)
    builder.cube("STATE_DAMAGED", (0.29, -0.30, 0.75), (0.16, 0.07, 0.10), "damage", bevel=0.025, rotation=(0.0, 0.15, 0.0))
    builder.torus("STATE_REPAIRED", (-0.29, -0.30, 0.75), 0.055, 0.014, "life", rotation=(math.pi / 2, 0, 0), major_segments=10, minor_segments=4)
    port(builder, "Life", (0.26, -0.34, 0.17))
    port(builder, "Material", (-0.26, -0.34, 0.17))
    add_common_anchors(builder, 0.84, 0.78, [("Life", (0.26, -0.40, 0.17)), ("Material", (-0.26, -0.40, 0.17))])


def build_processor(builder: AssetBuilder):
    builder.cylinder("Processor_Base", (0, 0, 0.08), 0.58, 0.16, "graphite", vertices=8)
    builder.fastener_ring("Processor_Base_Flange", (0, 0, 0.165), 0.47, count=10, material="ceramic", bolt_radius=0.011, bolt_depth=0.010)
    builder.cylinder("ANIM_DRUM", (0, 0, 0.62), 0.34, 0.76, "hull", rotation=(0, math.pi / 2, 0))
    builder.torus("Processor_Drum_Ring_A", (-0.25, 0, 0.62), 0.35, 0.035, "material", rotation=(0, math.pi / 2, 0))
    builder.torus("Processor_Drum_Ring_B", (0.25, 0, 0.62), 0.35, 0.035, "material", rotation=(0, math.pi / 2, 0))
    for side in (-1, 1):
        builder.cylinder(f"Processor_Bearing_{side}", (side * 0.39, 0, 0.62), 0.12, 0.075, "graphite", vertices=10, rotation=(0, math.pi / 2, 0), bevel=0.010)
        builder.pipe(f"Processor_Hopper_Brace_{side}", (side * 0.34, 0.10, 0.68), (side * 0.24, 0.08, 1.10), 0.018, "ceramic", vertices=6)
    builder.cone("Processor_Hopper", (0, 0.08, 1.15), 0.38, 0.16, 0.36, "regolith", vertices=builder.radial)
    builder.torus("Processor_Hopper_Rim", (0, 0.08, 1.315), 0.17, 0.012, "graphite")
    builder.pipe("Processor_Feed", (0, 0.02, 0.96), (0, 0, 0.78), 0.075, "graphite", vertices=10)
    builder.cube("STATE_EARTH_TRAY", (-0.35, -0.39, 0.22), (0.42, 0.32, 0.18), "life", bevel=0.04)
    builder.cube("STATE_DUST_TRAY", (0.35, -0.39, 0.22), (0.42, 0.32, 0.18), "regolith", bevel=0.04)
    builder.pipe("Processor_Tray_Rail", (-0.51, -0.52, 0.13), (0.51, -0.52, 0.13), 0.014, "ceramic", vertices=6)
    builder.cube("Processor_Access_Panel", (0, -0.346, 0.62), (0.24, 0.018, 0.24), "graphite", bevel=0.012)
    builder.fastener_ring("Processor_Access", (0, -0.358, 0.62), 0.13, plane="XZ", count=6, material="ceramic", bolt_radius=0.008, bolt_depth=0.008)
    builder.pipe("Processor_Exhaust", (0.38, 0.20, 0.54), (0.50, 0.25, 1.00), 0.045, "graphite", vertices=8)
    builder.cone("Processor_Exhaust_Shroud", (0.50, 0.25, 1.00), 0.080, 0.052, 0.12, "ceramic", rotation=(0.24, -0.10, 0), vertices=8, bevel=0.006)
    port(builder, "Power", (0.32, -0.49, 0.13))
    port(builder, "Material", (-0.32, -0.49, 0.13))
    add_common_anchors(builder, 1.34, 1.18, [("Power", (0.32, -0.59, 0.13)), ("Material", (-0.32, -0.59, 0.13))])


def build_storage(builder: AssetBuilder):
    builder.cube("Storage_Rack_Base", (0, 0, 0.08), (1.22, 0.74, 0.16), "graphite", bevel=0.045)
    for index, x in enumerate((-0.39, 0, 0.39)):
        builder.cylinder(f"Storage_Canister_{index}", (x, 0.05, 0.49), 0.18, 0.72, "hull", vertices=12 if builder.lod == "low" else 18)
        builder.torus(f"Storage_Collar_{index}", (x, 0.05, 0.64), 0.185, 0.023, "material")
        builder.torus(f"Storage_Lower_Collar_{index}", (x, 0.05, 0.33), 0.185, 0.018, "graphite")
        builder.cylinder(f"Storage_Valve_{index}", (x, -0.137, 0.71), 0.035, 0.035, "material", vertices=8, rotation=(math.pi / 2, 0, 0), bevel=0.005)
        builder.cube(f"Storage_Latch_{index}", (x, -0.153, 0.33), (0.08, 0.024, 0.10), "ceramic", bevel=0.007)
        builder.cube(f"LEVEL_{index + 1}", (x, -0.168, 0.50), (0.11, 0.018, 0.36), "signal" if index < 2 else "life", bevel=0.012)
    builder.cube("LEVEL_0", (0, -0.30, 0.18), (1.0, 0.10, 0.09), "regolith", bevel=0.015)
    builder.pipe("Storage_Access_Rail", (-0.56, -0.31, 0.25), (0.56, -0.31, 0.25), 0.025, "ceramic", vertices=8)
    builder.pipe("Storage_Back_Brace_A", (-0.56, 0.29, 0.17), (0.56, 0.29, 0.78), 0.018, "graphite", vertices=6)
    builder.pipe("Storage_Back_Brace_B", (0.56, 0.29, 0.17), (-0.56, 0.29, 0.78), 0.018, "graphite", vertices=6)
    port(builder, "Material", (0.38, -0.32, 0.13))
    port(builder, "Signal", (-0.38, -0.32, 0.13))
    add_common_anchors(builder, 0.91, 0.86, [("Material", (0.38, -0.42, 0.13)), ("Signal", (-0.38, -0.42, 0.13))])


def build_reservoir(builder: AssetBuilder):
    builder.cylinder("Reservoir_Base", (0, 0, 0.08), 0.43, 0.16, "graphite", vertices=builder.radial)
    builder.fastener_ring("Reservoir_Base_Flange", (0, 0, 0.165), 0.34, count=9, material="ceramic", bolt_radius=0.010, bolt_depth=0.010)
    for index, angle in enumerate((0, 2 * math.pi / 3, 4 * math.pi / 3)):
        x, y = math.cos(angle) * 0.35, math.sin(angle) * 0.35
        builder.pipe(f"Reservoir_Strut_{index}", (x, y, 0.14), (x * 0.72, y * 0.72, 0.72), 0.035, "hull", vertices=8)
    builder.sphere("ANIM_MATTER_CORE", (0, 0, 0.74), 0.25, "matter", scale=(0.86, 0.86, 1.12), segments=12 if builder.lod == "low" else 20, rings=8 if builder.lod == "low" else 12)
    for index, (radius, z) in enumerate(((0.30, 0.48), (0.38, 0.74), (0.30, 1.00))):
        builder.torus(f"LEVEL_{index + 1}", (0, 0, z), radius, 0.026, "signal" if index != 1 else "matter", rotation=(0.12 * index, 0.10, 0))
    builder.cylinder("LEVEL_0", (0, 0, 0.22), 0.18, 0.12, "regolith", vertices=8)
    builder.cube("Reservoir_Control_Box", (0, -0.315, 0.37), (0.23, 0.13, 0.27), "graphite", bevel=0.018)
    builder.cube("Reservoir_Control_Face", (0, -0.386, 0.39), (0.14, 0.016, 0.13), "signal", bevel=0.007)
    builder.pipe("Reservoir_Power_Loom", (0.11, -0.30, 0.28), (0.20, -0.18, 0.68), 0.012, "power", vertices=6)
    builder.torus("Reservoir_Containment_Collar", (0, 0, 1.02), 0.17, 0.014, "ceramic", major_segments=builder.radial, minor_segments=4)
    port(builder, "Signal", (0.24, -0.34, 0.15))
    port(builder, "Material", (-0.24, -0.34, 0.15))
    add_common_anchors(builder, 1.18, 0.96, [("Signal", (0.24, -0.44, 0.15)), ("Material", (-0.24, -0.44, 0.15))])


def build_greenhouse(builder: AssetBuilder):
    builder.cylinder("Greenhouse_Foundation", (0, 0, 0.07), 0.68, 0.14, "graphite", vertices=builder.radial)
    builder.fastener_ring("Greenhouse_Base_Flange", (0, 0, 0.145), 0.57, count=12, material="ceramic", bolt_radius=0.010, bolt_depth=0.010)
    builder.sphere("Greenhouse_Glass", (0, 0.05, 0.61), 0.67, "glass", scale=(1.0, 0.97, 0.77), segments=builder.radial, rings=max(8, builder.radial // 2))
    builder.torus("Greenhouse_Base_Rib", (0, 0.05, 0.36), 0.64, 0.028, "life")
    builder.torus("Greenhouse_Rib_A", (0, 0.05, 0.62), 0.62, 0.025, "ceramic", rotation=(math.pi / 2, 0, 0))
    builder.torus("Greenhouse_Rib_B", (0, 0.05, 0.62), 0.62, 0.025, "ceramic", rotation=(math.pi / 2, 0, math.pi / 2))
    builder.torus("Greenhouse_Rib_C", (0, 0.05, 0.62), 0.62, 0.016, "ceramic", rotation=(math.pi / 2, 0, math.pi / 4), major_segments=builder.radial, minor_segments=4)
    builder.torus("Greenhouse_Rib_D", (0, 0.05, 0.62), 0.62, 0.016, "ceramic", rotation=(math.pi / 2, 0, -math.pi / 4), major_segments=builder.radial, minor_segments=4)
    builder.cube("Greenhouse_Airlock", (0, -0.62, 0.40), (0.42, 0.32, 0.58), "hull", bevel=0.10)
    builder.cube("Greenhouse_Door", (0, -0.79, 0.40), (0.25, 0.02, 0.40), "life", bevel=0.06)
    builder.fastener_ring("Greenhouse_Hatch", (0, -0.79, 0.40), 0.18, plane="XZ", count=8, material="ceramic", bolt_radius=0.010, bolt_depth=0.008, phase=math.pi / 8)
    for side in (-1, 1):
        builder.cube(f"Planter_{side}", (side * 0.29, 0.08, 0.25), (0.34, 0.72, 0.20), "soil", bevel=0.035)
        for row in range(3):
            y = -0.15 + row * 0.23
            builder.sphere(f"CROP_SOCKET_{'L' if side < 0 else 'R'}_{row}", (side * 0.29, y, 0.40), 0.065, "life", scale=(1.0, 1.0, 1.35), segments=8 if builder.lod == "low" else 12, rings=5 if builder.lod == "low" else 7)
        builder.pipe(f"Greenhouse_Irrigation_{side}", (side * 0.29, -0.23, 0.35), (side * 0.29, 0.38, 0.35), 0.010, "signal", vertices=6)
    builder.pipe("Greenhouse_Irrigation_Header", (-0.47, 0.36, 0.35), (0.47, 0.36, 0.35), 0.014, "signal", vertices=6)
    for x in (-0.50, 0.50):
        builder.cube(f"Greenhouse_Foot_{x}", (x, 0, 0.075), (0.18, 0.24, 0.055), "regolith", bevel=0.010)
    builder.cube("STATE_EMPTY", (0, 0.28, 0.18), (0.12, 0.22, 0.08), "regolith", bevel=0.015)
    builder.sphere("STATE_GROWING", (0, 0.28, 0.37), 0.055, "life", scale=(1, 1, 1.4), segments=8, rings=5)
    builder.sphere("STATE_READY", (0, 0.28, 0.48), 0.045, "warm", segments=8, rings=5)
    port(builder, "Power", (0.39, -0.53, 0.15))
    port(builder, "Life", (-0.39, -0.53, 0.15))
    port(builder, "Material", (0, 0.61, 0.15), rotation=(-math.pi / 2, 0, 0))
    add_common_anchors(builder, 1.20, 1.34, [("Power", (0.39, -0.67, 0.15)), ("Life", (-0.39, -0.67, 0.15)), ("Material", (0, 0.67, 0.15))])


BUILDERS = {
    "solar-power": build_solar,
    "lunar-power": build_lunar_power,
    "bastion-shelter": build_bastion,
    "hive-shelter": build_hive,
    "haven-shelter": build_haven,
    "beacon-signal": build_beacon,
    "stars-signal": build_star_map,
    "starter-vault": build_vault,
    "processor": build_processor,
    "storage": build_storage,
    "reservoir": build_reservoir,
    "greenhouse": build_greenhouse,
}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material)
    for image in list(bpy.data.images):
        bpy.data.images.remove(image)


def create_collection(asset_id: str, lod: str) -> tuple[bpy.types.Collection, bpy.types.Object]:
    collection = bpy.data.collections.new(f"SM_{asset_id.upper().replace('-', '_')}__{lod.upper()}")
    bpy.context.scene.collection.children.link(collection)
    root = bpy.data.objects.new(f"SM_{asset_id.upper().replace('-', '_')}_ROOT", None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.18
    root["constellore_asset_id"] = asset_id
    root["constellore_lod"] = lod
    collection.objects.link(root)
    return collection, root


def iter_collection_objects(collection: bpy.types.Collection):
    for obj in collection.objects:
        yield obj
    for child in collection.children:
        yield from iter_collection_objects(child)


def export_collection(collection: bpy.types.Collection, output_path: Path, export_materials: dict[str, bpy.types.Material]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    selected = list(iter_collection_objects(collection))
    swapped_slots = []
    for obj in selected:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
        if obj.type == "MESH":
            for slot in obj.material_slots:
                original = slot.material
                role = original.get("constellore_material_role") if original else None
                if role in export_materials:
                    swapped_slots.append((slot, original))
                    slot.material = export_materials[role]
    bpy.context.view_layer.objects.active = next((obj for obj in selected if obj.type == "MESH"), selected[0])
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(output_path),
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_texcoords=True,
            export_normals=True,
            export_tangents=False,
            export_materials="EXPORT",
            export_image_format="AUTO",
            export_cameras=False,
            export_lights=False,
            export_animations=False,
            export_draco_mesh_compression_enable=False,
        )
    finally:
        for slot, original in swapped_slots:
            slot.material = original
    for obj in selected:
        obj.select_set(False)


def look_at(obj: bpy.types.Object, target) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_review_scene(standard_roots: list[bpy.types.Object], review_path: Path) -> None:
    positions = []
    for index in range(len(standard_roots)):
        positions.append(((index % 4 - 1.5) * 3.05, (index // 4 - 1.0) * 3.05, 0.0))
    for root, position in zip(standard_roots, positions):
        root.location = position

    for collection in bpy.data.collections:
        if collection.name.endswith("__LOW"):
            collection.hide_render = True
            collection.hide_viewport = True

    bpy.ops.mesh.primitive_plane_add(size=15, location=(0, 0, -0.035))
    ground = bpy.context.object
    ground.name = "REVIEW_MOON_GROUND"
    ground_mat = bpy.data.materials.new("Review moon ground")
    ground_mat.diffuse_color = (0.055, 0.052, 0.050, 1.0)
    ground_mat.use_nodes = True
    bsdf = ground_mat.node_tree.nodes.get("Principled BSDF")
    set_input(bsdf, "Base Color", (0.055, 0.052, 0.050, 1.0))
    set_input(bsdf, "Roughness", 0.94)
    ground.data.materials.append(ground_mat)

    camera_data = bpy.data.cameras.new("Gate1_Review_Camera")
    camera = bpy.data.objects.new("Gate1_Review_Camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (12.8, -19.4, 14.2)
    camera_data.lens = 58
    look_at(camera, (0, 0.4, 0.45))
    bpy.context.scene.camera = camera

    def area_light(name, location, energy, color, size):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.color = color
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        bpy.context.scene.collection.objects.link(light)
        light.location = location
        look_at(light, (0, 0, 0.5))
        return light

    area_light("Warm lunar key", (-6, -7, 11), 1550, (1.0, 0.78, 0.55), 6.0)
    area_light("Cool settlement fill", (8, -1, 6), 1100, (0.38, 0.70, 1.0), 5.0)
    area_light("Semantic rim", (0, 8, 7), 1300, (0.34, 1.0, 0.82), 4.0)

    scene = bpy.context.scene
    # Blender 5.x exposes the modern Eevee engine under BLENDER_EEVEE.
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(review_path)
    scene.render.film_transparent = False
    scene.world.color = (0.002, 0.006, 0.012)
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.65
    scene.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    workspace = Path(args.workspace).resolve()
    output = Path(args.output).resolve()
    source = Path(args.source).resolve()
    review = Path(args.review).resolve()
    for path in (output, source.parent, review.parent, source.parent / "textures"):
        path.mkdir(parents=True, exist_ok=True)

    if workspace not in output.parents or workspace not in source.parents or workspace not in review.parents:
        raise RuntimeError("All Moon settlement outputs must remain inside the workspace.")

    clear_scene()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene["constellore_asset_contract"] = "moon-settlement-gate1-v1"
    scene["constellore_front_axis"] = "-Y"
    scene["constellore_ground_plane"] = "Z=0"

    pbr_root = source.parent / "textures" / "pbr"
    atlases = {lod: load_pbr_atlas_set(lod, pbr_root) for lod in ("standard", "low")}
    export_atlases = {
        "standard": make_atlas("MoonSettlement_FieldKit_Export_Standard", 512, source.parent / "textures" / "fieldkit-standard.png"),
        "low": make_atlas("MoonSettlement_FieldKit_Export_Low", 256, source.parent / "textures" / "fieldkit-low.png"),
    }
    material_sets = {}
    export_material_sets = {}
    for lod in ("standard", "low"):
        material_sets[lod] = {
            material_name: make_material(f"MSPBR_{lod}_{material_name}", material_name, lod, atlases[lod])
            for material_name in PALETTE
        }
        export_material_sets[lod] = {
            material_name: make_export_material(f"MS_{lod}_{material_name}", material_name, lod, export_atlases[lod])
            for material_name in PALETTE
        }

    collections = {}
    standard_roots = []
    metrics = {}
    for lod in ("standard", "low"):
        for asset_id in ASSET_IDS:
            collection, root = create_collection(asset_id, lod)
            radial = 20 if lod == "standard" else 10
            builder = AssetBuilder(asset_id, lod, collection, root, material_sets[lod], radial, 2 if lod == "standard" else 1)
            BUILDERS[asset_id](builder)
            collections[(asset_id, lod)] = collection
            if lod == "standard":
                standard_roots.append(root)

    for lod in ("standard", "low"):
        for asset_id in ASSET_IDS:
            path = output / f"{asset_id}-{lod}.glb"
            export_collection(collections[(asset_id, lod)], path, export_material_sets[lod])
            mesh_objects = [obj for obj in iter_collection_objects(collections[(asset_id, lod)]) if obj.type == "MESH"]
            triangles = sum(len(obj.data.loop_triangles) or (obj.data.calc_loop_triangles() or len(obj.data.loop_triangles)) for obj in mesh_objects)
            metrics[f"{asset_id}-{lod}"] = {"meshes": len(mesh_objects), "triangles": triangles, "file": path.name}

    setup_review_scene(standard_roots, review)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(source), check_existing=False)

    build_report = source.parent.parent / "blender-build-report.json"
    build_report.write_text(json.dumps({"assets": list(ASSET_IDS), "metrics": metrics}, indent=2), encoding="utf-8")
    print(f"MOON_SETTLEMENT_KIT_OK {len(ASSET_IDS) * 2} GLBs")
    print(f"MOON_SETTLEMENT_SOURCE {source}")
    print(f"MOON_SETTLEMENT_REVIEW {review}")


if __name__ == "__main__":
    main()
