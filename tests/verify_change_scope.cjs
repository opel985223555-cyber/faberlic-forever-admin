/* CMS10: verify the code inherited from the Codex P0/P1 baseline stays frozen.
   CMS10 deliberately updates live, materials, shell refresh, and Firebase content APIs. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const prior=JSON.parse(fs.readFileSync(path.join(root,'P0_P1_CHANGESET.json'),'utf8'));
const release=JSON.parse(fs.readFileSync(path.join(root,'CHANGESET_CMS10.json'),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const permitted=new Set([
 'CHANGESET_CMS10.json','LOCKED_MODULES.json','README_CMS10_RU.md',
 'assets/css/live.css','assets/js/core/firebase.js','assets/js/core/shell.js',
 'assets/js/main.js','assets/js/core/repository.js','assets/js/modules/live.js','assets/js/modules/materials.js',
 'firestore.rules','index.html','tests/test_content_cms10.cjs','tests/verify_change_scope.cjs'
]);
assert.deepEqual(release.deleted_files,[],'CMS10 must not delete baseline files');
for(const p of release.changed_files)assert(permitted.has(p),'Unauthorized CMS10 change: '+p);
let unchanged=0;
for(const file of prior.files){
 const name=file.path;
 if(release.changed_files.includes(name))continue;
 assert.equal(sha(path.join(root,name)),file.finalSha256,name);
 unchanged++;
}
console.log('PASS: '+unchanged+' Codex baseline files untouched, CMS10 scope approved, no files deleted');
