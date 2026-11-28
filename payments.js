import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

const db = createClient('https://rpkogiieegqgxqbzwxwo.supabase.co','sb_publishable_2TEqZv-NBM9n5knU46ngqA_wqO3V1uf',{auth:{storageKey:'zune-delivery-driver-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $ = s => document.querySelector(s);
let lang='sw',busy=false,paymentData=[],deliveryData=[];
const words={
 sw:{title:'Wallet yangu',intro:'Muhtasari wa mapato yako na mwenendo wa delivery.',balance:'MAPATO HALISI',balanceHint:'Jumla baada ya makato ya ZUNE',withdraw:'Malipo ya ZUNE',withdrawHint:'Admin hulipa baada ya mnunuzi kuthibitisha kupokea',secure:'Malipo yanarekodiwa kwa usalama',overview:'Muhtasari wa fedha',live:'Taarifa za akaunti',gross:'Mapato ghafi',commission:'Makato ya ZUNE',earned:'Mapato halisi',paid:'Yamelipwa',pending:'Yanasubiri',completed:'Delivery zilizokamilika',analytics:'Mwenendo wa mapato',analyticsIntro:'Mapato yaliyorekodiwa kwa delivery katika siku 7 zilizopita.',chart:'Mapato ya delivery',chartNote:'Hutegemea taarifa zilizopo kwenye mfumo',history:'Historia ya malipo',historyIntro:'Rekodi rasmi za malipo zilizowekwa na ZUNE.',filter:'Kipindi',all:'Yote',days7:'Siku 7',days30:'Siku 30',days90:'Siku 90',deliveries:'Mapato kwa kila delivery',deliveriesIntro:'Oda zilizokamilika na kiasi cha dereva kilichowekwa kwenye mfumo.',emptyPayments:'Bado hakuna rekodi ya malipo.',emptyDeliveries:'Bado hakuna delivery iliyokamilika yenye malipo yaliyowekwa.',loading:'Inapakia...',refresh:'Onyesha upya',dashboard:'Dashibodi',logout:'Toka',amount:'Kiasi hakijawekwa',paidStatus:'Imelipwa',pendingStatus:'Inasubiri',processingStatus:'Inachakatwa',rejectedStatus:'Imekataliwa',unknown:'Haijulikani',fee:'Makato',net:'Unapokea',method:'Njia',delivery:'Delivery',order:'Oda',note:'Ada ya delivery anayolipa mnunuzi si sawa moja kwa moja na mapato ya dereva. Kiasi kinachoonekana hapa kinatokana na rekodi za malipo za ZUNE.',footer:'Wallet salama · Rekodi zinazoeleweka',noChart:'Hakuna mapato ya delivery yaliyorekodiwa katika kipindi hiki.',access:'Dashibodi hii ni ya madereva walioidhinishwa pekee.',failed:'Imeshindikana kupakia taarifa za malipo.',hold:'Imesimamishwa kwa mgogoro'},
 en:{title:'My wallet',intro:'Your earnings overview and delivery performance.',balance:'NET EARNINGS',balanceHint:'Total after ZUNE deductions',withdraw:'ZUNE payouts',withdrawHint:'Admin pays after buyer confirms receipt',secure:'Payments are securely recorded',overview:'Money overview',live:'Account information',gross:'Gross earnings',commission:'ZUNE deductions',earned:'Net earnings',paid:'Paid',pending:'Pending',completed:'Completed deliveries',analytics:'Earnings trend',analyticsIntro:'Delivery earnings recorded over the last 7 days.',chart:'Delivery earnings',chartNote:'Based on records available in the system',history:'Payment history',historyIntro:'Official payment records issued by ZUNE.',filter:'Period',all:'All time',days7:'7 days',days30:'30 days',days90:'90 days',deliveries:'Earnings per delivery',deliveriesIntro:'Completed deliveries with a driver payout recorded in the system.',emptyPayments:'There are no payment records yet.',emptyDeliveries:'No completed delivery with a payout amount yet.',loading:'Loading...',refresh:'Refresh',dashboard:'Dashboard',logout:'Log out',amount:'Amount not set',paidStatus:'Paid',pendingStatus:'Pending',processingStatus:'Processing',rejectedStatus:'Rejected',unknown:'Unknown',fee:'Deductions',net:'Net amount',method:'Method',delivery:'Delivery',order:'Order',note:'The customer delivery fee is not automatically the driver’s earnings. Amounts shown here come from ZUNE payment records.',footer:'Secure wallet · Clear records',noChart:'No delivery earnings have been recorded in this period.',access:'This dashboard is only available to approved drivers.',failed:'Could not load payment information.',hold:'Held for an open dispute'}
};
const t=k=>words[lang][k]||k;
const money=v=>new Intl.NumberFormat(lang==='sw'?'sw-TZ':'en-TZ',{style:'currency',currency:'TZS',maximumFractionDigits:0}).format(Number(v||0));
const date=v=>v?new Intl.DateTimeFormat(lang==='sw'?'sw-TZ':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(msg,error=false){const el=$('#notice');el.textContent=msg;el.classList.remove('hidden','error');if(error)el.classList.add('error');}
function methodLabel(m){return({mpesa:'M-Pesa',airtel_money:'Airtel Money',mixx_by_yas:'Mixx by Yas',halopesa:'HaloPesa',bank:lang==='sw'?'Benki':'Bank',cash:'Cash',manual:'Manual'})[m]||'—';}
function statusLabel(s){return({paid:t('paidStatus'),pending:t('pendingStatus'),processing:t('processingStatus'),rejected:t('rejectedStatus'),on_hold_dispute:t('hold')})[s]||t('unknown');}
function paymentState(p){return deliveryData.find(d=>d.id===p.delivery_id)?.payout_status==='on_hold_dispute'?'on_hold_dispute':p.status;}
function setLanguage(){
 $('#languageBtn').textContent=lang==='sw'?'EN':'SW';
 const ids={pageTitle:'title',pageIntro:'intro',balanceLabel:'balance',balanceHint:'balanceHint',withdrawLabel:'withdraw',withdrawHint:'withdrawHint',secureLabel:'secure',overviewTitle:'overview',liveLabel:'live',analyticsTitle:'analytics',analyticsIntro:'analyticsIntro',chartLegend:'chart',chartNote:'chartNote',historyTitle:'history',historyIntro:'historyIntro',filterLabel:'filter',deliveryTitle:'deliveries',deliveryIntro:'deliveriesIntro',footnote:'note',footerText:'footer',refreshBtn:'refresh',dashboardLink:'dashboard',logoutBtn:'logout'};
 Object.entries(ids).forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.textContent=t(key);});
 const f=$('#historyFilter');if(f)f.innerHTML='<option value="all">'+t('all')+'</option><option value="7">'+t('days7')+'</option><option value="30">'+t('days30')+'</option><option value="90">'+t('days90')+'</option>';
 renderPayments(paymentData);renderDeliveries(deliveryData);
}
function renderStats(totals={}){
 const cards=[[t('gross'),money(totals.gross_earned),'◈'],[t('commission'),money(totals.commission),'−'],[t('paid'),money(totals.paid),'✓'],[t('pending'),money(totals.pending),'◷'],[t('hold'),money(totals.on_hold_dispute),'!'],[t('completed'),String(totals.completed_deliveries||0),'▣']];
 $('#stats').innerHTML=cards.map(([label,value,icon])=>'<article class="stat wallet-stat"><span class="stat-symbol">'+icon+'</span><span>'+safe(label)+'</span><strong>'+safe(value)+'</strong></article>').join('');
 $('#walletBalance').textContent=money(totals.earned);
}
function inPeriod(value,days){if(days==='all')return true;const d=new Date(value||0);return !Number.isNaN(d.getTime())&&d>=new Date(Date.now()-Number(days)*86400000);}
function renderPayments(rows=paymentData){
 const filtered=rows.filter(p=>inPeriod(p.paid_at||p.created_at,$('#historyFilter')?.value||'all'));
 const body=$('#paymentRows'),mobile=$('#paymentMobile');
 if(!filtered.length){body.innerHTML='<tr><td colspan="7" class="empty-state">'+safe(t('emptyPayments'))+'</td></tr>';mobile.innerHTML='<div class="empty-state">'+safe(t('emptyPayments'))+'</div>';return;}
 const details=p=>'<details class="payment-details"><summary>'+(lang==='sw'?'Maelezo ya malipo':'Payment details')+'</summary><div><span>'+(lang==='sw'?'Namba ya malipo':'Payment phone')+': </span><b>'+safe(p.payment_phone||'—')+'</b></div><div><span>'+(lang==='sw'?'Rejea ya muamala':'Transaction reference')+': </span><b>'+safe(p.transaction_reference||'—')+'</b></div><div><span>'+(lang==='sw'?'Ujumbe wa ZUNE':'ZUNE note')+': </span><b>'+safe(p.admin_note||'—')+'</b></div></details>';
 body.innerHTML=filtered.map(p=>{const state=paymentState(p),statusClass=state==='on_hold_dispute'?'processing':state;return '<tr><td>'+safe(t('order'))+' #'+safe((Array.isArray(p.order_numbers)?p.order_numbers.join(', '):'')||String(p.delivery_id||'').slice(0,8).toUpperCase())+details(p)+'</td><td>'+safe(money(p.amount))+'</td><td>'+safe(money(p.deduction))+'</td><td><b>'+safe(money(p.net_amount))+'</b></td><td>'+safe(methodLabel(p.payment_method))+'</td><td><span class="payment-status '+safe(statusClass)+'">'+safe(statusLabel(state))+'</span></td><td>'+safe(date(p.paid_at||p.created_at))+'</td></tr>';}).join('');
 mobile.innerHTML=filtered.map(p=>{const state=paymentState(p),statusClass=state==='on_hold_dispute'?'processing':state;return '<article class="payment-mobile-card"><div class="mobile-card-top"><b>'+safe(t('order'))+' #'+safe((Array.isArray(p.order_numbers)?p.order_numbers.join(', '):'')||String(p.delivery_id||'').slice(0,8).toUpperCase())+'</b><span class="payment-status '+safe(statusClass)+'">'+safe(statusLabel(state))+'</span></div><strong class="mobile-net">'+safe(money(p.net_amount))+'</strong><small>'+safe(date(p.paid_at||p.created_at))+' · '+safe(methodLabel(p.payment_method))+'</small><div class="mobile-breakdown"><span>'+safe(t('fee'))+': '+safe(money(p.deduction))+'</span><span>'+safe(t('net'))+': '+safe(money(p.net_amount))+'</span></div>'+details(p)+'</article>';}).join('');
}
function renderDeliveries(rows=deliveryData){
 const box=$('#deliveryRows');if(!rows.length){box.innerHTML='<div class="empty-state">'+safe(t('emptyDeliveries'))+'</div>';return;}
 box.innerHTML=rows.map(d=>{const amount=d.driver_payout_amount==null?t('amount'):money(d.driver_payout_amount);const state=d.status==='completed'?(lang==='sw'?'Imekamilika':'Completed'):(lang==='sw'?'Imfikishwa · uthibitisho unasubiri':'Delivered · confirmation pending');return '<article class="earning-row"><div class="earning-mark">↗</div><div class="earning-detail"><strong>'+safe(t('delivery'))+' #'+safe((Array.isArray(d.order_numbers)?d.order_numbers.join(', '):'')||String(d.id||'').slice(0,8).toUpperCase())+'</strong><small>'+safe(state)+' · '+safe(date(d.created_at))+'</small></div><div class="earning-amount">'+safe(amount)+'</div></article>';}).join('');
}
function renderChart(rows=[]){
 const chart=$('#earningsChart'),days=[];for(let i=6;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);days.push(d);}
 const vals=days.map(day=>{const next=new Date(day);next.setDate(next.getDate()+1);return rows.filter(r=>{const d=new Date(r.created_at);return d>=day&&d<next&&r.driver_payout_amount!=null;}).reduce((sum,r)=>sum+Number(r.driver_payout_amount||0),0);});
 const max=Math.max(...vals,1);if(!vals.some(v=>v>0)){chart.innerHTML='<div class="chart-empty">'+safe(t('noChart'))+'</div>';return;}
 const fmt=d=>new Intl.DateTimeFormat(lang==='sw'?'sw-TZ':'en-GB',{weekday:'short'}).format(d);
 chart.innerHTML='<div class="chart-bars">'+vals.map((v,i)=>'<div class="chart-column"><div class="chart-value">'+(v?safe(money(v)):'')+'</div><div class="chart-track"><i style="height:'+Math.max(v?8:2,Math.round(v/max*100))+'%"></i></div><small>'+safe(fmt(days[i]))+'</small></div>').join('')+'</div>';
}
async function loadPayments(){
 if(busy)return;busy=true;$('#refreshBtn').disabled=true;
 $('#paymentRows').innerHTML='<tr><td colspan="7">'+safe(t('loading'))+'</td></tr>';$('#paymentMobile').innerHTML='<p class="muted">'+safe(t('loading'))+'</p>';$('#deliveryRows').innerHTML='<p class="muted">'+safe(t('loading'))+'</p>';
 try{const {data:sessionData,error:sessionError}=await db.auth.getSession();if(sessionError)throw sessionError;if(!sessionData.session){location.replace('./login.html');return;}
 const {data,error}=await db.rpc('zune_driver_payment_dashboard');if(error)throw error;if(!data||!data.totals)throw new Error(t('failed'));
 paymentData=Array.isArray(data.payments)?data.payments:[];deliveryData=Array.isArray(data.deliveries)?data.deliveries:[];
 renderStats(data.totals);renderPayments();renderDeliveries();renderChart(deliveryData);$('#notice').classList.add('hidden');
 }catch(error){notice(error.message||t('failed'),true);$('#paymentRows').innerHTML='<tr><td colspan="7">'+safe(error.message||t('failed'))+'</td></tr>';$('#paymentMobile').innerHTML='<div class="empty-state">'+safe(error.message||t('failed'))+'</div>';$('#deliveryRows').innerHTML='<div class="empty-state">'+safe(error.message||t('failed'))+'</div>';}
 finally{busy=false;$('#refreshBtn').disabled=false;}
}
$('#refreshBtn').addEventListener('click',loadPayments);
$('#historyFilter').addEventListener('change',()=>renderPayments());
$('#languageBtn').addEventListener('click',()=>{lang=lang==='sw'?'en':'sw';setLanguage();});
$('#logoutBtn').addEventListener('click',async()=>{const {error}=await db.auth.signOut();if(error){notice(error.message,true);return;}location.replace('./login.html');});
db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')location.replace('./login.html');});
setLanguage();loadPayments();