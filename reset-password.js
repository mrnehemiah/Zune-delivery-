import {db,$,showMessage} from './auth-shared.js';
const form=$('#resetForm');
db.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')showMessage('Kiungo kimethibitishwa. Sasa weka nenosiri jipya.')});
form.addEventListener('submit',async e=>{
 e.preventDefault();
 const f=new FormData(form),password=String(f.get('password'));
 if(password!==String(f.get('confirm'))){showMessage('Nenosiri halifanani.',true);return}
 const btn=form.querySelector('button');btn.disabled=true;
 try{
  const {error}=await db.auth.updateUser({password});if(error)throw error;
  showMessage('Nenosiri limebadilishwa. Unaweza kuingia sasa.');
  await db.auth.signOut();
 }catch(err){showMessage(err.message,true);btn.disabled=false}
});
