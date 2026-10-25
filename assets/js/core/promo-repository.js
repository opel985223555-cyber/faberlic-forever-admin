/* Admin-only Firestore code management. Authorization is enforced by Security Rules. */
(()=>{
 const A=window.FFAdmin;
 const api=()=>A.firebase.services();
 const rows=s=>s.docs.map(d=>({id:d.id,...d.data()}));
 const jobKey=()=> 'ff-invite-job:'+A.state.currentUser?.uid;
 A.promoRepo={
  pendingCount(){try{return JSON.parse(sessionStorage.getItem(jobKey())||'null')?.codes?.length||0;}catch{return 0;}},
  async list(){const {store,db}=api();const r=await Promise.all(['promoCodes','promoSecrets','promoClaims','installations'].map(n=>store.getDocsFromServer(store.collection(db,n))));return {codes:rows(r[0]),secrets:rows(r[1]),claims:rows(r[2]),installations:rows(r[3])};},
  async generate(count,onProgress){
   const {store,db}=api();if(!Number.isInteger(count)||count<1||count>5000)throw Error('Укажите количество от 1 до 5000');
   let job;try{job=JSON.parse(sessionStorage.getItem(jobKey())||'null');}catch{}
   if(!job){const unique=new Set();while(unique.size<count)unique.add(FFInvite.generate());const codes=await Promise.all([...unique].map(async code=>({code,id:await FFInvite.hash(code)})));job={id:crypto.randomUUID(),codes};sessionStorage.setItem(jobKey(),JSON.stringify(job));}
   const ref=store.doc(db,'promoBatches',job.id);
   for(let start=0;start<job.codes.length;start+=200){const end=Math.min(start+200,job.codes.length);
    await store.runTransaction(db,async tx=>{const snap=await tx.get(ref),cursor=snap.exists()?snap.data().cursor:0;if(cursor>=end)return;if(cursor!==start)throw Error('Пакет изменён. Обновите список.');
     for(const item of job.codes.slice(start,end)){tx.set(store.doc(db,'promoCodes',item.id),{kind:'single',state:'free',enabled:true,createdAt:store.serverTimestamp(),updatedAt:store.serverTimestamp(),usedAt:null});tx.set(store.doc(db,'promoSecrets',item.id),{code:item.code,createdAt:store.serverTimestamp()});}
     tx.set(ref,{total:job.codes.length,cursor:end,updatedAt:store.serverTimestamp()});});onProgress?.(end,job.codes.length);
   }
   sessionStorage.removeItem(jobKey());return job.codes.length;
  },
  async universal(){const {store,db}=api(),code=FFInvite.generate(),id=await FFInvite.hash(code),ref=store.doc(db,'accessConfig','universal');
   await store.runTransaction(db,async tx=>{const snap=await tx.get(ref),old=snap.exists()?snap.data().codeHash:null;if(old)tx.update(store.doc(db,'promoCodes',old),{enabled:false,updatedAt:store.serverTimestamp()});tx.set(store.doc(db,'promoCodes',id),{kind:'universal',state:'free',enabled:true,usedAt:null,createdAt:store.serverTimestamp(),updatedAt:store.serverTimestamp()});tx.set(store.doc(db,'promoSecrets',id),{code,createdAt:store.serverTimestamp()});tx.set(ref,{codeHash:id,enabled:true,updatedAt:store.serverTimestamp()});});return code;
  },
  async toggleCode(id,enabled){const {store,db}=api();await store.updateDoc(store.doc(db,'promoCodes',id),{enabled,updatedAt:store.serverTimestamp()});},
  async toggleInstallation(uid,enabled){const {store,db}=api();await store.updateDoc(store.doc(db,'installations',uid),{enabled,updatedAt:store.serverTimestamp()});}
 };
})();
