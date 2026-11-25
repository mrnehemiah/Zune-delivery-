import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const db=createClient('https://rpkogiieegqgxqbzwxwo.supabase.co','sb_publishable_2TEqZv-NBM9n5knU46ngqA_wqO3V1uf',{auth:{storageKey:'zune-delivery-driver-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const root=document.querySelector('#driverJobs'),notice=document.querySelector('#jobsNotice');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={assigned:'Dereva amechaguliwa',ready_for_pickup:'Subiri uthibitisho wa muuzaji',picked_up:'Umepokea mzigo',in_transit:'Uko njiani',delivered:'Umefikisha · subiri mnunuzi',completed:'Imekamilika'};
let rows=[],gpsTimer=null,trackingDeliveryId=null,driverMaps=[],activeFilter='all',loading=false;
const money=v=>'TSh '+Number(v||0).toLocaleString('en-US');
const iconPaths={
 user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
 phone:'<path d="M7 3h3l2 5-2 2a15 15 0 0 0 4 4l2-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 5 5a2 2 0 0 1 2-2Z"/>',
 pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
 package:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9M8 5.2l8 4.5"/>',
 box:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>'
};
function svgIcon(name){return '<svg class="jobs-icon-svg" viewBox="0 0 24 24" aria-hidden="true">'+(iconPaths[name]||iconPaths.box)+'</svg>';}

function msg(s,err=false){notice.textContent=s;notice.classList.remove('hidden','error');if(err)notice.classList.add('error')}
function group(d){if(d.delivery_status==='completed')return'done';if(['picked_up','in_transit','delivered'].includes(d.delivery_status))return'active';return'waiting'}
function counts(){const c={all:rows.length,waiting:0,active:0,done:0};rows.forEach(d=>c[group(d)]++);[['All','all'],['Waiting','waiting'],['Active','active'],['Done','done']].forEach(([id,k])=>{const a=document.querySelector('#count'+id),b=document.querySelector('#filter'+id);if(a)a.textContent=c[k];if(b)b.textContent=c[k]});}
function stageIndex(s){return({assigned:0,ready_for_pickup:0,picked_up:1,in_transit:2,delivered:3,completed:4})[s]??0}
function stageMarkup(s){const n=stageIndex(s);return '<div class="jobs-stage" aria-label="Hatua ya delivery">'+[0,1,2,3].map(i=>'<span class="'+(i<n?'passed':'')+'"></span>').join('')+'</div>'}
function card(d){
 const id=esc(d.delivery_id),state=d.delivery_status||'',g=group(d);
 let action='';
 if(state==='assigned'){
 const deadline=d.driver_response_deadline?new Date(d.driver_response_deadline):null;
 if(d.driver_response_status==='pending'&&deadline&&deadline.getTime()>Date.now()){
  action='<div class="jobs-response"><p><b>Ombi jipya la delivery.</b> Kubali au kataa ndani ya dakika 10. Muda wa mwisho: '+esc(deadline.toLocaleTimeString('sw-TZ',{hour:'2-digit',minute:'2-digit'}))+'</p><button class="primary" data-accept="'+id+'">Kubali oda</button><button class="ghost" data-reject="'+id+'">Kataa oda</button></div>';
 }else if(d.driver_response_status==='accepted')action='<p class="jobs-subtitle">Umekubali oda hii. Subiri muuzaji athibitishe makabidhiano ya mzigo.</p>';
 else if(d.driver_response_status==='rejected')action='<p class="jobs-subtitle">Ulikataa oda hii. Muuzaji atakuchagulia dereva mwingine.</p>';
 else action='<p class="jobs-subtitle">Muda wa kujibu umeisha. Muuzaji anaweza kupanga dereva mwingine.</p>';
}
if(state==='ready_for_pickup')action='<button class="primary" data-pick="'+id+'">Nimethibitisha kupokea mzigo</button>';
 if(state==='picked_up')action='<button class="primary" data-transit="'+id+'">Anza safari</button>';
 if(state==='in_transit')action='<button class="primary" data-delivered="'+id+'">Nimemfikishia mnunuzi</button><button class="ghost" data-gps-toggle="'+id+'">'+(trackingDeliveryId===d.delivery_id?'Zima GPS':'Washa live GPS')+'</button>';
 const itemRows=Array.isArray(d.delivery_items)?d.delivery_items:[];
 const itemsMarkup=itemRows.length
  ? '<section class="jobs-items"><div class="jobs-items-heading">BIDHAA ZA ODA <span>'+itemRows.length+'</span></div>'+itemRows.map(item=>'<div class="jobs-item-row"><div class="jobs-item-copy"><b>'+esc(item.product_name||'Bidhaa')+'</b>'+(item.variant_label?'<small>Chaguo: '+esc(item.variant_label)+'</small>':'')+(item.variant_sku?'<small>SKU: '+esc(item.variant_sku)+'</small>':'')+'</div><strong>× '+esc(item.quantity||0)+'</strong></div>').join('')+'</section>'
  : '<section class="jobs-items jobs-items-empty"><small>Maelezo ya bidhaa hayajapatikana kwa delivery hii.</small></section>';
 const hasCoords=d.latitude!=null&&d.longitude!=null;
 const map=hasCoords?'<div class="jobs-map-wrap"><div class="driver-destination-map" id="driver-map-'+id+'" aria-label="Ramani ya eneo la mteja"></div><p class="driver-map-caption">Eneo la kufikisha mzigo · '+esc([d.delivery_address,d.district,d.region].filter(Boolean).join(', '))+'</p><a class="driver-route-link" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(d.latitude+','+d.longitude)+'">Fungua maelekezo ya safari ↗</a></div>':'<div class="jobs-map-wrap"><p class="driver-map-caption">Anwani ya ramani haijawekwa kwa GPS. Unaweza kutafuta eneo kwa kutumia anwani.</p><a class="driver-route-link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([d.delivery_address,d.district,d.region].filter(Boolean).join(', '))+'">Tafuta anwani kwenye ramani ↗</a></div>';
 const stateClass=g==='done'?'done':g==='active'?'active':'';
 return '<article class="application-card jobs-card"><header class="jobs-card-head"><strong class="jobs-order-ref">ODA #'+esc((d.order_number||String(d.delivery_id).slice(0,8).toUpperCase()))+'</strong><span class="jobs-state '+stateClass+'">'+esc(labels[state]||state||'Hali haijulikani')+'</span></header><div class="jobs-card-body"><div class="jobs-recipient"><span class="jobs-avatar">'+svgIcon('user')+'</span><div><small>ANAYEPOKEA MZIGO</small><strong>'+esc(d.recipient_name||'Taarifa za mpokeaji hazipo')+'</strong></div></div><div class="jobs-detail-line"><span class="jobs-detail-icon">'+svgIcon('phone')+'</span><div><small>Mawasiliano</small><b>'+esc(d.recipient_phone||'Hayajapatikana')+'</b></div></div><div class="jobs-detail-line"><span class="jobs-detail-icon">'+svgIcon('pin')+'</span><div><small>Anwani ya kufikisha</small><b>'+esc([d.delivery_address,d.district,d.region].filter(Boolean).join(', ')||'Anwani haijawekwa')+'</b></div></div>'+itemsMarkup+'<div class="jobs-fee-row"><span>Malipo ya delivery</span><strong>'+money(d.delivery_fee)+'</strong></div>'+stageMarkup(state)+'</div><div class="jobs-card-actions">'+(action||'<span class="jobs-subtitle">'+(g==='done'?'Oda hii imekamilika.':'Subiri hatua inayofuata ya oda hii.')+'</span>')+'</div>'+map+'</article>';
}
function render(){
 driverMaps.forEach(m=>{try{m.remove()}catch(_){}});driverMaps=[];
 counts();
 const visible=rows.filter(d=>activeFilter==='all'||group(d)===activeFilter);
 if(!visible.length){root.innerHTML='<div class="jobs-empty"><span class="jobs-empty-icon">'+svgIcon('box')+'</span><h3>'+(rows.length?'Hakuna oda kwenye kichujio hiki':'Bado hujapangiwa oda')+'</h3><p>'+(rows.length?'Badili kichujio ili kuona oda nyingine.':'Oda zitaonekana hapa baada ya muuzaji kukuchagua kupitia mfumo.')+'</p></div>';return;}
 root.innerHTML=visible.map(card).join('');
 if(window.L){visible.forEach(d=>{if(d.latitude==null||d.longitude==null)return;const node=document.getElementById('driver-map-'+d.delivery_id);if(!node)return;const m=L.map(node,{scrollWheelZoom:false}).setView([Number(d.latitude),Number(d.longitude)],15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);L.marker([Number(d.latitude),Number(d.longitude)]).addTo(m).bindPopup('Eneo la mteja / sehemu ya kufikisha mzigo');driverMaps.push(m);});}
 root.querySelectorAll('[data-accept]').forEach(b=>b.onclick=async()=>{b.disabled=true;const {data,error}=await db.rpc('zune_delivery_driver_accept',{p_delivery_id:b.dataset.accept});if(error){msg(error.message,true);b.disabled=false;return;}if(!data?.ok){msg(data?.message||'Muda wa kujibu umeisha.',true);}else msg('Umekubali jukumu la delivery.');await load();});
 root.querySelectorAll('[data-reject]').forEach(b=>b.onclick=async()=>{const reason=window.prompt('Eleza sababu ya kukataa oda hii (angalau herufi 3):');if(reason===null)return;if(reason.trim().length<3){msg('Sababu ni fupi sana.',true);return;}b.disabled=true;const {data,error}=await db.rpc('zune_delivery_driver_reject',{p_delivery_id:b.dataset.reject,p_reason:reason.trim()});if(error){msg(error.message,true);b.disabled=false;return;}if(!data?.ok){msg(data?.message||'Muda wa kujibu umeisha.',true);}else msg('Umeikataa oda. Muuzaji amepokea taarifa na anaweza kuchagua dereva mwingine.');await load();});
 root.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>act('zune_delivery_driver_pickup',{p_delivery_id:b.dataset.pick,p_note:'Dereva amethibitisha kupokea mzigo.'},'Umethibitisha kupokea mzigo.'));
 root.querySelectorAll('[data-transit]').forEach(b=>b.onclick=()=>act('zune_delivery_driver_in_transit',{p_delivery_id:b.dataset.transit},'Safari imeanza.'));
 root.querySelectorAll('[data-delivered]').forEach(b=>b.onclick=()=>act('zune_delivery_driver_delivered',{p_delivery_id:b.dataset.delivered,p_note:'Dereva amethibitisha kufikisha mzigo.'},'Umeweka mzigo kuwa umefikishwa. Mnunuzi sasa athibitishe kupokea.'));
 root.querySelectorAll('[data-gps-toggle]').forEach(b=>b.onclick=()=>{const id=b.dataset.gpsToggle;if(trackingDeliveryId===id){stopGps();msg('Ufuatiliaji wa GPS umesimamishwa.');render();return;}startGps(id);});
}
async function act(fn,args,success){const {error}=await db.rpc(fn,args);if(error){msg(error.message,true);return;}if(fn==='zune_delivery_driver_delivered'&&trackingDeliveryId===args.p_delivery_id)stopGps();if(fn==='zune_delivery_driver_in_transit')startGps(args.p_delivery_id);msg(success);await load();}
function startGps(id){if(!navigator.geolocation){msg('Kifaa hiki hakina GPS inayopatikana.',true);return;}stopGps();trackingDeliveryId=id;msg('Live GPS imewashwa. Eneo lako litasasishwa kila sekunde 20 wakati safari inaendelea na ukurasa uko wazi.');render();sendGps(id);gpsTimer=window.setInterval(()=>{if(!document.hidden&&trackingDeliveryId===id)sendGps(id);},20000);}
function stopGps(){if(gpsTimer)window.clearInterval(gpsTimer);gpsTimer=null;trackingDeliveryId=null;}
function sendGps(id){if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(async pos=>{const{error}=await db.rpc('zune_delivery_update_location',{p_delivery_id:id,p_latitude:pos.coords.latitude,p_longitude:pos.coords.longitude});if(error)msg(error.message,true);else msg('Eneo la dereva limesasishwa kwa mnunuzi.');},err=>msg('Imeshindikana kupata eneo: '+err.message,true),{enableHighAccuracy:true,timeout:15000,maximumAge:10000});}
async function load(){
 if(loading)return;loading=true;
 try{const {data:{user},error:authError}=await db.auth.getUser();if(authError)throw authError;if(!user){root.innerHTML='<div class="jobs-empty"><h3>Ingia kwanza</h3><p>Ingia kwenye akaunti yako ya dereva ili kuona oda ulizopangiwa.</p><a class="primary" href="./login.html">Fungua ukurasa wa kuingia</a></div>';return;}
 const {data,error}=await db.rpc('zune_delivery_driver_queue');if(error)throw error;rows=await Promise.all((data||[]).map(async d=>{const[{data:orderNumber,error:orderNumberError},{data:deliveryItems,error:itemsError}]=await Promise.all([db.rpc('zune_delivery_driver_order_numbers',{p_delivery_id:d.delivery_id}),db.rpc('zune_delivery_driver_items',{p_delivery_id:d.delivery_id})]);if(orderNumberError)console.warn('Delivery Order ID:',orderNumberError.message);if(itemsError)console.warn('Delivery items:',itemsError.message);return {...d,order_number:orderNumber||null,delivery_items:Array.isArray(deliveryItems)?deliveryItems:[]};}));render();document.querySelector('#lastUpdated').textContent='Imesasishwa '+new Date().toLocaleTimeString('sw-TZ',{hour:'2-digit',minute:'2-digit'});notice.classList.add('hidden');
 }finally{loading=false;}
}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render();}));
document.querySelector('#refreshJobs')?.addEventListener('click',async()=>{const b=document.querySelector('#refreshJobs');b.disabled=true;b.innerHTML='<span>↻</span> Inapakia…';try{await load()}catch(e){msg(e.message,true)}finally{b.disabled=false;b.innerHTML='<span>↻</span> Onyesha upya';}});
document.querySelector('#logoutJobs')?.addEventListener('click',async()=>{const {error}=await db.auth.signOut();if(error){msg(error.message,true);return}window.location.href='./login.html'});
load().catch(e=>{root.innerHTML='<div class="jobs-empty"><h3>Imeshindikana kupakia oda</h3><p>'+esc(e.message)+'</p><button class="jobs-refresh" onclick="location.reload()">Jaribu tena</button></div>';});
setInterval(()=>{if(!document.hidden)load().catch(e=>msg(e.message,true));},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load().catch(e=>msg(e.message,true));});
window.addEventListener('pagehide',stopGps);