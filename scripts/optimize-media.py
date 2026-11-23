"""Shrinks the media downloaded by fetch-sejm-media.mjs so the build can inline it.

Photos: re-encoded as small JPEGs (the site shows them at most ~120 px wide).
Logos: the Sejm API labels every logo image/jpeg, but some are PNG or GIF and some are empty.
Each logo is read by its real content, converted to PNG, and empty or broken files are dropped.
Rewrites media/index.json to list only the files that are valid images.
"""
import json
import os
import sys
from pathlib import Path

from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / 'media'
PHOTO_BOX = (110, 137)
PHOTO_QUALITY = 60


def open_image(path):
    if not path.exists() or path.stat().st_size == 0:
        return None
    try:
        im = Image.open(path)
        im.load()
        return im
    except (UnidentifiedImageError, OSError):
        return None


def optimize_photo(src, dst):
    im = open_image(src)
    if im is None:
        return False
    im = im.convert('RGB')
    im.thumbnail(PHOTO_BOX, Image.LANCZOS)
    im.save(dst, 'JPEG', quality=PHOTO_QUALITY, optimize=True, progressive=True)
    return True


def optimize_logo(src, dst):
    im = open_image(src)
    if im is None:
        return False
    im = im.convert('RGBA')
    im.thumbnail((64, 64), Image.LANCZOS)
    im.save(dst, 'PNG', optimize=True)
    return True


def main():
    index = json.loads((MEDIA / 'index.json').read_text())
    photos, logos, dropped = [], [], []
    for ph in index['photos']:
        src = MEDIA / ph['file']
        dst = src.with_suffix('.jpg')
        if optimize_photo(src, dst):
            if src != dst:
                src.unlink()
            photos.append({'id': ph['id'], 'file': str(dst.relative_to(MEDIA))})
        else:
            dropped.append(ph['file'])
    for lg in index['logos']:
        src = MEDIA / lg['file']
        dst = src.with_suffix('.png')
        if optimize_logo(src, dst):
            logos.append({'id': lg['id'], 'file': str(dst.relative_to(MEDIA))})
        else:
            dropped.append(lg['file'])
        if src != dst and src.exists():
            src.unlink()
    index['photos'], index['logos'] = photos, logos
    (MEDIA / 'index.json').write_text(json.dumps(index, indent=2, ensure_ascii=False) + '\n')
    size = sum(f.stat().st_size for f in MEDIA.rglob('*') if f.is_file())
    print(f'photos {len(photos)}, logos {len(logos)}, dropped {dropped}, media {size / 1024:.0f} KB')


if __name__ == '__main__':
    sys.exit(main())
