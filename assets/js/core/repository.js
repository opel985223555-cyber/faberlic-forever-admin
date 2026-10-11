/* Production repository — all lesson operations require Firebase session. */
(()=>{
 const A=window.FFAdmin;
 const requireAuth=()=>{if(A.state.mode!=='firebase'||!A.state.currentUser)throw Error('Требуется авторизация администратора');};
 A.repo={
   async list(){requireAuth();return A.firebase.listLessons();},
   async save(payload,id){requireAuth();return A.firebase.upsertLesson(payload,id);},
   async remove(id){requireAuth();return A.firebase.deleteLesson(id);},
   async reorder(ids){requireAuth();return A.firebase.reorderLessons(ids);},
   async saveCatalog(items){requireAuth();return A.firebase.putCatalog(items);},
   async refresh(){A.state.lessons=await A.repo.list();A.state.catalog=await A.firebase.listCatalog();}
 };
})();
