"""Checks the locked baseline except expressly allowed changed blocks.
Usage: python tests/verify_module_lock.py [--allow assets/js/modules/videos.js]
Run from any directory. A nonzero exit code means unapproved files changed.
"""
import argparse, hashlib, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--allow',action='append',default=[]);args=p.parse_args()
manifest=json.loads((root/'LOCKED_MODULES.json').read_text(encoding='utf-8'))
fail=[]
for rel,expected in manifest['sha256'].items():
    if rel in args.allow:continue
    target=root/rel
    found=hashlib.sha256(target.read_bytes()).hexdigest() if target.exists() else None
    if found!=expected:fail.append(rel)
if fail:print('CHANGED LOCKED MODULES:',', '.join(fail));raise SystemExit(1)
print('PASS: frozen module checksums match. Allowed changes:',args.allow)
