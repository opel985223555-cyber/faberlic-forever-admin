/* Shared invitation-code format; contains no real codes or universal secret. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FFInvite=factory();})(typeof window==='object'?window:globalThis,()=>{
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 function canonical(value){const s=String(value||'').trim().toUpperCase().replace(/[\s-]/g,'');return /^FF[A-HJ-NP-Z2-9]{16}$/.test(s)?s:null;}
 function display(value){const s=canonical(value);return s?'FF-'+s.slice(2).match(/.{4}/g).join('-'):'';}
 function generate(random=globalThis.crypto){const bytes=new Uint8Array(16);random.getRandomValues(bytes);return display('FF'+Array.from(bytes,b=>alphabet[b&31]).join(''));}
 async function hash(value,crypto=globalThis.crypto){const s=canonical(value);if(!s)throw Error('invalid-code');const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
 return {canonical,display,generate,hash};
});
