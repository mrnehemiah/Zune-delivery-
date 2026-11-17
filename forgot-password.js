import {db,$,showMessage} from './auth-shared.js';
$('#forgotForm').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget,btn=form.querySelector('button');btn.disabled=true;btn.textContent='Inatuma...';
 try{
  const email=String(new FormData(form).get('email')).trim().toLowerCase();
  const redirectTo=new URL('./reset-password.html',window.location.href).href;
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});
  if(error)throw error;
  showMessage('Ikiwa barua pepe hii imesajiliwa, utapokea kiungo cha kurejesha nenosiri. Angalia pia Spam/Junk.');
 }catch(err){showMessage(err.message,true)}finally{btn.disabled=false;btn.textContent='Tuma kiungo cha kurejesha'}
});
