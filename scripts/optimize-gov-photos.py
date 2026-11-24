"""Shrinks the portraits in media/gov/ (fetch-gov-photos.mjs) so the build can inline them.

Each image becomes a 96 x 96 JPEG cropped to a square from the top (faces sit in the upper part of portraits).
Broken files are dropped and media/gov/index.json is rewritten to match.
"""
import json
from pathlib import Path

from PIL import Image, UnidentifiedImageError

GOV = Path(__file__).resolve().parent.parent / 'media' / 'gov'
SIZE = 96
QUALITY = 62

index = json.loads((GOV / 'index.json').read_text())
kept = []
for ph in index['photos']:
    src = GOV.parent / ph['file']
    dst = GOV / f"{ph['slug']}.jpg"
    try:
        im = Image.open(src)
        im.load()
    except (FileNotFoundError, UnidentifiedImageError, OSError):
        continue
    if im.width != SIZE or im.height != SIZE or src.suffix != '.jpg':
        im = im.convert('RGB')
        side = min(im.width, im.height)
        left = (im.width - side) // 2
        top = 0 if im.height > im.width else 0
        im = im.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.LANCZOS)
        im.save(dst, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        if src != dst and src.exists():
            src.unlink()
    kept.append({**ph, 'file': f"gov/{ph['slug']}.jpg"})
index['photos'] = kept
(GOV / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1) + '\n')
print(f"{len(kept)} portraits, {sum(p.stat().st_size for p in GOV.glob('*.jpg')) // 1024} KB")
