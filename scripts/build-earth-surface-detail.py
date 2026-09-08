"""Build licensed Earth surface derivatives without rebuilding the base GLB.

The base model remains the immediate fallback. These optional maps use the
packaged glTF UV convention (south at the top, flipY=false) and load progressively.
Run: python scripts/build-earth-surface-detail.py
"""
from pathlib import Path
import hashlib
import json
import io
import struct
from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'itch-assets/Models/Earth/textures/earth albedo.jpg'
MANIFEST = ROOT / 'public/art/planet-hub/manifest.json'
OUTPUT = ROOT / 'public/art/planet-hub/details'

def main():
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    source = Image.open(SOURCE).convert('RGB')
    source_bytes = SOURCE.read_bytes()
    source_hash = hashlib.sha256(source_bytes).hexdigest()
    manifest.setdefault('sources', {})[SOURCE.relative_to(ROOT).as_posix()] = {
        'bytes': len(source_bytes), 'sha256': source_hash
    }
    # The authored cloud material contains matching grayscale RGB and coverage
    # alpha. One non-color coverage map replaces two duplicated channels.
    cloud_source = ROOT / 'itch-assets/Models/Earth/Earth8K.glb'
    glb = cloud_source.read_bytes()
    json_length = struct.unpack_from('<I', glb, 12)[0]
    document = json.loads(glb[20:20 + json_length])
    material = next(m for m in document['materials'] if m.get('name') == 'lambert6')
    texture_index = material['pbrMetallicRoughness']['baseColorTexture']['index']
    texture = document['textures'][texture_index]
    image_record = document['images'][texture['source']]
    view = document['bufferViews'][image_record['bufferView']]
    offset = 28 + json_length + view.get('byteOffset', 0)
    cloud_image = Image.open(io.BytesIO(glb[offset:offset + view['byteLength']])).convert('RGBA')
    cloud_coverage = cloud_image.getchannel('A')
    cloud_hash = hashlib.sha256(glb).hexdigest()
    for tier, width, quality in [('low', 2048, 86), ('standard', 4096, 90)]:
        name = f'earth-albedo-{tier}.webp'
        dest = OUTPUT / name
        image = source.resize((width, width // 2), Image.Resampling.LANCZOS).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        image.save(dest, 'WEBP', quality=quality, method=6)
        data = dest.read_bytes()
        record = {
            'url': f'./art/planet-hub/details/{name}',
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'width': width, 'height': width // 2, 'mimeType': 'image/webp',
            'colorSpace': 'srgb', 'usage': 'earth-progressive-albedo',
            'authored': True, 'derived': False, 'channels': 'rgb', 'hasAlpha': False,
            'lumaStdDev': round(ImageStat.Stat(image.convert('L')).stddev[0], 6),
            'source': {'file': str(SOURCE.relative_to(ROOT)).replace('\\', '/'), 'sha256': source_hash},
            'transform': 'lanczos-resize; vertical-flip-to-packaged-gltf-uv',
            'initialScene': False, 'loadPolicy': 'progressive-after-ready'
        }
        details = manifest['optionalDetails']['tiers'][tier]
        previous_bytes = details['earth'].get('albedo', {}).get('bytes', 0)
        details['earth']['albedo'] = record
        delta = len(data) - previous_bytes
        details['bytes'] += delta
        manifest['optionalDetails']['bytes'] += delta
        print(f'{name}: {len(data):,} bytes; {width}x{width//2}', flush=True)
        cloud_width = 2048 if tier == 'standard' else 1024
        cloud_name = f'earth-clouds-{tier}.webp'
        cloud_dest = OUTPUT / cloud_name
        coverage = cloud_coverage.resize((cloud_width, cloud_width // 2), Image.Resampling.LANCZOS).convert('RGB')
        coverage.save(cloud_dest, 'WEBP', quality=88, method=6)
        cloud_data = cloud_dest.read_bytes()
        previous_cloud = details['earth']['clouds']
        cloud_record = {
            **previous_cloud, 'bytes': len(cloud_data),
            'sha256': hashlib.sha256(cloud_data).hexdigest(),
            'colorSpace': 'linear', 'usage': 'earth-cloud-coverage',
            'channels': 'rgb-coverage', 'hasAlpha': False,
            'source': {'model': str(cloud_source.relative_to(ROOT)).replace('\\', '/'),
                       'sha256': cloud_hash, 'material': 'lambert6', 'slot': 'baseColor.alpha'},
            'transform': 'authored-alpha-to-rgb-coverage; lanczos-resize',
            'lumaStdDev': round(ImageStat.Stat(coverage.convert('L')).stddev[0], 6)
        }
        cloud_delta = len(cloud_data) - previous_cloud['bytes']
        details['earth']['clouds'] = cloud_record
        details['bytes'] += cloud_delta
        manifest['optionalDetails']['bytes'] += cloud_delta
        print(f'{cloud_name}: {len(cloud_data):,} bytes; one authored coverage channel', flush=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    main()
