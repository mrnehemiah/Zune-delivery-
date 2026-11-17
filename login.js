import {db,$,showMessage,completeDriverSetup,goDashboard} from './auth-shared.js';
const form=$('#loginForm');
form.addEventListener('submit',async e=>{
 e.preventDefault();const button=form.querySelector('button');button.disabled=true;button.textContent='Inaingia...';
 try{
  const f=new FormData(form);const {data,error}=await db.auth.signInWithPassword({email:String(f.get('email')).trim().toLowerCase(),password:String(f.get('password'))});
  if(error)throw error;
  await completeDriverSetup(data.user);
  showMessage('Umeingia kikamilifu. Tunafungua dashboard...');
  goDashboard();
 }catch(err){showMessage(err.message||'Imeshindikana kuingia. Hakiki taarifa zako.',true);button.disabled=false;button.textContent='Ingia';}
});
const {data:{session}}=await db.auth.getSession();if(session){try{await completeDriverSetup(session.user);goDashboard()}catch(e){showMessage(e.message,true)}}
