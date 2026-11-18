import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const db=createClient('https://rpkogiieegqgxqbzwxwo.supabase.co','sb_publishable_2TEqZv-NBM9n5knU46ngqA_wqO3V1uf',{auth:{storageKey:'zune-delivery-driver-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const root=document.querySelector('#driverJobs'),notice=document.querySelector('#jobsNotice');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={assigned:'Dereva amechaguliwa',ready_for_pickup:'Subiri uthibitisho wa muuzaji',picked_up:'Umepokea mzigo',in_transit:'Uko njiani',delivered:'Umefikisha · subiri mnunuzi',completed:'Imekamilika'};
let rows=[];let realtimeChannel=null;let currentDriverId=null;let refreshTimer=null;let realtimeChannel=null;let currentDriverId=null;let refreshTimer=null;
function msg(s,err=false){notice.textContent=s;notice.classList.remove('hidden');notice.classList.toggle('error',err)}
async function act(fn,args,success){const {error}=await db.rpc(fn,args);if(error){msg(error.message,true);return;}msg(success);await load();}
function render(){
 if(!rows.length){root.innerHTML='<h2>Hakuna oda ulizopangiwa</h2><p class="muted">Oda zitaonekana hapa baada ya muuzaji kukuchagua.</p>';return;}
 root.innerHTML=rows.map(d=>{
 let action='';
 if(d.delivery_status==='ready_for_pickup')action='<button class="primary" data-pick="'+d.delivery_id+'">Nimethibitisha kupokea mzigo</button>';
 if(d.delivery_status==='picked_up')action='<button class="primary" data-transit="'+d.delivery_id+'">Anza safari</button>';
 if(d.delivery_status==='in_transit')action='<button class="primary" data-delivered="'+d.delivery_id+'">Nimemfikishia mnunuzi</button><button class="ghost" data-gps="'+d.delivery_id+'">Shiriki eneo langu la GPS</button>';
 const map=d.latitude!=null&&d.longitude!=null?'<a class="ghost" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat='+d.latitude+'&mlon='+d.longitude+'#map=17/'+d.latitude+'/'+d.longitude+'">Fungua eneo la mnunuzi</a>':'';
 return '<article class="application-card"><div class="row-between"><strong>Oda #'+esc(d.delivery_id.slice(0,8).toUpperCase())+'</strong><span class="pill">'+esc(labels[d.delivery_status]||d.delivery_status)+'</span></div><p><b>Mpokeaji:</b> '+esc(d.recipient_name)+' · '+esc(d.recipient_phone)+'</p><p><b>Anwani:</b> '+esc([d.delivery_address,d.region,d.district].filter(Boolean).join(', '))+'</p><p><b>Delivery:</b> TSh '+Number(d.delivery_fee||0).toLocaleString('en-US')+'</p><div class="application-actions">'+action+' '+map+'</div></article>';
 }).join('');
 root.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>act('zune_delivery_driver_pickup',{p_delivery_id:b.dataset.pick,p_note:'Dereva amethibitisha kupokea mzigo.'},'Umethibitisha kupokea mzigo.'));
 root.querySelectorAll('[data-transit]').forEach(b=>b.onclick=()=>act('zune_delivery_driver_in_transit',{p_delivery_id:b.dataset.transit},'Safari imeanza.'));
 root.querySelectorAll('[data-delivered]').forEach(b=>b.onclick=()=>act('zune_delivery_driver_delivered',{p_delivery_id:b.dataset.delivered,p_note:'Dereva amethibitisha kufikisha mzigo.'},'Umeweka mzigo kuwa umefikishwa. Mnunuzi sasa athibitishe kupokea.'));
 root.querySelectorAll('[data-gps]').forEach(b=>b.onclick=()=>{if(!navigator.geolocation){msg('Kifaa hiki hakina GPS inayopatikana.',true);return;}b.disabled=true;navigator.geolocation.getCurrentPosition(async pos=>{const {error}=await db.rpc('zune_delivery_update_location',{p_delivery_id:b.dataset.gps,p_latitude:pos.coords.latitude,p_longitude:pos.coords.longitude});if(error)msg(error.message,true);else msg('Eneo lako la safari limesasishwa kwa mnunuzi.');b.disabled=false;},err=>{msg('Imeshindikana kupata eneo: '+err.message,true);b.disabled=false;},{enableHighAccuracy:true,timeout:15000,maximumAge:5000});});
}
async function load(){
 const {data:{user},error:authError}=await db.auth.getUser();if(authError)throw authError;
 if(!user){root.innerHTML='<h2>Ingia kwanza</h2><p class="muted">Ingia kwenye akaunti yako ya dereva ili kuona oda ulizopangiwa.</p><a class="primary" href="./login.html">Fungua ukurasa wa kuingia</a>';return;}
 const {data,error}=await db.rpc('zune_delivery_driver_queue');if(error)throw error;rows=data||[];render();
 if(currentDriverId!==user.id){
   currentDriverId=user.id;
   if(realtimeChannel) await db.removeChannel(realtimeChannel);
   realtimeChannel=db.channel('zune-driver-deliveries-'+user.id)
     .on('postgres_changes',{event:'*',schema:'public',table:'order_deliveries',filter:'assigned_driver_id=eq.'+user.id},()=>load().catch(e=>msg(e.message,true)))
     .subscribe();
 }
 if(!refreshTimer) refreshTimer=window.setInterval(()=>{if(document.visibilityState==='visible')load().catch(e=>msg(e.message,true));},20000);
 if(currentDriverId!==user.id){
   currentDriverId=user.id;
   if(realtimeChannel) await db.removeChannel(realtimeChannel);
   realtimeChannel=db.channel('zune-driver-deliveries-'+user.id)
     .on('postgres_changes',{event:'*',schema:'public',table:'order_deliveries',filter:'assigned_driver_id=eq.'+user.id},()=>load().catch(e=>msg(e.message,true)))
     .subscribe();
 }
 if(!refreshTimer) refreshTimer=window.setInterval(()=>{if(document.visibilityState==='visible')load().catch(e=>msg(e.message,true));},20000);
}
document.querySelector('#refreshJobs')?.addEventListener('click',async()=>{const b=document.querySelector('#refreshJobs');b.disabled=true;b.textContent='Inapakia...';try{await load()}catch(e){msg(e.message,true)}finally{b.disabled=false;b.textContent='Onyesha upya oda'}});
document.querySelector('#logoutJobs')?.addEventListener('click',async()=>{const {error}=await db.auth.signOut();if(error){msg(error.message,true);return}window.location.href='./login.html'});
load().catch(e=>{root.innerHTML='<h2>Imeshindikana kupakia oda</h2><p class="muted">'+esc(e.message)+'</p><a class="primary" href="./login.html">Rudi kuingia</a>';});
