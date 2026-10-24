#!/usr/bin/env python3
# Checks accidental changes to stable blocks of the application.
# Usage: python tests/check_locked_files.py
# For intentional edits: python tests/check_locked_files.py --allow app/src/main/assets/www/modules/categories.js
from pathlib import Path
import sys,hashlib,json
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'MODULES_LOCKED.json').read_text(encoding='utf8'))
allow=set()
args=sys.argv[1:]
if args and args[0]=='--allow': allow=set(args[1:])
errors=[]
for name,digest in manifest['baseline_sha256'].items():
 f=root/name
 if not f.exists(): errors.append('MISSING: '+name);continue
 if hashlib.sha256(f.read_bytes()).hexdigest()!=digest and name not in allow:
  errors.append('CHANGED WITHOUT APPROVAL: '+name)
if errors:
 print('FAILED\n'+'\n'.join(errors))
 sys.exit(1)
print('PASS: unchanged frozen modules verified. Allowed changes:', ', '.join(sorted(allow)) or 'none')
