#!/usr/bin/env python3
"""Rebuild sticker manifests from the folders in /stickers.

Run from the repo root:   python stickers/build-manifests.py
(The GitHub Action in .github/workflows/sticker-manifest.yml runs this on every push.)

- Each sub-folder of stickers/ is a pack; its images become that pack's stickers.
- Existing names, order and pack icons in manifest.json / packs.json are kept.
- New images are appended with a name made from the file name (diya_trio.png -> "Diya Trio").
- Images that no longer exist are dropped.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXTS = {'.png', '.webp', '.gif', '.jpg', '.jpeg', '.svg'}

def title(stem):
    return re.sub(r'[-_]+', ' ', stem).strip().title()

def read_json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}

def write_json(path, data):
    text = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if not path.exists() or path.read_text(encoding='utf-8') != text:
        path.write_text(text, encoding='utf-8')
        print('updated', path.relative_to(ROOT.parent))

packs_old = {p['id']: p for p in read_json(ROOT / 'packs.json').get('packs', []) if p.get('id')}
pack_dirs = sorted(d for d in ROOT.iterdir() if d.is_dir() and not d.name.startswith('.'))
packs = []
for d in pack_dirs:
    files = sorted(f.name for f in d.iterdir() if f.is_file() and f.suffix.lower() in EXTS)
    old = read_json(d / 'manifest.json')
    old_list = [s for s in old.get('stickers', []) if s.get('file')]
    known = {s['file']: s for s in old_list}
    ordered = [s for s in old_list if s['file'] in files] + [{'file': f, 'name': title(Path(f).stem)} for f in files if f not in known]
    name = old.get('name') or packs_old.get(d.name, {}).get('name') or title(d.name)
    write_json(d / 'manifest.json', {'name': name, 'stickers': ordered})
    entry = dict(packs_old.get(d.name, {}))
    entry.update({'id': d.name, 'name': entry.get('name') or name})
    packs.append(entry)

# keep the order already in packs.json, then any new packs
order = {pid: i for i, pid in enumerate(packs_old)}
packs.sort(key=lambda p: (order.get(p['id'], len(order)), p['id']))
write_json(ROOT / 'packs.json', {'packs': packs})
print(f'{len(packs)} pack(s) ready.')
