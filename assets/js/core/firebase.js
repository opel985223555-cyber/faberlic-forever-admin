/* Firebase Auth + Firestore adapter. Does not contain private keys. */
(() => {
 const A=window.FFAdmin;
 let sdk=null,app=null,auth=null,db=null;
 const cfg=window.FF_FIREBASE_CONFIG||{};
 A.firebaseReady=()=>Boolean(cfg.apiKey&&cfg.projectId&&cfg.appId&&cfg.authDomain);
 A.firebase={
   async init(onChange){
     if(!A.firebaseReady())return false;
     try{
       const v='12.19.0';
       const [core, authSdk, storeSdk] = await Promise.all([
         import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),
         import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`),
         import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`)
       ]);
       sdk={auth:authSdk,db:storeSdk};
       app=core.initializeApp(cfg); auth=authSdk.getAuth(app); db=storeSdk.getFirestore(app);
       authSdk.onAuthStateChanged(auth,async(user)=>{
         if(!user){onChange(null);return}
         try {
           const adminDoc=await storeSdk.getDoc(storeSdk.doc(db,'admins',user.uid));
           if(adminDoc.exists()&&adminDoc.data()?.active===true){onChange(user)}
           else { await authSdk.signOut(auth);onChange(null);A.notify('Учётная запись не имеет прав администратора.','error') }
         } catch(e){ await authSdk.signOut(auth);onChange(null);A.notify('Не удалось проверить права администратора: '+e.message,'error') }
       });
       return true;
     }catch(e){A.notify('Ошибка соединения с Firebase: '+e.message,'error');return false;}
   },
   async signIn(email,password){ if(!sdk)throw new Error('Firebase ещё не настроен'); await sdk.auth.signInWithEmailAndPassword(auth,email,password);},
   async signOut(){if(auth)await sdk.auth.signOut(auth);},
   async listLessons(){const snap=await sdk.db.getDocs(sdk.db.collection(db,'lessons'));return snap.docs.map(x=>({id:x.id,...x.data()}));},
   async upsertLesson(data,id){if(id){await sdk.db.updateDoc(sdk.db.doc(db,'lessons',id),{...data,updatedAt:sdk.db.serverTimestamp()});return id;}
     const ref=await sdk.db.addDoc(sdk.db.collection(db,'lessons'),{...data,createdAt:sdk.db.serverTimestamp(),updatedAt:sdk.db.serverTimestamp()});return ref.id;},
   async deleteLesson(id){await sdk.db.deleteDoc(sdk.db.doc(db,'lessons',id));}
 };
})();
