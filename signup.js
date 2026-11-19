import {db,$,showMessage,completeDriverSetup,goDashboard} from './auth-shared.js';

const form=$('#signupForm');
const submitButton=form?.querySelector('button[type="submit"]');

// Always return email confirmation to the Delivery portal, not the GitHub
// Pages account root. Keep this URL aligned with Supabase Auth Redirect URLs.
const emailRedirectTo = new URL('./login.html', window.location.href).href;

function withTimeout(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_, reject)=>window.setTimeout(()=>reject(new Error(label)),ms))
  ]);
}

if(form){
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(submitButton?.disabled) return;
  const f=new FormData(form);
  const password=String(f.get('password')||'');
  const confirm=String(f.get('confirm_password')||'');
  if(password!==confirm){
   showMessage('Nenosiri halifanani. Hakikisha umeandika nenosiri lilelile mara mbili.',true);
   return;
  }
  const name=String(f.get('full_name')||'').trim();
  const phone=String(f.get('phone')||'').trim();
  const email=String(f.get('email')||'').trim().toLowerCase();
  if(name.length<3||!phone||!email){
   showMessage('Jaza majina kamili, namba ya simu na barua pepe.',true);
   return;
  }

  const oldLabel=submitButton?.textContent||'Tuma maombi ya usajili';
  if(submitButton){submitButton.disabled=true;submitButton.textContent='Inatuma maombi...';}
  showMessage('Tunaandaa akaunti yako. Tafadhali subiri...');

  try{
   const {data,error}=await withTimeout(
    db.auth.signUp({
     email,password,
     options:{
      emailRedirectTo,
      data:{
       account_type:'delivery_driver',
       full_name:name,
       phone_number:phone,
       vehicle_type:String(f.get('vehicle_type')||'motorcycle'),
       vehicle_registration:String(f.get('vehicle_registration')||''),
       license_number:String(f.get('license_number')||''),
       delivery_invite_code:String(f.get('invite_code')||'')
      }
     }
    }),
    25000,
    'Muunganisho umechukua muda mrefu. Hakiki intaneti kisha ujaribu tena.'
   );
   if(error) throw error;
   if(!data?.user) throw new Error('Supabase haikurudisha taarifa za akaunti. Tafadhali jaribu tena.');

   if(!data.session){
    showMessage('Akaunti imetengenezwa. Angalia barua pepe yako na uthibitishe akaunti, kisha rudi kwenye ukurasa wa Ingia.');
    if(submitButton){submitButton.disabled=false;submitButton.textContent='Akaunti imetengenezwa';}
    return;
   }

   await withTimeout(
    completeDriverSetup(data.user),
    20000,
    'Akaunti imetengenezwa lakini kukamilisha ombi kumechelewa. Ingia tena ili kuendelea.'
   );
   showMessage('Usajili umepokelewa. Subiri ukaguzi wa Admin.');
   goDashboard();
  }catch(err){
   showMessage(err?.message||'Usajili haujakamilika. Jaribu tena.',true);
   if(submitButton){submitButton.disabled=false;submitButton.textContent=oldLabel;}
  }
 });
}else{
 console.error('ZUNE Delivery signup: signupForm haijapatikana.');
}
