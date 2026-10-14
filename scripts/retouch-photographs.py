"""Conventional, reproducible photo adjustments. Originals are opened read-only.

No synthesized image content, learned models, object edits, crops, or geometry changes.
Recipes describe luminance curves, smooth dodge/burn masks and saturation.
"""
import argparse
import gc
import hashlib
import io
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageCms, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / '.curation/editing-trial-2026-10-14/python-packages'
if VENDOR.exists():
    sys.path.insert(0, str(VENDOR))
import tifffile


def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def review_rgb(image, profile, srgb):
    """Apply identical display conversion to the before and after images."""
    return ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(profile)),
                                   ImageCms.ImageCmsProfile(io.BytesIO(srgb)),
                                   outputMode='RGB', renderingIntent=1)


def save_new_image(image, path, **options):
    with path.open('xb') as handle:
        image.save(handle, format='JPEG', **options)


def process(source, recipe, output, srgb):
    path = Path(source['path']).resolve()
    assert digest(path) == source['sha256'], 'Source version differs from the recipe'
    assert not path.is_relative_to(output), 'Input and output must be separate'
    opened = Image.open(path)
    assert opened.format in ('JPEG', 'MPO'), 'This trial accepts full source JPEGs only'
    profile = opened.info.get('icc_profile')
    exif = opened.getexif()
    if not profile:
        assert exif.get_ifd(34665).get(40961) == 1, 'An untagged source needs a verified colour space'
        profile = srgb
    profile_name = ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(profile))).strip()
    image = ImageOps.exif_transpose(opened).convert('RGB')
    opened.close()
    assert image.size == (source['width'], source['height']), 'Display dimensions differ from the source index'
    width, height = image.size
    weights = np.array([.2289746, .6917385, .0792869] if 'Display P3' in profile_name
                       else [.2126, .7152, .0722], dtype=np.float32)
    before = np.asarray(image, dtype=np.uint8)
    # A reduced-size luminance map only calculates a conventional local-contrast mask.
    # All output pixels retain their original positions and chromatic differences.
    small = image.copy()
    small.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
    light = np.asarray(small, dtype=np.float32) @ weights / 255
    blur = Image.fromarray(np.rint(light * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(recipe.get('local_radius', 20)))
    blur = np.asarray(blur.resize((width, height), Image.Resampling.BILINEAR), dtype=np.float32) / 255
    pixels16 = np.empty((height, width, 3), dtype=np.uint16)
    x = np.arange(width, dtype=np.float32)[None, :] / max(width - 1, 1)
    curve = np.asarray(recipe['curve'], dtype=np.float32)
    assert np.all(np.diff(curve[:, 0]) > 0) and np.all(np.diff(curve[:, 1]) >= 0)
    assert curve[0, 0] == 0 and curve[-1, 0] == 1
    delta_sum = 0.
    maximum_delta = 0.
    for top in range(0, height, 256):
        end = min(top + 256, height)
        rgb = before[top:end].astype(np.float32) / 255
        luminance = rgb @ weights
        target = np.interp(luminance, curve[:, 0], curve[:, 1]).astype(np.float32)
        # Broad hand-positioned, feathered masks; no segmentation or generative tools.
        y = np.arange(top, end, dtype=np.float32)[:, None] / max(height - 1, 1)
        midtone = 4 * luminance * (1 - luminance)
        for mask in recipe.get('masks', []):
            cx, cy, rx, ry = mask['ellipse']
            feather = np.exp(-.5 * (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2))
            target += mask['amount'] * feather * midtone
        target += recipe.get('local_contrast', 0) * (luminance - blur[top:end]) * midtone
        np.clip(target, 0, 1, out=target)
        chroma = (rgb - luminance[..., None]) * recipe.get('saturation', 1)
        # Compress only chroma that would leave the native RGB gamut, avoiding channel clipping.
        positive = np.maximum(chroma.max(axis=2), 1e-8)
        negative = np.maximum(-chroma.min(axis=2), 1e-8)
        scale = np.minimum(1, np.minimum((1 - target) / positive, target / negative))
        edited = np.clip(target[..., None] + chroma * scale[..., None], 0, 1)
        delta = np.abs(edited - rgb)
        delta_sum += float(delta.sum())
        maximum_delta = max(maximum_delta, float(delta.max()))
        pixels16[top:end] = np.rint(edited * 65535).astype(np.uint16)
    stem = source['id'].replace('/', '__')
    master = output / 'masters' / (stem + '__v1.tif')
    full = output / 'edited' / (stem + '__v1.jpg')
    before_preview = output / 'review' / (stem + '__before.jpg')
    after_preview = output / 'review' / (stem + '__after.jpg')
    assert not any(p.exists() for p in [master, full, before_preview, after_preview]), 'Never overwrite an earlier edit'
    tifffile.imwrite(master, pixels16, photometric='rgb', compression='deflate',
                     metadata=None, description=f"{source['id']} | Conventional edit v1 | Source SHA256 {source['sha256']}",
                     extratags=[(34675, 'B', len(profile), profile, False)])
    # Preserve full pixel dimensions and the source's actual native colour profile.
    edited_image = Image.fromarray(((pixels16.astype(np.uint32) + 128) // 257).astype(np.uint8))
    save_new_image(edited_image, full, quality=96, subsampling=0, icc_profile=profile)
    exiftool = ROOT / '.curation/tools/exiftool/exiftool'
    if exiftool.exists():
        command = ['perl', str(exiftool), '-overwrite_original', '-TagsFromFile', str(path),
                   '-Make', '-Model', '-LensModel', '-ExposureTime', '-FNumber', '-ISO',
                   '-FocalLength', '-DateTimeOriginal', '-CreateDate', '-Artist', '-Copyright',
                   '-Orientation#=1', '-Software=Conventional photo adjustments; Power Gallery trial v1',
                   str(master), str(full)]
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL)
    a, b = review_rgb(image, profile, srgb), review_rgb(edited_image, profile, srgb)
    a.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
    b.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
    assert a.size == b.size
    save_new_image(a, before_preview, quality=94, subsampling=0, icc_profile=srgb)
    save_new_image(b, after_preview, quality=94, subsampling=0, icc_profile=srgb)
    with tifffile.TiffFile(master) as tiff:
        page = tiff.pages[0]
        assert page.shape == (height, width, 3) and page.dtype == np.uint16
        assert page.tags[34675].value == profile
        # Decode representative strips and verify that the lossless master is exact.
        decoded = page.asarray()
        assert np.array_equal(decoded, pixels16)
        del decoded
    assert digest(path) == source['sha256'], 'Original changed during processing'
    record = {'id': source['id'], 'title': recipe['title'], 'source': str(path),
              'sourceSHA256Before': source['sha256'], 'sourceSHA256After': digest(path),
              'displayDimensions': [width, height], 'nativeProfile': profile_name,
              'profileSHA256': hashlib.sha256(profile).hexdigest(),
              'meanAbsoluteChannelChange': round(delta_sum / before.size, 6),
              'maximumChannelChange': round(maximum_delta, 6),
              'recipe': recipe, 'sourceWasRaw': False, 'generativeOperations': False,
              'cropOrGeometryChanges': False, 'newHDRInformation': False, 'outputs': {}}
    for p in [master, full, before_preview, after_preview]:
        record['outputs'][str(p.relative_to(output))] = {'sha256': digest(p), 'bytes': p.stat().st_size}
    image.close()
    edited_image.close()
    del pixels16, before, blur
    gc.collect()
    return record


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sources', required=True, type=Path)
    parser.add_argument('--recipes', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    assert output.is_relative_to(ROOT / '.codex-artifacts'), 'Trials must remain outside the published asset tree'
    output.mkdir(parents=True, exist_ok=True)
    for folder in ['masters', 'edited', 'review']:
        (output / folder).mkdir(exist_ok=True)
    profile_path = output / 'sRGB.icc'
    if not profile_path.exists():
        with profile_path.open('xb') as handle:
            handle.write(ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes())
    srgb = profile_path.read_bytes()
    sources = json.loads(args.sources.read_text())
    recipes = {r['id']: r for r in json.loads(args.recipes.read_text())}
    results = []
    for source in sources:
        results.append(process(source, recipes[source['id']], output, srgb))
        print('Processed and source-preserved:', source['id'], flush=True)
    manifest = {'method': 'Conventional luminance curves, feathered dodge/burn and native-gamut saturation',
                'libraries': {'numpy': np.__version__, 'Pillow': Image.__version__, 'tifffile': tifffile.__version__},
                'originalsUntouched': True, 'websiteUpdated': False, 'photographs': results}
    with (output / 'manifest.json').open('x') as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
