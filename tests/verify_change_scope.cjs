const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(__dirname,'..');const m=JSON.parse(fs.readFileSync(path.join(root,'P0_P1_CHANGESET.json'),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const allowed=new Set(['assets/js/core/firebase.js','assets/js/core/repository.js','assets/js/modules/categories.js','assets/js/modules/videos.js','index.html','firestore.rules','tests/test_admin_browser.py']);
assert.equal(m.removed.length,0,'Baseline files must not be deleted');
for(const f of m.files){assert.equal(hash(path.join(root,f.path)),f.finalSha256,f.path);if(f.baselineSha256!==null&&f.baselineSha256!==f.finalSha256)assert(allowed.has(f.path),'Unexpected baseline modification: '+f.path);}
console.log('PASS: all packaged file hashes and approved change scope match; no baseline files removed');
