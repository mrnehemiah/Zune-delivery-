import{createClient}from'https://esm.sh/@supabase/supabase-js@2.119.0';
const db=createClient('https://rpkogiieegqgxqbzwxwo.supabase.co','sb_publishable_2TEqZv-NBM9n5knU46ngqA_wqO3V1uf',{auth:{storageKey:'zune-delivery-driver-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={pending:'Inasubiri idhini',active:'Akaunti hai',rejected:'Maombi yamekataliwa',suspended:'Akaunti imesimamishwa'};
const jobLabels={pending:'Inasubiri dereva',assigned:'Dereva amechaguliwa',ready_for_pickup:'Subiri kukabidhiwa',picked_up:'Mzigo umepokelewa',in_transit:'Safari inaendelea',delivered:'Umefikisha · subiri mnunuzi',completed:'Imekamilika',cancelled:'Imeghairiwa'};
const required=['national_id','driver_photo','driving_license','vehicle_registration','vehicle_insurance'];
const statIcons={account:'<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',orders:'<path d="M4 7h16v13H4zM8 7V4h8v3M8 12h8m-8 4h5"/>',done:'<path d="m4 12 5 5L20 6"/><circle cx="12" cy="12" r="9"/>',docs:'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7m-7 4h7"/>'};
function notice(t,error=false){const n=$('#notice');n.textContent=t;n.classList.remove('hidden','error');if(error)n.classList.add('error')}
function tr(sw,en){return lang==='sw'?sw:en}
function stat(label,value,type){return '<article class="stat"><span class="stat-icon-3d"><svg viewBox="0 0 24 24">'+statIcons[type]+'</svg></span><span>'+label+'</span><strong>'+value+'</strong></article>'}
let lang='sw';
async function init(){
 const{data:{session},error:ae}=await db.auth.getSession();if(ae)throw ae;if(!session){location.replace('./login.html');return}
 const user=session.user;
 const [{data:driver,error:de},{data:app,error:ape},{data:docs,error:dce},{data:jobs,error:je}]=await Promise.all([
 db.from('delivery_driver_profiles').select('user_id,full_name,phone_number,vehicle_type,status,rejection_reason').eq('user_id',user.id).maybeSingle(),
 db.from('delivery_driver_applications').select('status,review_note').eq('user_id',user.id).order('submitted_at',{ascending:false}).limit(1).maybeSingle(),
 db.from('delivery_driver_documents').select('document_type,status,expiry_date,review_note').eq('user_id',user.id),
 db.rpc('zune_delivery_driver_queue')]);
 if(de)throw de;if(ape)throw ape;if(dce)throw dce;if(je)throw je;
 if(!driver){notice(tr('Wasifu wa dereva haujapatikana.','Driver profile was not found.'),true);return}
 const status=driver.status||app?.status||'pending',name=driver.full_name||user.email;
 $('#greeting').textContent=tr('Habari, ','Hello, ')+name.split(' ')[0]+'!';
 $('#statusText').innerHTML='<span class="status '+(status==='active'?'':status==='pending'?'pending':'bad')+'">'+esc(labels[status]||status)+'</span><span class="hero-status-copy">'+(status==='active'?tr(' Akaunti yako iko tayari kwa shughuli za delivery.',' Your account is ready for delivery activity.'):tr(' Kamilisha hatua za uhakiki ili uweze kupokea oda.',' Complete verification to become eligible for delivery assignments.'))+'</span>';
 const active=(jobs||[]).filter(j=>!['completed','cancelled'].includes(j.delivery_status));
 const completed=(jobs||[]).filter(j=>['completed','delivered'].includes(j.delivery_status)).length;
 const approved=(docs||[]).filter(d=>d.status==='approved').length;
 const missing=required.filter(t=>!(docs||[]).some(d=>d.document_type===t&&d.status==='approved'));
 $('#stats').innerHTML=stat(tr('Hali ya akaunti','Account status'),esc(labels[status]||status),'account')+stat(tr('Oda zinazoendelea','Active deliveries'),active.length,'orders')+stat(tr('Oda zilizokamilika','Completed deliveries'),completed,'done')+stat(tr('Nyaraka zilizoidhinishwa','Approved documents'),approved+'/'+required.length,'docs');
 if(status!=='active')notice(status==='rejected'?tr('Maombi yamekataliwa: ','Application rejected: ')+(app?.review_note||driver.rejection_reason||''):tr('Maombi yako yanasubiri idhini ya Admin. Huwezi kupokea oda bado.','Your application is awaiting Admin approval. You cannot receive deliveries yet.'),status==='rejected');
 else if(missing.length)notice(tr('Kabla ya kupangiwa oda, idhinisha nyaraka hizi: ','Before receiving deliveries, get these documents approved: ')+missing.join(', '));
 else notice(tr('Akaunti na nyaraka zako ziko tayari. Oda mpya zitaonekana hapa zikikupangiwa.','Your account and documents are approved. New assignments will appear here.'));
 $('#documentStatus').textContent=missing.length?tr('Bado hazijaidhinishwa: ','Still awaiting approval: ')+missing.join(', '):tr('Nyaraka zote za lazima zimeidhinishwa.','All required documents are approved.');
 $('#docsList').innerHTML=required.map(t=>{const d=(docs||[]).find(x=>x.document_type===t);return '<div class="doc-row"><span>'+({national_id:'Kitambulisho cha Taifa',driver_photo:'Picha ya dereva',driving_license:'Leseni/ruhusa',vehicle_registration:'Kadi ya usajili',vehicle_insurance:'Bima ya chombo'}[t])+'</span><b>'+(!d?'Haijapakiwa':d.status==='approved'?'Imeidhinishwa':d.status==='rejected'?'Rudisha tena':'Inasubiri')+'</b></div>'}).join('');
 const queue=$('#queue');if(!active.length){queue.innerHTML='<p class="muted">'+tr('Kwa sasa hakuna oda inayoendelea uliopangiwa.','You have no active delivery assignments right now.')+'</p>'}
 else queue.innerHTML=active.slice(0,5).map(j=>'<article class="job"><div class="job-top"><b>Oda #'+esc(j.delivery_id.slice(0,8).toUpperCase())+'</b><span class="status">'+esc(jobLabels[j.delivery_status]||j.delivery_status)+'</span></div><p><b>'+tr('Mpokeaji:','Recipient:')+'</b> '+esc(j.recipient_name||'—')+' · '+esc(j.recipient_phone||'—')+'<br><b>'+tr('Anwani:','Address:')+'</b> '+esc([j.delivery_address,j.region,j.district].filter(Boolean).join(', ')||'—')+'</p><div class="actions"><a class="btn soft" href="./jobs.html">'+tr('Fungua oda','Open delivery')+'</a>'+(j.latitude!=null&&j.longitude!=null?'<a class="btn soft" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat='+j.latitude+'&mlon='+j.longitude+'#map=16/'+j.latitude+'/'+j.longitude+'">'+tr('Ramani','Map')+'</a>':'')+'</div></article>').join('');
}
$('#logoutBtn').addEventListener('click',async()=>{const{error}=await db.auth.signOut();if(error){notice(error.message,true);return}location.replace('./login.html')});
$('#languageBtn').addEventListener('click',()=>{lang=lang==='sw'?'en':'sw';$('#languageBtn').textContent=lang==='sw'?'EN':'SW';init().catch(e=>notice(e.message,true))});
db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')location.replace('./login.html')});
init().catch(e=>notice(e.message||'Imeshindikana kupakia dashibodi.',true));