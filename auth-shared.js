import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';
export const db=createClient('https://rpkogiieegqgxqbzwxwo.supabase.co','sb_publishable_2TEqZv-NBM9n5knU46ngqA_wqO3V1uf',{auth:{storageKey:'zune-delivery-driver-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export const $=s=>document.querySelector(s);
export function showMessage(message,isError=false){const el=$('#authMessage');if(!el)return;el.textContent=message;el.classList.remove('hidden','error');if(isError)el.classList.add('error');}
export async function completeDriverSetup(user){
 const meta=user.user_metadata||{};
 const {data:base,error:baseError}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(baseError)throw baseError;
 if(base?.role==='admin')return {admin:true};
 if(!base)throw new Error('Wasifu wa msingi haujapatikana. Wasiliana na msaada wa ZUNE Delivery.');
 const {error:profileUpdateError}=await db.from('profiles').update({
  full_name:meta.full_name||user.email,
  phone_number:meta.phone_number||null,
  date_of_birth:meta.date_of_birth||null,
  gender:meta.gender||null,
  residential_address:[meta.residential_area,meta.district,meta.region].filter(Boolean).join(', ')||null
 }).eq('id',user.id);
 if(profileUpdateError)throw profileUpdateError;
 const {data:existing,error:profileReadError}=await db.from('delivery_driver_profiles').select('user_id,status').eq('user_id',user.id).maybeSingle();
 if(profileReadError)throw profileReadError;
 if(!existing){
  if(meta.account_type!=='delivery_driver')throw new Error('Akaunti hii si akaunti ya dereva wa ZUNE Delivery.');
  const {error}=await db.from('delivery_driver_profiles').insert({
   user_id:user.id,full_name:meta.full_name||user.email,phone_number:meta.phone_number||'',
   email:user.email,date_of_birth:meta.date_of_birth||null,gender:meta.gender||null,
   region:meta.region||null,district:meta.district||null,residential_area:meta.residential_area||null,
   emergency_phone:meta.emergency_phone||null,emergency_relation:meta.emergency_relation||null,
   vehicle_type:meta.vehicle_type||'motorcycle',vehicle_registration:meta.vehicle_registration||null,
   license_number:meta.license_number||null,vehicle_ownership:meta.vehicle_ownership||'owned'
  });
  if(error)throw error;
 }
 const {data:application,error:applicationError}=await db.from('delivery_driver_applications').select('id').eq('user_id',user.id).limit(1).maybeSingle();
 if(applicationError)throw applicationError;
 if(!application){
  let invitationId=null;const code=String(meta.delivery_invite_code||'').trim();
  if(code){const {data,error}=await db.rpc('redeem_delivery_invitation',{p_code:code});if(error)throw error;invitationId=data;}
  const {error}=await db.from('delivery_driver_applications').insert({user_id:user.id,application_source:invitationId?'admin_invite':'self',invitation_id:invitationId,status:'pending'});
  if(error)throw error;
 }
 return {admin:false,status:existing?.status||'pending'};
}
export function goDashboard(){window.location.href='./dashboard.html';}