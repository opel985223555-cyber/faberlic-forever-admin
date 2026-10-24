'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
initializeApp();
exports.cms11Catalog=onCall({region:'us-central1',timeoutSeconds:120,memory:'256MiB'},require('./catalog-service')({db:getFirestore(),timestamp:()=>FieldValue.serverTimestamp(),error:(code,message)=>new HttpsError(code,message)}));
