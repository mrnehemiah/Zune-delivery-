import{createClient}from'https://esm.sh/@supabase/supabase-js@2.119.0';
const db=createClient('https://rpkogiieegqgxqbzwxwo.supabase.co','sb_publishable_2TEqZv-NBM9n5knU46ngqA_wqO3V1uf',{auth:{storageKey:'zune-delivery-driver-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null,rows=[],filter='all',channel=null,lang='sw',busy=false;
try{lang=localStorage.getItem('zune_delivery_language')==='en'?'en':'sw'}catch{}
const icons={delivery_assigned:'📦',delivery_status:'🚚',application_approved:'🎉',application_rejected:'⚠️',document_approved:'🪪',document_rejected:'📄',vehicle_change_approved:'🏍️',vehicle_change_rejected:'⚠️',payment_paid:'💳',general:'🔔'};
const title=n=>lang==='en'?(n.title_en||n.title_sw):(n.title_sw||n.title_en);
const body=n=>lang==='en'?(n.body_en||n.body_sw):(n.body_sw||n.body_en);
function say(s,error=false){const el=$('#notifMessage');el.hidden=false;el.textContent=s;el.classList.toggle('error',error);setTimeout(()=>{el.hidden=true},4500)}
function time(v){const d=new Date(v);return d.toLocaleString(lang==='en'?'en-GB':'sw-TZ',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function safeUrl(url){const allowed=['./jobs.html','./payments.html','./profile.html','./driver-documents.html','./dashboard.html'];return allowed.includes(url)?url:'./dashboard.html'}
function render(){
 const unread=rows.filter(n=>!n.is_read).length;
 $('#notifUnreadHero').textContent=unread+' '+(lang==='en'?'unread':'mpya');
 $('#notifSummary').textContent=rows.length?(lang==='en'?rows.length+' notifications · '+unread+' unread':rows.length+' arifa · '+unread+' hazijasomwa'):(lang==='en'?'Your inbox is clear':'Kikasha chako kiko wazi');
 $('#filterAll').textContent=rows.length;$('#filterUnread').textContent=unread;$('#markAllRead').disabled=!unread;
 const visible=rows.filter(n=>filter==='all'||(filter==='unread'?!n.is_read:n.is_read));
 const list=$('#notificationList');
 if(!visible.length){list.innerHTML='<div class="notif-empty"><span class="notif-empty-icon">✦</span><h3>'+(filter==='unread'?(lang==='en'?'You are all caught up':'Hujabakiwa na arifa mpya'):(lang==='en'?'No notifications yet':'Bado hakuna arifa'))+'</h3><p>'+(lang==='en'?'New delivery, account, document and payment updates will appear here.':'Taarifa mpya za oda, akaunti, nyaraka na malipo zitaonekana hapa.')+'</p></div>';return}
 list.innerHTML=visible.map(n=>'<article class="notif-card '+(!n.is_read?'unread':'')+'" data-id="'+esc(n.id)+'"><span class="notif-symbol">'+(icons[n.type]||'🔔')+'</span><div class="notif-content"><h3>'+esc(title(n))+'</h3><p>'+esc(body(n)||'')+'</p><div class="notif-meta">'+(!n.is_read?'<i class="notif-unread-dot"></i>':'')+'<time>'+esc(time(n.created_at))+'</time></div></div><div class="notif-actions"><button class="notif-open" data-open="'+esc(n.id)+'">Fungua</button>'+(!n.is_read?'<button data-read="'+esc(n.id)+'">Soma</button>':'')+'<button data-delete="'+esc(n.id)+'" aria-label="Futa arifa">×</button></div></article>').join('');
}
async function load(){if(busy)return;busy=true;try{const{data,error}=await db.from('notifications').select('id,type,title_sw,title_en,body_sw,body_en,action_url,data,is_read,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);if(error)throw error;rows=data||[];render()}finally{busy=false}}
async function markRead(id){const{error}=await db.from('notifications').update({is_read:true,read_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id);if(error){say(error.message,true);return}rows=rows.map(n=>n.id===id?{...n,is_read:true}:n);render()}
async function remove(id){const{error}=await db.from('notifications').delete().eq('id',id).eq('user_id',user.id);if(error){say(error.message,true);return}rows=rows.filter(n=>n.id!==id);render()}
$('#notificationList').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.read||b.dataset.delete||b.dataset.open;if(!id)return;if(b.dataset.read){await markRead(id);return}if(b.dataset.delete){await remove(id);say(lang==='en'?'Notification deleted':'Arifa imefutwa');return}const n=rows.find(x=>x.id===id);if(n&&!n.is_read)await markRead(id);location.href=safeUrl(n?.action_url)});
$('#markAllRead').addEventListener('click',async()=>{const ids=rows.filter(n=>!n.is_read).map(n=>n.id);if(!ids.length)return;const{error}=await db.from('notifications').update({is_read:true,read_at:new Date().toISOString()}).eq('user_id',user.id).eq('is_read',false);if(error){say(error.message,true);return}rows=rows.map(n=>({...n,is_read:true}));render();say(lang==='en'?'All notifications marked as read':'Arifa zote zimesomwa')});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render()}));
$('#notifRefresh').onclick=()=>load().then(()=>say(lang==='en'?'Updated':'Imeboreshwa')).catch(e=>say(e.message,true));
$('#notifLogout').onclick=async()=>{await db.auth.signOut();location.replace('./login.html')};
async function init(){const{data:{session},error}=await db.auth.getSession();if(error)throw error;if(!session){location.replace('./login.html');return}user=session.user;await load();channel=db.channel('driver-notifications-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+user.id},()=>load().catch(e=>say(e.message,true))).subscribe();}
db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')location.replace('./login.html')});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)load().catch(e=>say(e.message,true))});
window.addEventListener('pagehide',()=>{if(channel)db.removeChannel(channel)});
init().catch(e=>say(e.message||'Imeshindikana kupakia arifa.',true));