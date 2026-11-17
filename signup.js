import {db,$,showMessage,completeDriverSetup,goDashboard} from './auth-shared.js';
const form=$('#signupForm');
form.addEventListener('submit',async e=>{
 e.preventDefault();
 const button=form.querySelector('button');
 const f=new FormData(form);
 const password=String(f.get('password'));
 if(password!==String(f.get('confirm_password'))){showMessage('Nenosiri halifanani. Hakikisha umeandika nenosiri lilelile mara mbili.',true);return}
 const name=String(f.get('full_name')).trim(),phone=String(f.get('phone')).trim(),email=String(f.get('email')).trim().toLowerCase();
 if(!name||!phone){showMessage('Jaza majina na namba ya simu.',true);return}
 button.disabled=true;button.textContent='Inatuma maombi...';
 try{
  const {data,error}=await db.auth.signUp({email,password,options:{data:{account_type:'delivery_driver',full_name:name,phone_number:phone,vehicle_type:String(f.get('vehicle_type')),vehicle_registration:String(f.get('vehicle_registration')||''),license_number:String(f.get('license_number')||''),delivery_invite_code:String(f.get('invite_code')||'')}}});
  if(error)throw error;
  if(!data.session){showMessage('Akaunti imetengenezwa. Angalia barua pepe yako na uthibitishe akaunti. Baada ya hapo rudi kwenye Ingia ili kukamilisha maombi.');button.textContent='Akaunti imetengenezwa';return}
  await completeDriverSetup(data.user);showMessage('Usajili umepokelewa. Subiri ukaguzi wa Admin.');goDashboard();
 }catch(err){showMessage(err.message||'Usajili haujakamilika. Jaribu tena.',true);button.disabled=false;button.textContent='Tuma maombi ya usajili'}
});
