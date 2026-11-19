import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

const db = createClient(
  'https://rpkogiieegqgxqbzwxwo.supabase.co',
  'sb_publishable_2TEqZv-NBM9n5knU46ngqA_wqO3V1uf',
  { auth: { storageKey: 'zune-delivery-driver-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
const $ = (selector) => document.querySelector(selector);
let lang = 'sw';
let busy = false;

const words = {
  sw: {
    title:'Malipo yangu', intro:'Fuatilia mapato ya delivery, malipo yaliyokamilika na yanayosubiri.',
    earned:'Jumla ya mapato', paid:'Yamelipwa', pending:'Yanasubiri', completed:'Delivery zilizokamilika',
    history:'Historia ya malipo', historyIntro:'Rekodi za malipo zilizowekwa na ZUNE Admin.',
    deliveries:'Mapato kwa kila delivery', deliveriesIntro:'Malipo huhesabiwa baada ya mnunuzi kuthibitisha kupokea mzigo na kiasi cha dereva kuwekwa kwenye oda.',
    emptyPayments:'Bado hakuna rekodi ya malipo.', emptyDeliveries:'Bado hakuna delivery iliyokamilika yenye malipo yaliyowekwa.',
    loading:'Inapakia...', refresh:'Onyesha upya', dashboard:'Dashibodi', logout:'Toka',
    amount:'Kiasi hakijawekwa', paidStatus:'Imelipwa', pendingStatus:'Inasubiri', processingStatus:'Inachakatwa', rejectedStatus:'Imekataliwa',
    unknown:'Haijulikani', fee:'Makato', net:'Unapokea', method:'Njia', delivery:'Delivery', order:'Oda',
    note:'Kumbuka: Ada ya delivery ya mnunuzi si sawa moja kwa moja na mapato ya dereva. Kiasi cha dereva huwekwa na mfumo wa malipo wa ZUNE; hakuna makadirio yanayoonyeshwa kama malipo halisi.',
    access:'Dashibodi hii ni ya madereva walioidhinishwa pekee.', failed:'Imeshindikana kupakia taarifa za malipo.'
  },
  en: {
    title:'My payments', intro:'Track delivery earnings, completed payouts and pending payments.',
    earned:'Total earnings', paid:'Paid', pending:'Pending', completed:'Completed deliveries',
    history:'Payment history', historyIntro:'Payment records issued by ZUNE Admin.',
    deliveries:'Earnings per delivery', deliveriesIntro:'Earnings are counted after the buyer confirms receipt and the driver payout amount is set for the delivery.',
    emptyPayments:'There are no payment records yet.', emptyDeliveries:'No completed delivery with a payout amount yet.',
    loading:'Loading...', refresh:'Refresh', dashboard:'Dashboard', logout:'Log out',
    amount:'Amount not set', paidStatus:'Paid', pendingStatus:'Pending', processingStatus:'Processing', rejectedStatus:'Rejected',
    unknown:'Unknown', fee:'Deductions', net:'Net amount', method:'Method', delivery:'Delivery', order:'Order',
    note:'Note: The customer delivery fee is not automatically the driver’s earnings. ZUNE must set the driver payout amount; estimates are never presented as actual payments.',
    access:'This dashboard is only available to approved drivers.', failed:'Could not load payment information.'
  }
};
const t = key => words[lang][key] || key;
const money = value => new Intl.NumberFormat(lang === 'sw' ? 'sw-TZ' : 'en-TZ', { style:'currency', currency:'TZS', maximumFractionDigits:0 }).format(Number(value || 0));
const date = value => value ? new Intl.DateTimeFormat(lang === 'sw' ? 'sw-TZ' : 'en-GB', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : '—';
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function notice(message, error = false) {
  const el = $('#notice');
  el.textContent = message;
  el.classList.remove('hidden','error');
  if (error) el.classList.add('error');
}
function methodLabel(method) { return ({mpesa:'M-Pesa',airtel_money:'Airtel Money',mixx_by_yas:'Mixx by Yas',halopesa:'HaloPesa',bank:lang==='sw'?'Benki':'Bank',cash:'Cash',manual:'Manual'})[method] || '—'; }\nfunction statusLabel(status) {
  return ({paid:t('paidStatus'),pending:t('pendingStatus'),processing:t('processingStatus'),rejected:t('rejectedStatus')})[status] || t('unknown');
}
function setLanguage() {
  $('#languageBtn').textContent = lang === 'sw' ? 'EN' : 'SW';
  $('#pageTitle').textContent = t('title');
  $('#pageIntro').textContent = t('intro');
  $('#historyTitle').textContent = t('history');
  $('#historyIntro').textContent = t('historyIntro');
  $('#deliveryTitle').textContent = t('deliveries');
  $('#deliveryIntro').textContent = t('deliveriesIntro');
  $('#footnote').textContent = t('note');
  $('#refreshBtn').textContent = t('refresh');
  $('#dashboardLink').textContent = t('dashboard');
  $('#logoutBtn').textContent = t('logout');
}
function renderStats(totals = {}) {
  const cards = [
    [t('earned'), money(totals.earned)],
    [t('paid'), money(totals.paid)],
    [t('pending'), money(totals.pending)],
    [t('completed'), String(totals.completed_deliveries || 0)]
  ];
  $('#stats').innerHTML = cards.map(([label,value]) => '<article class="stat"><span>'+safe(label)+'</span><strong>'+safe(value)+'</strong></article>').join('');
}
function renderPayments(rows = []) {
  const body = $('#paymentRows');
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty-state">'+safe(t('emptyPayments'))+'</td></tr>';
    return;
  }
  body.innerHTML = rows.map(p => '<tr>'+
    '<td>'+safe(t('order'))+' #'+safe(String(p.delivery_id || '').slice(0,8).toUpperCase())+
    (p.transaction_reference ? '<br><small>'+safe(p.transaction_reference)+'</small>' : '')+'</td>'+
    '<td>'+safe(money(p.amount))+'</td><td>'+safe(money(p.deduction))+'</td>'+
    '<td><b>'+safe(money(p.net_amount))+'</b></td>'+
    '<td><span class="payment-status '+safe(p.status)+'">'+safe(statusLabel(p.status))+'</span></td>'+
    '<td>'+safe(date(p.paid_at || p.created_at))+'</td></tr>').join('');
}
function renderDeliveries(rows = []) {
  const box = $('#deliveryRows');
  if (!rows.length) {
    box.innerHTML = '<div class="empty-state">'+safe(t('emptyDeliveries'))+'</div>';
    return;
  }
  box.innerHTML = rows.map(d => {
    const amount = d.driver_payout_amount == null ? t('amount') : money(d.driver_payout_amount);
    const state = d.status === 'completed' ? (lang === 'sw' ? 'Imekamilika' : 'Completed') : (lang === 'sw' ? 'Imfikishwa · uthibitisho unasubiri' : 'Delivered · confirmation pending');
    return '<article class="earning-row"><div><strong>'+safe(t('delivery'))+' #'+safe(String(d.id || '').slice(0,8).toUpperCase())+'</strong><small>'+safe(state)+' · '+safe(date(d.created_at))+'</small></div><div class="earning-amount">'+safe(amount)+'</div></article>';
  }).join('');
}
async function loadPayments() {
  if (busy) return;
  busy = true;
  $('#refreshBtn').disabled = true;
  $('#paymentRows').innerHTML = '<tr><td colspan="6">'+safe(t('loading'))+'</td></tr>';
  $('#deliveryRows').innerHTML = '<p class="muted">'+safe(t('loading'))+'</p>';
  try {
    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) { location.replace('./login.html'); return; }
    const { data, error } = await db.rpc('zune_driver_payment_dashboard');
    if (error) throw error;
    if (!data || !data.totals) throw new Error(t('failed'));
    renderStats(data.totals);
    renderPayments(data.payments || []);
    renderDeliveries(data.deliveries || []);
    $('#notice').classList.add('hidden');
  } catch (error) {
    notice(error.message || t('failed'), true);
    $('#paymentRows').innerHTML = '<tr><td colspan="6">'+safe(error.message || t('failed'))+'</td></tr>';
    $('#deliveryRows').innerHTML = '<div class="empty-state">'+safe(error.message || t('failed'))+'</div>';
  } finally {
    busy = false;
    $('#refreshBtn').disabled = false;
  }
}
$('#refreshBtn').addEventListener('click', loadPayments);
$('#languageBtn').addEventListener('click', () => { lang = lang === 'sw' ? 'en' : 'sw'; setLanguage(); loadPayments(); });
$('#logoutBtn').addEventListener('click', async () => {
  const { error } = await db.auth.signOut();
  if (error) { notice(error.message, true); return; }
  location.replace('./login.html');
});
db.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') location.replace('./login.html');
});
setLanguage();
loadPayments();
