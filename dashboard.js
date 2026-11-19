import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.119.0';
const db=createClient('https://rpkogiieegqgxqbzwxwo.supabase.co','sb_publishable_2TEqZv-NBM9n5knU46ngqA_wqO3V1uf',{auth:{storageKey:'zune-delivery-driver-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabels={pending:'Inasubiri idhini',active:'Akaunti hai',rejected:'Maombi yamekataliwa',suspended:'Akaunti imesimamishwa'};
function notice(t,error=false){const n=$('#notice');n.textContent=t;n.classList.remove('hidden','error');if(error)n.classList.add('error')}
async function init(){
 const {data:{session},error:authError}=await db.auth.getSession();if(authError)throw authError;
 if(!session){location.replace('./login.html');return;}
 const user=session.user;
 const [{data:driver,error:dErr},{data:app,error:aErr},{data:docs,error:docErr},{data:jobs,error:jErr}]=await Promise.all([
  db.from('delivery_driver_profiles').select('full_name,phone_number,vehicle_type,status').eq('user_id',user.id).maybeSingle(),
  db.from('delivery_driver_applications').select('status,review_note').eq('user_id',user.id).order('submitted_at',{ascending:false}).limit(1).maybeSingle(),
  db.from('delivery_driver_documents').select('document_type,status,expiry_date').eq('user_id',user.id),
  db.rpc('zune_delivery_driver_queue')
 ]);
 if(dErr)throw dErr;if(aErr)throw aErr;if(docErr)throw docErr;if(jErr)throw jErr;
 if(!driver){notice('Wasifu wa dereva haujapatikana. Tafadhali wasiliana na Admin.',true);return;}
 const status=driver.status||app?.status||'pending',name=driver.full_name||user.email;
 $('#greeting').textContent='Karibu, '+name.split(' ')[0]+'.';
 $('#statusText').textContent=statusLabels[status]||status;
 const activeJobs=(jobs||[]).filter(x=>!['delivered','completed','cancelled'].includes(x.delivery_status));
 const approved=(docs||[]).filter(x=>x.status==='approved').length;
 const required=['national_id','driver_photo','driving_license','vehicle_registration','vehicle_insurance'];
 const missing=required.filter(t=>!(docs||[]).some(x=>x.document_type===t&&x.status==='approved'));
 $('#stats').innerHTML='<div><strong>Hali ya akaunti</strong>'+esc(statusLabels[status]||status)+'</div><div><strong>Oda zinazoendelea</strong>'+activeJobs.length+'</div><div><strong>Nyaraka zilizoidhinishwa</strong>'+approved+'/'+required.length+'</div>';
 if(status!=='active')notice(status==='rejected'?'Maombi yamekataliwa: '+(app?.review_note||'Angalia maelezo kwa Admin.'):'Akaunti yako bado haijaidhinishwa. Huwezi kupokea oda mpaka Admin akamilishe ukaguzi.');
 else if(missing.length)notice('Akaunti ipo hai, lakini bado kuna nyaraka zinazohitaji idhini: '+missing.join(', ')+'.');
 const docsBox=$('#documentStatus');docsBox.textContent=missing.length?'Bado hazijaidhinishwa: '+missing.join(', '):'Nyaraka zote za lazima zimeidhinishwa.';
 const queue=$('#queue');
 if(!activeJobs.length)queue.innerHTML='<p class="muted">Kwa sasa hakuna oda inayoendelea uliopangiwa.</p>';
 else queue.innerHTML=activeJobs.slice(0,4).map(d=>'<article class="application-card"><div class="row-between"><strong>Oda #'+esc(String(d.delivery_id).slice(0,8).toUpperCase())+'</strong><span class="pill">'+esc(d.delivery_status)+'</span></div><p><b>Mpokeaji:</b> '+esc(d.recipient_name||'—')+' · '+esc(d.recipient_phone||'—')+'</p><p><b>Eneo:</b> '+esc([d.delivery_address,d.region,d.district].filter(Boolean).join(', ')||'Anwani haijaainishwa')+'</p></article>').join('');
}
$('#logoutBtn').addEventListener('click',async()=>{const {error}=await db.auth.signOut();if(error){notice(error.message,true);return}location.replace('./login.html')});
$('#languageBtn').addEventListener('click',()=>notice('Lugha ya Kiingereza itaongezwa kwenye dashibodi nzima katika hatua ya lugha.'));
init().catch(e=>notice(e.message||'Imeshindikana kufungua dashibodi.',true));
