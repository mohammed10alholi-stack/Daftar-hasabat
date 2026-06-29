/* ============================================================
   دفتر الحسابات — PWA كامل (Vanilla JS)
   عملات منفصلة + حركات + محافظ + ديون مربوطة بالمحافظ
   + تذكير ديون + رسم بياني شهري + نسخ احتياطي/تصدير CSV
   البيانات بتنحفظ بـ localStorage (تشتغل أوفلاين)
   ============================================================ */

const STORE_KEY = "alwateen-finance-v1";

const DEFAULT_INCOME_CATS = [
  { id: "salary", label: "راتب / أجر", icon: "💼" },
  { id: "lab", label: "دخل المختبر", icon: "🔬" },
  { id: "freelance", label: "عمل إضافي", icon: "🧰" },
  { id: "support", label: "هدية / دعم", icon: "🎁" },
  { id: "other_in", label: "أخرى", icon: "➕" },
];
const DEFAULT_EXPENSE_CATS = [
  { id: "food", label: "طعام وشراب", icon: "🍽️" },
  { id: "transport", label: "مواصلات", icon: "🚗" },
  { id: "bills", label: "فواتير", icon: "🧾" },
  { id: "health", label: "صحة وأدوية", icon: "💊" },
  { id: "shopping", label: "تسوّق", icon: "🛍️" },
  { id: "rent", label: "إيجار", icon: "🏠" },
  { id: "family", label: "مصاريف العائلة", icon: "👨‍👩‍👧" },
  { id: "work_expense", label: "مصاريف الشغل", icon: "🏢" },
  { id: "maintenance", label: "صيانة", icon: "🔧" },
  { id: "other_out", label: "أخرى", icon: "•" },
];
const EXTRA_CATS = [
  { id: "debt_payment", label: "تسديد دَين", icon: "📌" },
  { id: "debt_collect", label: "تحصيل دَين", icon: "🤝" },
  { id: "debt_lend", label: "دَين أعطيته", icon: "🤝" },
  { id: "debt_borrow", label: "دَين أخذته", icon: "📌" },
];
const LEGACY_CATS = { lab_supplies: { label: "مصاريف الشغل", icon: "🏢" } };
const EMOJIS = ["🍽️","🚗","🧾","💊","🛍️","🏠","👨‍👩‍👧","🏢","🔧","💼","🔬","🧰","🎁","💰","📱","🏦","👛","📦","⚡","🚌","☕","🍞","👶","🎓","🩺","🛒","🧹","🔌","✈️","🎉","➕","•"];
function catInfo(id) {
  const all = [ ...((state.cats&&state.cats.income)||[]), ...((state.cats&&state.cats.expense)||[]), ...EXTRA_CATS ];
  return all.find((c)=>c.id===id) || LEGACY_CATS[id] || { label:"أخرى", icon:"•" };
}

const AR_MONTHS = ["كانون الثاني","شباط","آذار","نيسان","أيار","حزيران","تموز","آب","أيلول","تشرين الأول","تشرين الثاني","كانون الأول"];
const AR_MONTHS_SHORT = ["ك2","شب","آذ","نيس","أيا","حز","تم","آب","أيل","ت1","ت2","ك1"];
const CURRENCIES = [{ sym: "₪", name: "شيكل" }, { sym: "$", name: "دولار" }, { sym: "د.أ", name: "دينار" }];
const WALLET_SUGGEST = ["بنك", "محفظة بال بي", "محفظة جوال بي", "محفظة كاش"];

/* إعدادات الاشتراك والدفع (قابلة للتعديل من شاشة المالك) */
const PAY_KEY = "daftar-pay-v1";
const PAY_DEFAULT = {
  whatsapp: "970597210118",
  methods: [
    { icon:"📱", name:"جوال بي", val:"0597210118" },
    { icon:"📱", name:"بال بي", val:"0567385853" },
    { icon:"🏦", name:"بنك فلسطين", val:"حساب رقم 1255769 (أو 0567385853)" },
  ],
  plans: [
    { name:"شهري", price:"10 ₪" },
    { name:"6 شهور", price:"50 ₪" },
    { name:"سنوي", price:"90 ₪", best:true },
  ],
};
let PAY = JSON.parse(JSON.stringify(PAY_DEFAULT));
function loadPay(){
  try{ const raw=localStorage.getItem(PAY_KEY); if(raw){ const s=JSON.parse(raw);
    if(s.whatsapp) PAY.whatsapp=s.whatsapp;
    if(Array.isArray(s.methods)&&s.methods.length) PAY.methods=s.methods;
    if(Array.isArray(s.plans)&&s.plans.length) PAY.plans=s.plans;
  } }catch(e){}
}
function savePay(){ try{ localStorage.setItem(PAY_KEY, JSON.stringify({whatsapp:PAY.whatsapp,methods:PAY.methods,plans:PAY.plans})); }catch(e){} }
function waLink(planName, planPrice){
  let msg = "السلام عليكم 👋\nبدي أشترك بتطبيق دفتر الحسابات.\n";
  if (planName) msg += "الخطة: " + planName + (planPrice?(" ("+planPrice+")"):"") + "\n";
  msg += "رمز جهازي: " + getDeviceId() + "\n";
  msg += "هذا إشعار التحويل 👇 (أرفقت صورة الإشعار)\nالاسم اللي بدي يطلع بالتفعيل: ";
  return "https://wa.me/" + PAY.whatsapp + "?text=" + encodeURIComponent(msg);
}

/* ---------- أدوات ---------- */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function monthKeyOf(s) { return s.slice(0, 7); }
function fmt(n) {
  const neg = n < 0, v = Math.abs(Math.round(n*100)/100);
  return (neg?"-":"") + v.toLocaleString("en-US",{minimumFractionDigits:v%1?2:0,maximumFractionDigits:2});
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function esc(s) {
  return String(s==null?"":s).replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}
function walletIcon(name) {
  const n = (name||"");
  if (n.includes("بنك")) return "🏦";
  if (n.includes("بال بي") || n.includes("جوال") || n.includes("إلكترون") || n.includes("الكترون")) return "📱";
  return "👛";
}
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function addDays(dateStr, n){ const d=new Date(dateStr); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }

/* ============================================================
   نظام الترخيص (تجربة + تفعيل بكود)
   ملاحظة: حماية برمجية محلية (بدون سيرفر) — توقف المستخدم العادي.
   ============================================================ */
const LIC_KEY = "daftar-license-v1";
const TRIAL_DAYS = 2;
const LIC_SECRET = "531abcf9ff4ccd94d45020c6a960b04f7c720e28f48687b9";

function _sha256(bytes){
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const l=bytes.length, withOne=l+1, k=((((withOne+8)+63)&~63)-withOne-8), total=withOne+k+8;
  const m=new Uint8Array(total); m.set(bytes); m[l]=0x80;
  const dv=new DataView(m.buffer), bitLen=l*8;
  dv.setUint32(total-4,bitLen>>>0); dv.setUint32(total-8,Math.floor(bitLen/0x100000000));
  const w=new Uint32Array(64), rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let i=0;i<total;i+=64){
    for(let j=0;j<16;j++) w[j]=dv.getUint32(i+j*4);
    for(let j=16;j<64;j++){ const s0=rotr(w[j-15],7)^rotr(w[j-15],18)^(w[j-15]>>>3); const s1=rotr(w[j-2],17)^rotr(w[j-2],19)^(w[j-2]>>>10); w[j]=(w[j-16]+s0+w[j-7]+s1)|0; }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for(let j=0;j<64;j++){ const S1=rotr(e,6)^rotr(e,11)^rotr(e,25); const ch=(e&f)^(~e&g); const t1=(h+S1+ch+K[j]+w[j])|0; const S0=rotr(a,2)^rotr(a,13)^rotr(a,22); const maj=(a&b)^(a&c)^(b&c); const t2=(S0+maj)|0; h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0; }
    h0=(h0+a)|0;h1=(h1+b)|0;h2=(h2+c)|0;h3=(h3+d)|0;h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+h)|0;
  }
  const out=new Uint8Array(32), odv=new DataView(out.buffer);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach((hh,idx)=>odv.setUint32(idx*4,hh>>>0));
  return out;
}
function _utf8(s){ return new TextEncoder().encode(s); }
function hmacSha256(keyStr,msgStr){
  let key=_utf8(keyStr); if(key.length>64) key=_sha256(key);
  const block=new Uint8Array(64); block.set(key);
  const ipad=new Uint8Array(64), opad=new Uint8Array(64);
  for(let i=0;i<64;i++){ ipad[i]=block[i]^0x36; opad[i]=block[i]^0x5c; }
  const msg=_utf8(msgStr);
  const inner=new Uint8Array(64+msg.length); inner.set(ipad); inner.set(msg,64);
  const ih=_sha256(inner);
  const outer=new Uint8Array(96); outer.set(opad); outer.set(ih,64);
  return _sha256(outer);
}
const _B32="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function _toB32(bytes,len){ let bits=0,val=0,out=""; for(let i=0;i<bytes.length&&out.length<len;i++){ val=((val<<8)|bytes[i])>>>0; bits+=8; while(bits>=5&&out.length<len){ out+=_B32[(val>>>(bits-5))&31]; bits-=5; } } return out; }
function normName(n){ return (n||"").trim().replace(/\s+/g," ").toLowerCase(); }
const PLAN_DAYS = { M:30, H:180, Y:365 };
const PLAN_LABEL = { M:"شهر", H:"6 شهور", Y:"سنة", life:"دائم" };
function _codeBody(name, device, planKey){ const d=hmacSha256(LIC_SECRET, normName(name)+"|"+(device||"")+(planKey?("|"+planKey):"")); const r=_toB32(d,12); return r.slice(0,4)+"-"+r.slice(4,8)+"-"+r.slice(8,12); }
function makeCode(name, device){ return _codeBody(name, device, ""); }                 // دائم (للمالك/التوافق القديم)
function makeCodePlan(name, device, plan){ return plan+"-"+_codeBody(name, device, plan); } // باشتراك بمدة
function parseCode(name, code, device){
  const raw=(code||"").toUpperCase().replace(/\s/g,"");
  const parts=raw.split("-").filter(Boolean);
  if(parts.length===4 && parts[0].length===1 && PLAN_DAYS[parts[0]]){
    const plan=parts[0], body=parts.slice(1).join("");
    if(body && body===_codeBody(name,device,plan).replace(/-/g,"")) return { valid:true, plan, days:PLAN_DAYS[plan] };
    return { valid:false };
  }
  const body=parts.join("");
  if(body && body===makeCode(name,device).replace(/-/g,"")) return { valid:true, plan:"life", days:null };
  return { valid:false };
}
function checkCode(name,code,device){ return parseCode(name,code,device).valid; }

let lic = { installedAt: null, pro: false, name: "", code: "", device: "", plan: "", activatedAt: null, expiry: null };
function getDeviceId(){
  if (lic.device) return lic.device;
  // بصمة جهاز عشوائية ثابتة لهذا الجهاز
  const rand = (Date.now().toString(36) + Math.random().toString(36).slice(2)).toUpperCase().replace(/[^0-9A-Z]/g,"");
  lic.device = _toB32(hmacSha256(LIC_SECRET, "dev:"+rand), 6); // رمز قصير 6 خانات
  saveLic();
  return lic.device;
}
function loadLic(){
  try{ const raw=localStorage.getItem(LIC_KEY); if(raw){ const s=JSON.parse(raw); lic={...lic,...s}; } }catch(e){}
  if(!lic.installedAt){ lic.installedAt = todayStr(); saveLic(); }
  if(!lic.device){ getDeviceId(); }
}
function saveLic(){ try{ localStorage.setItem(LIC_KEY, JSON.stringify(lic)); }catch(e){} }
function licStatus(){
  if(lic.pro && checkCode(lic.name, lic.code, lic.device)){
    if(!lic.expiry) return { kind:"pro", plan:"life" };               // دائم (المالك أو كود قديم)
    const left = daysBetween(todayStr(), lic.expiry);
    if(left>=0) return { kind:"pro", plan:lic.plan, days:left, expiry:lic.expiry };
    return { kind:"expired_sub" };                                     // انتهى الاشتراك
  }
  const used = Math.max(0, daysBetween(lic.installedAt, todayStr()));
  const left = TRIAL_DAYS - used;
  return left>0 ? { kind:"trial", days:left } : { kind:"expired" };
}
function tryActivate(name,code){ const dev=getDeviceId(); const r=parseCode(name,code,dev);
  if(r.valid){ lic.pro=true; lic.name=name.trim(); lic.code=code.trim(); lic.plan=r.plan;
    lic.activatedAt=todayStr(); lic.expiry = r.days ? addDays(todayStr(), r.days) : null; saveLic(); return true; }
  return false; }
const OWNER_NAME = "mohrft"; // = normName("MohRft")
function isOwner(){ return lic.pro && checkCode(lic.name, lic.code, lic.device) && normName(lic.name)===OWNER_NAME; }

/* ---------- الحالة ---------- */
let state = {
  transactions: [], debts: [], wallets: [], cats: null,
  activeCur: "₪", tab: "accounts",
  viewMonth: monthKeyOf(todayStr()),
  accountFilter: "all", debtFilter: "all", showSettled: false,
};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const oldCur = s.currency || "₪";
      state.transactions = (s.transactions||[]).map((t)=>({...t, cur:t.cur||oldCur}));
      state.debts = (s.debts||[]).map((d)=>({...d, cur:d.cur||oldCur}));
      state.wallets = (s.wallets||[]).map((w)=>({...w, cur:w.cur||oldCur, opening: w.opening!==undefined?w.opening:(Number(w.balance)||0)}));
      state.activeCur = s.activeCur || oldCur;
      if (s.cats && Array.isArray(s.cats.income) && Array.isArray(s.cats.expense)) state.cats = s.cats;
    }
  } catch (e) { /* وضع المعاينة بدون تخزين */ }
  if (!state.cats) state.cats = {
    income: DEFAULT_INCOME_CATS.map((c)=>({...c})),
    expense: DEFAULT_EXPENSE_CATS.map((c)=>({...c})),
  };
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      transactions: state.transactions, debts: state.debts,
      wallets: state.wallets, cats: state.cats, activeCur: state.activeCur,
    }));
  } catch (e) {}
}

/* ---------- حسابات مشتقّة ---------- */
const curTx = () => state.transactions.filter((t)=>t.cur===state.activeCur);
const curWallets = () => state.wallets.filter((w)=>w.cur===state.activeCur);
const curDebts = () => state.debts.filter((d)=>d.cur===state.activeCur);

function walletDeltas() {
  const m = {};
  state.transactions.forEach((t)=>{ if(!t.walletId) return; m[t.walletId]=(m[t.walletId]||0)+(t.type==="income"?t.amount:-t.amount); });
  return m;
}
function walletCurrent(w, deltas) { return (Number(w.opening)||0) + ((deltas||walletDeltas())[w.id]||0); }
function walletName(id) { const w = state.wallets.find((x)=>x.id===id); return w?w.name:null; }

function monthsList() {
  const set = new Set(curTx().map((t)=>monthKeyOf(t.date)));
  set.add(monthKeyOf(todayStr())); set.add(state.viewMonth);
  return Array.from(set).sort();
}
function monthLabel(k){ const [y,m]=k.split("-"); return `${AR_MONTHS[parseInt(m,10)-1]} ${y}`; }

function dueInfo(d) {
  if (!d.dueDate || (d.paid||0)>=d.amount) return null;
  const diff = daysBetween(todayStr(), d.dueDate);
  if (diff < 0) return { kind:"over", label:`متأخر ${Math.abs(diff)} يوم`, cls:"due-over" };
  if (diff === 0) return { kind:"today", label:"مستحق اليوم", cls:"due-soon" };
  if (diff <= 7) return { kind:"soon", label:`بعد ${diff} يوم`, cls:"due-soon" };
  return { kind:"later", label:d.dueDate, cls:"due-later" };
}
function dueCount() {
  return curDebts().filter((d)=>{ const i=dueInfo(d); return i && (i.kind==="over"||i.kind==="today"||i.kind==="soon"); }).length;
}

/* ============================================================
   العرض
   ============================================================ */
const app = () => document.getElementById("app");

function render() {
  const a = app();
  const st = licStatus();
  if (st.kind === "expired" || st.kind === "expired_sub") {
    a.innerHTML = lockHTML(st.kind);
    const sub = a.querySelector("[data-locksub]"); if (sub) sub.onclick = openSubscribe;
    const btn = a.querySelector("[data-lockact]"); if (btn) btn.onclick = openActivate;
    return;
  }
  let banner = "";
  if (st.kind === "trial") banner = trialBannerHTML(st.days);
  else if (st.kind === "pro" && st.plan && st.plan !== "life") banner = subBannerHTML(st);
  a.innerHTML = headerHTML() + curPillsHTML() + banner + tabsHTML() + tabContentHTML() + creditHTML() + fabHTML();
  attachHandlers();
}

function creditHTML(){ return `<div class="aw-credit">تم تطوير هذا البرنامج بواسطة مختبر الوتين الطبي 🔬</div>`; }

const WELCOME_KEY = "daftar-welcomed-v1";
function isStandalone(){ try{ return (window.navigator.standalone===true) || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches); }catch(e){ return false; } }
function openWelcome(){
  const standalone = isStandalone();
  const ov=document.createElement("div"); ov.className="aw-welcome-ov";
  ov.innerHTML = `<div class="aw-welcome-box">
    <div class="aw-welcome-logo"><span class="aw-brand-mark">دفتر</span> الحسابات</div>
    <p class="aw-welcome-tag">سجّل واردك وصادرك، محافظك، وديونك — بالشيكل والدينار والدولار، وكله معك بجيبتك.</p>
    ${standalone ? "" : `
    <div class="aw-welcome-card">
      <div class="aw-welcome-h">📲 ثبّت التطبيق على شاشتك</div>
      <ol class="aw-welcome-steps">
        <li>افتح الرابط من متصفّح <b>Safari</b>.</li>
        <li>اضغط زر <b>المشاركة</b> (المربّع مع السهم لفوق ⬆️).</li>
        <li>انزل واختار <b>«إضافة إلى الشاشة الرئيسية»</b>.</li>
        <li>افتحه من الأيقونة — وبيشتغل حتى بدون إنترنت.</li>
      </ol>
    </div>`}
    <button class="aw-btn primary aw-welcome-btn" id="wlcStart">${standalone ? "يلا نبدأ" : "تمام، فهمت"}</button>
    <div class="aw-credit">تم تطوير هذا البرنامج بواسطة مختبر الوتين الطبي 🔬</div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector("#wlcStart").onclick=()=>{ try{localStorage.setItem(WELCOME_KEY,"1");}catch(e){} ov.remove(); };
}
function maybeWelcome(){ try{ if(localStorage.getItem(WELCOME_KEY)) return; }catch(e){} openWelcome(); }

function trialBannerHTML(days){
  return `<div class="aw-trial"><span>النسخة التجريبية — باقي <b>${days}</b> يوم</span><button class="aw-trial-btn" data-act="subscribe">اشترك</button></div>`;
}
function subBannerHTML(st){
  const soon = st.days<=5;
  const dtxt = st.days===0 ? "بينتهي اليوم" : ("باقي <b>"+st.days+"</b> يوم");
  return `<div class="aw-trial aw-sub ${soon?"warn":"ok"}">
    <span>اشتراكك (${PLAN_LABEL[st.plan]||""}) فعّال — ${dtxt}</span>
    ${soon?`<button class="aw-trial-btn" data-act="subscribe">جدّد</button>`:`<span class="aw-sub-exp">ينتهي ${esc(st.expiry)}</span>`}
  </div>`;
}
function lockHTML(kind){
  const renew = kind==="expired_sub";
  return `<header class="aw-top"><div class="aw-brand"><span class="aw-brand-mark">دفتر</span> الحسابات</div></header>
    <section class="aw-lock">
      <div class="aw-lock-emoji">🔒</div>
      <div class="aw-lock-title">${renew?"انتهى اشتراكك":"انتهت الفترة التجريبية"}</div>
      <div class="aw-lock-text">${renew?"جدّد اشتراكك وكمّل استخدام التطبيق. حوّل قيمة التجديد وأرسل الإشعار على واتساب، وبيوصلك كود جديد.":"عجبك التطبيق؟ اشترك وكمّل استخدامه. حوّل الاشتراك وأرسل الإشعار على واتساب، وبيوصلك كود التفعيل."}</div>
      <button class="aw-btn primary aw-lock-btn" data-locksub>${renew?"جدّد الآن":"اشترك الآن"}</button>
      <button class="aw-lock-link" data-lockact>عندي كود — تفعيل</button>
    </section>
    <div class="aw-credit">تم تطوير هذا البرنامج بواسطة مختبر الوتين الطبي 🔬</div>`;
}
function openSubscribe(){
  let sel = PAY.plans.findIndex((p)=>p.best); if(sel<0) sel=PAY.plans.length-1;
  const methods = PAY.methods.map((mth)=>`<div class="aw-pay-m"><span class="aw-pay-m-ic">${mth.icon}</span><div><div class="aw-pay-m-name">${esc(mth.name)}</div><div class="aw-pay-m-val">${esc(mth.val)}</div></div></div>`).join("");
  const m = modalShell("اشترك بدفتر الحسابات", `
    <p class="aw-set-p">اختار الخطة اللي بتناسبك:</p>
    <div class="aw-plans" id="subPlans"></div>
    <div class="aw-pay-title">طرق الدفع</div>
    ${methods}
    <div class="aw-pay-steps">حوّل قيمة الخطة المختارة على أي طريقة فوق، صوّر الإشعار، وابعته على واتساب — وبيوصلك كود التفعيل. ✅</div>
    <a class="aw-wa-btn" id="subWa" href="#" target="_blank" rel="noopener">📲 ادفع وأرسل الإشعار على واتساب</a>
    <button class="aw-lock-link" id="subHaveCode">عندي كود — تفعيل مباشرة</button>
    <div class="aw-sheet-actions"><button class="aw-btn ghost" id="subClose">إغلاق</button></div>`);
  const s = m.sheet;
  const plansBox = s.querySelector("#subPlans");
  const wa = s.querySelector("#subWa");
  function draw(){
    plansBox.innerHTML = PAY.plans.map((p,i)=>`<div class="aw-plan ${p.best?"best":""} ${i===sel?"on":""}" data-plan="${i}">${p.best?`<div class="aw-plan-tag">الأوفر</div>`:""}<div class="aw-plan-name">${esc(p.name)}</div><div class="aw-plan-price">${esc(p.price)}</div></div>`).join("");
    plansBox.querySelectorAll("[data-plan]").forEach((b)=>b.onclick=()=>{ sel=parseInt(b.dataset.plan,10); draw(); });
    const p = PAY.plans[sel];
    wa.href = waLink(p.name, p.price);
    wa.textContent = `📲 اشترك (${p.name} ${p.price}) عبر واتساب`;
  }
  draw();
  s.querySelector("#subClose").onclick = m.close;
  s.querySelector("#subHaveCode").onclick = ()=>{ m.close(); openActivate(); };
}
function openActivate(){
  const dev = getDeviceId();
  const m = modalShell("تفعيل النسخة الكاملة", `
    <p class="aw-set-p">بعد ما تحوّل الاشتراك، أرسل لي <b>اسمك ورمز جهازك</b> على واتساب، وبوصلك كود التفعيل.</p>
    <div class="aw-dev-box"><span class="aw-dev-cap">رمز جهازك</span><span class="aw-dev-code">${esc(dev)}</span></div>
    <label class="aw-field-label">الاسم</label>
    <input class="aw-input" id="acName" type="text" placeholder="اسمك" value="${esc(lic.name||"")}">
    <label class="aw-field-label">كود التفعيل</label>
    <input class="aw-input" id="acCode" type="text" placeholder="XXXX-XXXX-XXXX" autocapitalize="characters">
    <div class="aw-lock-err" id="acErr"></div>
    <div class="aw-sheet-actions"><button class="aw-btn ghost" id="acCancel">إلغاء</button><button class="aw-btn primary" id="acDo">تفعيل</button></div>`);
  const s = m.sheet;
  s.querySelector("#acCancel").onclick = m.close;
  s.querySelector("#acDo").onclick = ()=>{
    const n = s.querySelector("#acName").value, c = s.querySelector("#acCode").value;
    if (tryActivate(n,c)) { m.close(); render(); }
    else s.querySelector("#acErr").textContent = "الاسم أو الكود غير صحيح. تأكّد إنهم متطابقين تماماً.";
  };
}

function headerHTML() {
  return `<header class="aw-top">
    <div class="aw-brand"><span class="aw-brand-mark">دفتر</span> الحسابات</div>
    <button class="aw-gear" data-act="settings" aria-label="الإعدادات">⚙️</button>
  </header>`;
}
function curPillsHTML() {
  return `<div class="aw-cur-pills">` + CURRENCIES.map((c)=>`
    <button class="aw-cur-pill ${state.activeCur===c.sym?"on":""}" data-cur="${esc(c.sym)}">
      <span class="aw-cur-pill-sym">${esc(c.sym)}</span><span class="aw-cur-pill-name">${esc(c.name)}</span>
    </button>`).join("") + `</div>`;
}
function tabsHTML() {
  const dc = dueCount();
  return `<div class="aw-seg">
    <button class="aw-seg-btn ${state.tab==="accounts"?"on":""}" data-tab="accounts">الحركات</button>
    <button class="aw-seg-btn ${state.tab==="wallets"?"on":""}" data-tab="wallets">المحافظ</button>
    <button class="aw-seg-btn ${state.tab==="debts"?"on":""}" data-tab="debts">الديون${dc?`<span class="aw-dot">${dc}</span>`:""}</button>
    <button class="aw-seg-btn ${state.tab==="reports"?"on":""}" data-tab="reports">تقارير</button>
  </div>`;
}
function tabContentHTML() {
  if (state.tab==="accounts") return accountsHTML();
  if (state.tab==="wallets") return walletsHTML();
  if (state.tab==="reports") return reportsHTML();
  return debtsHTML();
}
function fabHTML(){ return state.tab==="reports" ? "" : `<button class="aw-fab" data-act="add" aria-label="إضافة">+</button>`; }

/* ----- تبويب الحركات ----- */
function accountsHTML() {
  const months = monthsList();
  const idx = months.indexOf(state.viewMonth);
  const tx = curTx().filter((t)=>monthKeyOf(t.date)===state.viewMonth)
    .filter((t)=>state.accountFilter==="all"||t.account===state.accountFilter)
    .sort((a,b)=>(a.date<b.date?1:a.date>b.date?-1:0));
  let income=0, expense=0;
  tx.forEach((t)=> t.type==="income"?(income+=t.amount):(expense+=t.amount));
  const balance = income-expense;

  const bdMap = {};
  tx.filter((t)=>t.type==="expense").forEach((t)=>bdMap[t.category]=(bdMap[t.category]||0)+t.amount);
  const bd = Object.entries(bdMap).map(([id,amount])=>({id,amount})).sort((a,b)=>b.amount-a.amount);
  const bdMax = bd.length?bd[0].amount:0;

  let html = `<div class="aw-month-nav">
      <button class="aw-month-arrow" data-mon="-1" ${idx<=0?"disabled":""}>‹</button>
      <span class="aw-month-label">${monthLabel(state.viewMonth)}</span>
      <button class="aw-month-arrow" data-mon="1" ${idx>=months.length-1?"disabled":""}>›</button>
    </div>
    <section class="aw-ledger">
      <div class="aw-ledger-label">صافي الحركة هذا الشهر — ${esc(state.activeCur)}</div>
      <div class="aw-balance ${balance<0?"neg":"pos"}"><span class="aw-cur-sym">${esc(state.activeCur)}</span><span class="aw-balance-num">${fmt(balance)}</span></div>
      <div class="aw-ledger-cols">
        <div class="aw-col income"><span class="aw-col-cap">وارد</span><span class="aw-col-val">${fmt(income)}</span></div>
        <div class="aw-col-divider"></div>
        <div class="aw-col expense"><span class="aw-col-cap">صادر</span><span class="aw-col-val">${fmt(expense)}</span></div>
      </div>
    </section>
    ${chartHTML()}
    <div class="aw-chips">
      ${[["all","الكل"],["work","الشغل"],["personal","شخصي"]].map(([id,l])=>`<button class="aw-chip ${state.accountFilter===id?"on":""}" data-accf="${id}">${l}</button>`).join("")}
    </div>`;

  if (bd.length) {
    html += `<section class="aw-card"><div class="aw-card-title">وين راحت المصاريف</div>` +
      bd.map((row)=>{ const info=catInfo(row.id); const pct=expense?Math.round((row.amount/expense)*100):0; const w=bdMax?Math.max(6,(row.amount/bdMax)*100):0;
        return `<div class="aw-bd-row"><div class="aw-bd-head">
          <span class="aw-bd-name"><span class="aw-bd-icon">${info.icon}</span>${esc(info.label)}</span>
          <span class="aw-bd-amt">${fmt(row.amount)} ${esc(state.activeCur)}<span class="aw-bd-pct">${pct}%</span></span>
        </div><div class="aw-bar-track"><div class="aw-bar-fill" style="width:${w}%"></div></div></div>`;
      }).join("") + `</section>`;
  }

  html += `<section class="aw-list"><div class="aw-list-head"><span>الحركات</span><span class="aw-list-count">${tx.length}</span></div>`;
  if (!tx.length) {
    html += `<div class="aw-empty">ما في حركات بعملة ${esc(state.activeCur)} هذا الشهر.<br>اضغط <b>+</b> تحت لتسجّل أول وارد أو صادر.</div>`;
  } else {
    html += tx.map((t)=>{ const info=catInfo(t.category); const wn=t.walletId?walletName(t.walletId):null;
      return `<div class="aw-item">
        <div class="aw-item-icon ${t.type==="income"?"in":"out"}">${info.icon}</div>
        <div class="aw-item-body">
          <div class="aw-item-top"><span class="aw-item-cat">${esc(info.label)}</span>
            <span class="aw-item-amt ${t.type==="income"?"in":"out"}">${t.type==="income"?"+":"−"}${fmt(t.amount)} ${esc(t.cur)}</span></div>
          <div class="aw-item-sub">
            <span class="aw-tag ${t.account}">${t.account==="work"?"شغل":"شخصي"}</span>
            ${wn?`<span class="aw-tag wallet">${walletIcon(wn)} ${esc(wn)}</span>`:""}
            ${t.note?`<span class="aw-note">${esc(t.note)}</span>`:""}
            ${t.hasInvoice?`<button class="aw-inv-tag" data-inv="${t.id}">📎 فاتورة</button>`:""}
            <span class="aw-date">${esc(t.date)}</span>
          </div>
        </div>
        <button class="aw-edit" data-edittx="${t.id}" aria-label="تعديل">✏️</button>
        <button class="aw-del" data-deltx="${t.id}" aria-label="حذف">🗑</button>
      </div>`;
    }).join("");
  }
  html += `</section>`;
  return html;
}

function chartHTML() {
  // آخر 6 أشهر: وارد مقابل صادر للعملة الحالية
  const now = new Date(); const keys = [];
  for (let i=5;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); keys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }
  const inc = {}, exp = {};
  curTx().forEach((t)=>{ const k=monthKeyOf(t.date); if(!keys.includes(k))return; if(t.type==="income")inc[k]=(inc[k]||0)+t.amount; else exp[k]=(exp[k]||0)+t.amount; });
  const max = Math.max(1, ...keys.map((k)=>Math.max(inc[k]||0, exp[k]||0)));
  const any = keys.some((k)=>inc[k]||exp[k]);
  if (!any) return "";
  const W=320, H=120, pad=18, bw=14, gap=6, groupW=bw*2+gap;
  const step=(W-pad*2)/keys.length;
  let bars="";
  keys.forEach((k,i)=>{
    const cx=pad+step*i+step/2;
    const ih=((inc[k]||0)/max)*(H-pad-22), eh=((exp[k]||0)/max)*(H-pad-22);
    const x1=cx-groupW/2, x2=x1+bw+gap;
    bars+=`<rect x="${x1.toFixed(1)}" y="${(H-22-ih).toFixed(1)}" width="${bw}" height="${ih.toFixed(1)}" rx="3" class="bar-in"></rect>`;
    bars+=`<rect x="${x2.toFixed(1)}" y="${(H-22-eh).toFixed(1)}" width="${bw}" height="${eh.toFixed(1)}" rx="3" class="bar-out"></rect>`;
    const mi=parseInt(k.split("-")[1],10)-1;
    bars+=`<text x="${cx.toFixed(1)}" y="${H-6}" text-anchor="middle" font-size="10">${AR_MONTHS_SHORT[mi]}</text>`;
  });
  return `<section class="aw-card aw-chart-card">
    <div class="aw-card-title">آخر 6 أشهر — ${esc(state.activeCur)}</div>
    <svg viewBox="0 0 ${W} ${H}" class="aw-chart" preserveAspectRatio="xMidYMid meet">${bars}</svg>
    <div class="aw-chart-legend"><span><i style="background:#138A5E"></i> وارد</span><span><i style="background:#D2504A"></i> صادر</span></div>
  </section>`;
}

/* ----- تبويب المحافظ ----- */
function walletsHTML() {
  const deltas = walletDeltas();
  const ws = curWallets();
  const total = ws.reduce((s,w)=>s+walletCurrent(w,deltas),0);
  let html = `<section class="aw-ledger aw-ledger-wallet">
      <div class="aw-ledger-label">إجمالي المتوفر — ${esc(state.activeCur)}</div>
      <div class="aw-balance pos"><span class="aw-cur-sym">${esc(state.activeCur)}</span><span class="aw-balance-num">${fmt(total)}</span></div>
      <div class="aw-ledger-hint">مجموع أرصدة محافظك بهالعملة (محدّثة مع كل حركة)</div>
    </section>
    <section class="aw-list"><div class="aw-list-head"><span>المحافظ والحسابات</span><span class="aw-list-count">${ws.length}</span></div>`;
  if (!ws.length) {
    html += `<div class="aw-empty">ما في محافظ بعملة ${esc(state.activeCur)} بعد.<br>اضغط <b>+</b> تحت لتضيف بنك فلسطين، المحفظة، إلخ.</div>`;
  } else {
    html += ws.map((w)=>{ const cur=walletCurrent(w,deltas); const dl=deltas[w.id]||0;
      return `<div class="aw-item aw-wallet-item" data-editw="${w.id}">
        <div class="aw-item-icon wallet">${walletIcon(w.name)}</div>
        <div class="aw-item-body">
          <div class="aw-item-top"><span class="aw-item-cat">${esc(w.name)}</span>
            <span class="aw-wallet-bal ${cur<0?"neg":""}">${fmt(cur)} ${esc(w.cur)}</span></div>
          <div class="aw-item-sub">${dl!==0?`<span class="aw-note">الأساسي ${fmt(Number(w.opening)||0)} • الحركات ${dl>0?"+":"−"}${fmt(Math.abs(dl))}</span>`:`<span class="aw-note">اضغط للتعديل</span>`}</div>
        </div>
        <button class="aw-del" data-delw="${w.id}" aria-label="حذف">🗑</button>
      </div>`;
    }).join("");
  }
  html += `</section>`;
  return html;
}

/* ----- تبويب الديون ----- */
function debtsHTML() {
  const ds = curDebts();
  let owedToMe=0, iOwe=0;
  ds.forEach((d)=>{ const rem=Math.max(0,d.amount-(d.paid||0)); if(rem<=0)return; d.type==="owed_to_me"?(owedToMe+=rem):(iOwe+=rem); });
  const net = owedToMe-iOwe;

  const reminders = ds.map((d)=>({d,i:dueInfo(d)})).filter((x)=>x.i && x.i.kind!=="later")
    .sort((a,b)=> new Date(a.d.dueDate)-new Date(b.d.dueDate));

  const visible = ds.filter((d)=>state.debtFilter==="all"||d.type===state.debtFilter)
    .filter((d)=> state.showSettled?true:(d.paid||0)<d.amount);
  const gmap={};
  visible.forEach((d)=>{ const k=normName(d.name)+"|"+d.type;
    if(!gmap[k]) gmap[k]={name:d.name,type:d.type,cur:d.cur,items:[],amount:0,paid:0};
    const g=gmap[k]; g.items.push(d); g.amount+=d.amount; g.paid+=(d.paid||0); });
  const groups=Object.values(gmap).map((g)=>{ g.rem=Math.max(0,g.amount-g.paid); g.settled=g.paid>=g.amount;
    let nd=null; g.items.forEach((d)=>{ if((d.paid||0)>=d.amount)return; const di=dueInfo(d);
      if(di&&di.kind!=="later"){ if(!nd||(d.dueDate&&new Date(d.dueDate)<new Date(nd.date))) nd={info:di,date:d.dueDate}; } });
    g.due=nd?nd.info:null; return g; })
    .sort((a,b)=>{ if(a.settled!==b.settled) return a.settled-b.settled; return b.rem-a.rem; });

  let html = `<section class="aw-ledger aw-ledger-debt">
      <div class="aw-ledger-label">صافي الديون — ${esc(state.activeCur)}</div>
      <div class="aw-balance ${net<0?"neg":"pos"}"><span class="aw-cur-sym">${esc(state.activeCur)}</span><span class="aw-balance-num">${fmt(net)}</span></div>
      <div class="aw-ledger-cols">
        <div class="aw-col income"><span class="aw-col-cap">إلك عند الناس</span><span class="aw-col-val">${fmt(owedToMe)}</span></div>
        <div class="aw-col-divider"></div>
        <div class="aw-col expense"><span class="aw-col-cap">عليك للناس</span><span class="aw-col-val">${fmt(iOwe)}</span></div>
      </div>
    </section>`;

  if (reminders.length) {
    html += `<section class="aw-remind"><div class="aw-remind-title">🔔 تذكير</div>` +
      reminders.map((x)=>`<div class="aw-remind-row ${x.i.cls}"><span>${esc(x.d.name)} — ${fmt(Math.max(0,x.d.amount-(x.d.paid||0)))} ${esc(x.d.cur)}</span><span class="aw-remind-when">${esc(x.i.label)}</span></div>`).join("") +
      `</section>`;
  }

  html += `<div class="aw-chips aw-chips-debt">
      ${[["all","الكل"],["owed_to_me","إلي"],["i_owe","عليّ"]].map(([id,l])=>`<button class="aw-chip ${state.debtFilter===id?"on":""}" data-debtf="${id}">${l}</button>`).join("")}
      <button class="aw-chip aw-chip-toggle ${state.showSettled?"on":""}" data-act="toggleSettled">${state.showSettled?"إخفاء المسدّدة":"إظهار المسدّدة"}</button>
    </div>
    <section class="aw-list"><div class="aw-list-head"><span>الأشخاص</span><span class="aw-list-count">${groups.length}</span></div>`;

  if (!groups.length) {
    html += `<div class="aw-empty">ما في ديون بعملة ${esc(state.activeCur)}.<br>اضغط <b>+</b> تحت لتسجّل دَين إلك أو عليك.</div>`;
  } else {
    html += groups.map((g)=>{ const mine=g.type==="owed_to_me"; const pct=g.amount?Math.min(100,(g.paid/g.amount)*100):0;
      return `<div class="aw-item aw-debt-item ${g.settled?"settled":""}" data-person="${esc(g.name)}" data-ptype="${g.type}">
        <div class="aw-item-icon ${mine?"in":"out"}">${mine?"🤝":"📌"}</div>
        <div class="aw-item-body">
          <div class="aw-item-top"><span class="aw-item-cat">${esc(g.name||"بدون اسم")}</span>
            <span class="aw-item-amt ${mine?"in":"out"}">${g.settled?"مسدّد":fmt(g.rem)+" "+esc(g.cur)}</span></div>
          <div class="aw-item-sub">
            <span class="aw-tag ${mine?"personal":"work"}">${mine?"إلي":"عليّ"}</span>
            <span class="aw-tag">${g.items.length} ${g.items.length===1?"حركة":"حركات"}</span>
            ${g.due?`<span class="aw-tag ${g.due.cls}">${esc(g.due.label)}</span>`:""}
            ${(!g.settled&&g.paid>0)?`<span class="aw-note">سُدّد ${fmt(g.paid)} من ${fmt(g.amount)}</span>`:""}
          </div>
          ${(!g.settled&&g.paid>0)?`<div class="aw-bar-track aw-debt-bar"><div class="aw-bar-fill paid" style="width:${pct}%"></div></div>`:""}
        </div>
        <div class="aw-debt-actions"><span class="aw-chev">‹</span></div>
      </div>`;
    }).join("");
  }
  html += `</section>`;
  return html;
}

/* --- صفحة شخص: كل ديونه مجمّعة --- */
function openPersonModal(name, type){
  const mine = type==="owed_to_me";
  const m = modalShell(esc(name||"بدون اسم"), `<div id="personBody"></div>`);
  const body = m.sheet.querySelector("#personBody");
  function entries(){ return state.debts
    .filter((d)=>d.cur===state.activeCur && d.type===type && normName(d.name)===normName(name))
    .sort((a,b)=>a.date<b.date?1:-1); }
  function draw(){
    const items=entries();
    if(!items.length){ m.close(); render(); return; }
    let amount=0,paid=0; items.forEach((d)=>{amount+=d.amount;paid+=(d.paid||0);});
    const rem=Math.max(0,amount-paid);
    body.innerHTML = `
      <div class="aw-person-sum ${mine?"in":"out"}"><span>${mine?"إلك عنده":"عليك له"}</span><b>${fmt(rem)} ${esc(state.activeCur)}</b></div>
      ${paid>0?`<div class="aw-mini-hint" style="text-align:center">سُدّد ${fmt(paid)} من أصل ${fmt(amount)}</div>`:""}
      <div class="aw-person-list">
        ${items.map((d)=>{ const r=Math.max(0,d.amount-(d.paid||0)), st=(d.paid||0)>=d.amount; const di=dueInfo(d);
          return `<div class="aw-person-row ${st?"settled":""}">
            <div class="aw-person-row-head">
              <span class="aw-person-amt ${mine?"in":"out"}">${fmt(d.amount)} ${esc(d.cur)}</span>
              <span class="aw-date">${esc(d.date)}</span>
            </div>
            <div class="aw-item-sub">
              ${st?`<span class="aw-tag settled-tag">مسدّد</span>`:(d.paid>0?`<span class="aw-note">باقي ${fmt(r)}</span>`:"")}
              ${(!st&&di&&di.kind!=="later")?`<span class="aw-tag ${di.cls}">${esc(di.label)}</span>`:""}
              ${d.note?`<span class="aw-note">${esc(d.note)}</span>`:""}
            </div>
            <div class="aw-person-row-actions">
              ${!st?`<button class="aw-pay" data-ppay="${d.id}">سدّد</button>`:""}
              <button class="aw-del" data-pdel="${d.id}" aria-label="حذف">🗑</button>
            </div>
          </div>`; }).join("")}
      </div>
      <button class="aw-btn primary aw-person-add" id="personAdd">➕ دين جديد على ${esc(name)}</button>
      <div class="aw-sheet-actions"><button class="aw-btn ghost" id="personClose">إغلاق</button></div>`;
    body.querySelectorAll("[data-ppay]").forEach((b)=>b.onclick=()=>{ const d=state.debts.find((x)=>x.id===b.dataset.ppay); if(d) openPayModal(d, draw); });
    body.querySelectorAll("[data-pdel]").forEach((b)=>b.onclick=()=>confirmDialog("حذف هذا الدَّين؟", ()=>{ state.debts=state.debts.filter((x)=>x.id!==b.dataset.pdel); save(); render(); draw(); }));
    body.querySelector("#personAdd").onclick=()=> openDebtModal({name, type, cur:state.activeCur}, draw);
    body.querySelector("#personClose").onclick=()=>{ m.close(); render(); };
  }
  draw();
}

/* ----- تبويب التقارير ----- */
function prevMonthKey(key){ const [y,m]=key.split("-").map(Number); const d=new Date(y, m-2, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function txOfMonth(cur,key){ return state.transactions.filter((t)=>t.cur===cur && monthKeyOf(t.date)===key); }
function sumType(txs,type){ return txs.filter((t)=>t.type===type).reduce((s,t)=>s+t.amount,0); }

function computeReport(cur){
  const mKey=monthKeyOf(todayStr()), pKey=prevMonthKey(mKey), year=mKey.slice(0,4);
  const mtx=txOfMonth(cur,mKey);
  const inc=sumType(mtx,"income"), exp=sumType(mtx,"expense");
  const pexp=sumType(txOfMonth(cur,pKey),"expense");
  const ytx=state.transactions.filter((t)=>t.cur===cur && t.date.slice(0,4)===year);
  const yinc=sumType(ytx,"income"), yexp=sumType(ytx,"expense");
  const map={}; mtx.filter((t)=>t.type==="expense").forEach((t)=>map[t.category]=(map[t.category]||0)+t.amount);
  const top=Object.entries(map).map(([id,a])=>({id,a})).sort((x,y)=>y.a-x.a).slice(0,3);
  let cmp=null;
  if(!(exp===0&&pexp===0)){
    if(pexp===0) cmp={txt:"ما في بيانات للشهر السابق للمقارنة.",kind:"none"};
    else { const d=Math.round(((exp-pexp)/pexp)*100); cmp={pct:Math.abs(d),up:d>0,kind:d>0?"up":d<0?"down":"same"}; }
  }
  return { mKey, pKey, year, inc, exp, net:inc-exp, pexp, yinc, yexp, ynet:yinc-yexp, top, cmp,
    monthName: AR_MONTHS[parseInt(mKey.split("-")[1],10)-1], prevName: AR_MONTHS[parseInt(pKey.split("-")[1],10)-1] };
}

function reportsHTML(){
  const cur=state.activeCur, r=computeReport(cur);
  const has = r.inc||r.exp||r.yinc||r.yexp;
  if(!has) return `<section class="aw-list"><div class="aw-empty">ما في بيانات كفاية بعملة ${esc(cur)} لعمل تقرير.<br>سجّل كم حركة وبيطلعلك الملخص هون.</div></section>`;

  let cmpHTML="";
  if(r.cmp){
    if(r.cmp.kind==="none") cmpHTML=`<div class="aw-rep-cmp"><span class="aw-note">${r.cmp.txt}</span></div>`;
    else if(r.cmp.kind==="same") cmpHTML=`<div class="aw-rep-cmp"><span class="aw-note">صرفت نفس الشهر السابق تقريباً.</span></div>`;
    else cmpHTML=`<div class="aw-rep-cmp ${r.cmp.up?"up":"down"}">${r.cmp.up?"▲":"▼"} صرفت ${r.cmp.up?"أكثر":"أقل"} بـ ${r.cmp.pct}% عن ${esc(r.prevName)}</div>`;
  }
  const topHTML = r.top.length ? r.top.map((row)=>{ const info=catInfo(row.id); const pct=r.exp?Math.round((row.a/r.exp)*100):0;
    return `<div class="aw-rep-row"><span>${info.icon} ${esc(info.label)}</span><span class="aw-rep-amt">${fmt(row.a)} ${esc(cur)} <span class="aw-bd-pct">${pct}%</span></span></div>`; }).join("") : `<span class="aw-note">ما في مصاريف هالشهر.</span>`;

  return `
    <section class="aw-card aw-rep-card">
      <div class="aw-card-title">ملخص ${esc(r.monthName)} ${esc(r.mKey.slice(0,4))} — ${esc(cur)}</div>
      <div class="aw-rep-grid">
        <div class="aw-rep-box"><span class="aw-rep-cap">وارد</span><span class="aw-rep-val in">${fmt(r.inc)}</span></div>
        <div class="aw-rep-box"><span class="aw-rep-cap">صادر</span><span class="aw-rep-val out">${fmt(r.exp)}</span></div>
        <div class="aw-rep-box"><span class="aw-rep-cap">الصافي</span><span class="aw-rep-val ${r.net<0?"out":"net"}">${fmt(r.net)}</span></div>
      </div>
      ${cmpHTML}
    </section>
    <section class="aw-card"><div class="aw-card-title">أكتر التصنيفات صرفاً هالشهر</div>${topHTML}</section>
    <section class="aw-card">
      <div class="aw-card-title">ملخص سنة ${esc(r.year)} — ${esc(cur)}</div>
      <div class="aw-rep-grid">
        <div class="aw-rep-box"><span class="aw-rep-cap">وارد</span><span class="aw-rep-val in">${fmt(r.yinc)}</span></div>
        <div class="aw-rep-box"><span class="aw-rep-cap">صادر</span><span class="aw-rep-val out">${fmt(r.yexp)}</span></div>
        <div class="aw-rep-box"><span class="aw-rep-cap">الصافي</span><span class="aw-rep-val ${r.ynet<0?"out":"net"}">${fmt(r.ynet)}</span></div>
      </div>
    </section>
    <button class="aw-btn primary aw-rep-pdf" data-act="exportPdf">📄 تصدير / طباعة PDF</button>`;
}

function printReport(){
  const cur=state.activeCur, r=computeReport(cur);
  const line=(cap,val,cls)=>`<tr><td>${cap}</td><td class="${cls||''}">${fmt(val)} ${esc(cur)}</td></tr>`;
  const top=r.top.map((row)=>{const i=catInfo(row.id);const p=r.exp?Math.round((row.a/r.exp)*100):0;return `<tr><td>${i.icon} ${esc(i.label)}</td><td>${fmt(row.a)} ${esc(cur)} (${p}%)</td></tr>`;}).join("") || `<tr><td colspan="2">—</td></tr>`;
  let cmp="";
  if(r.cmp && r.cmp.kind!=="none" && r.cmp.kind!=="same") cmp=`<p class="pp-note">المقارنة مع ${esc(r.prevName)}: صرفت ${r.cmp.up?"أكثر":"أقل"} بنسبة ${r.cmp.pct}%.</p>`;
  const doc = `<div class="aw-print-doc">
      <div class="pp-head"><div class="pp-lab">مختبر الوتين الطبي</div><div class="pp-sub">دفتر الحسابات — تقرير مالي • ${esc(todayStr())} • العملة: ${esc(cur)}</div></div>
      <h2 class="pp-h">ملخص ${esc(r.monthName)} ${esc(r.mKey.slice(0,4))}</h2>
      <table class="pp-tbl">${line("وارد",r.inc,"pp-in")}${line("صادر",r.exp,"pp-out")}${line("الصافي",r.net,r.net<0?"pp-out":"pp-in")}</table>
      ${cmp}
      <h2 class="pp-h">أكتر التصنيفات صرفاً</h2><table class="pp-tbl">${top}</table>
      <h2 class="pp-h">ملخص سنة ${esc(r.year)}</h2>
      <table class="pp-tbl">${line("وارد",r.yinc,"pp-in")}${line("صادر",r.yexp,"pp-out")}${line("الصافي",r.ynet,r.ynet<0?"pp-out":"pp-in")}</table>
      <div class="pp-foot">تم تطوير هذا البرنامج بواسطة مختبر الوتين الطبي</div>
    </div>`;
  const ov=document.createElement("div");
  ov.className="aw-print-ov";
  ov.innerHTML=`<div class="aw-print-bar noprint"><button class="aw-btn primary" id="ppPrint">طباعة / حفظ PDF</button><button class="aw-btn ghost" id="ppClose">إغلاق</button></div>`+doc;
  document.body.appendChild(ov);
  ov.querySelector("#ppPrint").onclick=()=>{ try{ window.print(); }catch(e){} };
  ov.querySelector("#ppClose").onclick=()=>ov.remove();
}

/* ============================================================
   ربط الأحداث
   ============================================================ */
function confirmDialog(message, onYes){
  const ov=document.createElement("div"); ov.className="aw-confirm-ov";
  ov.innerHTML=`<div class="aw-confirm-box"><div class="aw-confirm-msg">${esc(message)}</div><div class="aw-confirm-actions"><button class="aw-btn ghost" id="cfNo">إلغاء</button><button class="aw-btn danger" id="cfYes">تأكيد</button></div></div>`;
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  ov.querySelector("#cfNo").onclick=close;
  ov.querySelector("#cfYes").onclick=()=>{ close(); if(onYes) onYes(); };
  ov.onclick=(e)=>{ if(e.target===ov) close(); };
}

function attachHandlers() {
  const a = app();
  a.querySelectorAll("[data-cur]").forEach((b)=>b.onclick=()=>{ state.activeCur=b.dataset.cur; state.viewMonth=monthKeyOf(todayStr()); save(); render(); });
  a.querySelectorAll("[data-tab]").forEach((b)=>b.onclick=()=>{ state.tab=b.dataset.tab; render(); });
  a.querySelectorAll("[data-mon]").forEach((b)=>b.onclick=()=>{ const months=monthsList(); const i=months.indexOf(state.viewMonth)+parseInt(b.dataset.mon,10); if(i>=0&&i<months.length){state.viewMonth=months[i];render();} });
  a.querySelectorAll("[data-accf]").forEach((b)=>b.onclick=()=>{ state.accountFilter=b.dataset.accf; render(); });
  a.querySelectorAll("[data-debtf]").forEach((b)=>b.onclick=()=>{ state.debtFilter=b.dataset.debtf; render(); });
  a.querySelectorAll("[data-deltx]").forEach((b)=>b.onclick=()=>confirmDialog("حذف هذه الحركة؟", ()=>{ invDel(b.dataset.deltx); state.transactions=state.transactions.filter((t)=>t.id!==b.dataset.deltx); save(); render(); }));
  a.querySelectorAll("[data-edittx]").forEach((b)=>b.onclick=()=>{ const t=state.transactions.find((x)=>x.id===b.dataset.edittx); if(t) openTxModal(t); });
  a.querySelectorAll("[data-inv]").forEach((b)=>b.onclick=()=>openInvoiceViewer(b.dataset.inv));
  a.querySelectorAll("[data-delw]").forEach((b)=>b.onclick=(e)=>{ e.stopPropagation(); confirmDialog("حذف هذه المحفظة؟", ()=>{ state.wallets=state.wallets.filter((w)=>w.id!==b.dataset.delw); save(); render(); }); });
  a.querySelectorAll("[data-editw]").forEach((b)=>b.onclick=()=>{ const w=state.wallets.find((x)=>x.id===b.dataset.editw); openWalletModal(w); });
  a.querySelectorAll("[data-deld]").forEach((b)=>b.onclick=()=>confirmDialog("حذف هذا الدَّين؟", ()=>{ state.debts=state.debts.filter((d)=>d.id!==b.dataset.deld); save(); render(); }));
  a.querySelectorAll("[data-pay]").forEach((b)=>b.onclick=()=>{ const d=state.debts.find((x)=>x.id===b.dataset.pay); openPayModal(d); });
  a.querySelectorAll("[data-person]").forEach((b)=>b.onclick=()=>openPersonModal(b.dataset.person, b.dataset.ptype));

  a.querySelectorAll("[data-act]").forEach((b)=>b.onclick=(e)=>{
    const act=b.dataset.act;
    if (act==="add") { if(state.tab==="accounts")openTxModal(); else if(state.tab==="wallets")openWalletModal(null); else openDebtModal(); }
    else if (act==="settings") openSettings();
    else if (act==="activate") openActivate();
    else if (act==="subscribe") openSubscribe();
    else if (act==="exportPdf") printReport();
    else if (act==="toggleSettled") { state.showSettled=!state.showSettled; render(); }
  });
}

/* ============================================================
   النوافذ (Modals)
   ============================================================ */
function modalShell(titleHtml, bodyHtml) {
  const ov = document.createElement("div");
  ov.className = "aw-overlay";
  ov.innerHTML = `<div class="aw-sheet"><div class="aw-sheet-handle"></div><div class="aw-sheet-title">${titleHtml}</div>${bodyHtml}</div>`;
  ov.onclick = (e)=>{ if(e.target===ov) close(); };
  function close(){ ov.remove(); }
  document.body.appendChild(ov);
  return { ov, sheet: ov.querySelector(".aw-sheet"), close };
}
function curPickerHTML(value, id){ return `<div class="aw-cur-pick" data-curpick="${id}">`+CURRENCIES.map((c)=>`<button class="aw-cur-pick-btn ${value===c.sym?"on":""}" data-cv="${esc(c.sym)}"><span class="aw-cur-pick-sym">${esc(c.sym)}</span><span class="aw-cur-pick-name">${esc(c.name)}</span></button>`).join("")+`</div>`; }

/* --- إضافة حركة --- */
/* --- فواتير مرفقة (صور) عبر IndexedDB --- */
const IDB_NAME="daftar-files", IDB_STORE="invoices";
function idbOpen(){ return new Promise((res,rej)=>{ let r; try{ r=indexedDB.open(IDB_NAME,1); }catch(e){ return rej(e); } r.onupgradeneeded=()=>{ try{ r.result.createObjectStore(IDB_STORE); }catch(e){} }; r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function invSave(id,dataUrl){ try{ const db=await idbOpen(); await new Promise((res,rej)=>{ const tx=db.transaction(IDB_STORE,"readwrite"); tx.objectStore(IDB_STORE).put(dataUrl,id); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); return true; }catch(e){ return false; } }
async function invGet(id){ try{ const db=await idbOpen(); return await new Promise((res,rej)=>{ const tx=db.transaction(IDB_STORE,"readonly"); const rq=tx.objectStore(IDB_STORE).get(id); rq.onsuccess=()=>res(rq.result||null); rq.onerror=()=>rej(rq.error); }); }catch(e){ return null; } }
async function invDel(id){ try{ const db=await idbOpen(); await new Promise((res,rej)=>{ const tx=db.transaction(IDB_STORE,"readwrite"); tx.objectStore(IDB_STORE).delete(id); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }catch(e){} }
function compressImage(file, maxDim=1280, quality=0.6){
  return new Promise((res,rej)=>{
    const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{ let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
      const scale=Math.min(1, maxDim/Math.max(w,h)); w=Math.max(1,Math.round(w*scale)); h=Math.max(1,Math.round(h*scale));
      const c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h);
      try{URL.revokeObjectURL(url);}catch(e){}
      try{ res(c.toDataURL("image/jpeg",quality)); }catch(e){ rej(e); } };
    img.onerror=()=>{ try{URL.revokeObjectURL(url);}catch(e){} rej(new Error("img")); };
    img.src=url;
  });
}
function openInvoiceViewer(id){
  invGet(id).then((data)=>{
    const ov=document.createElement("div"); ov.className="aw-inv-ov";
    ov.innerHTML = (data
      ? `<div class="aw-inv-bar"><button class="aw-btn ghost" id="invClose">إغلاق</button><a class="aw-btn primary" id="invOpen" href="${data}" download="invoice.jpg">حفظ الصورة</a></div><img class="aw-inv-img" src="${data}" alt="فاتورة">`
      : `<div class="aw-inv-bar"><button class="aw-btn ghost" id="invClose">إغلاق</button></div><div class="aw-empty">ما في صورة مرفقة لهالحركة.</div>`);
    document.body.appendChild(ov);
    ov.querySelector("#invClose").onclick=()=>ov.remove();
    ov.onclick=(e)=>{ if(e.target===ov) ov.remove(); };
  });
}

function openTxModal(editing) {
  const ed = editing && editing.id ? editing : null;
  let type=ed?ed.type:"expense", cur=ed?ed.cur:state.activeCur, category=ed?ed.category:"", account=ed?ed.account:"personal", walletId=ed?(ed.walletId||""):"";
  const body = `
    <div class="aw-type-toggle">
      <button class="aw-type-btn out ${type==="expense"?"on":""}" data-type="expense">صادر</button>
      <button class="aw-type-btn in ${type==="income"?"on":""}" data-type="income">وارد</button>
    </div>
    <label class="aw-field-label">العملة</label>${curPickerHTML(cur,"tx")}
    <label class="aw-field-label">المبلغ</label>
    <div class="aw-amount-wrap"><span class="aw-amount-cur" id="txCurSym">${esc(cur)}</span>
      <input class="aw-amount-input" id="txAmount" type="number" inputmode="decimal" placeholder="0" value="${ed?esc(ed.amount):""}" ${ed?"":"autofocus"}></div>
    <label class="aw-field-label" id="txWalletLabel">${type==="expense"?"من أي محفظة طلعت؟":"لأي محفظة دخلت؟"}</label>
    <div class="aw-wallet-pick" id="txWallets"></div>
    <label class="aw-field-label">التصنيف</label>
    <div class="aw-cat-grid" id="txCats"></div>
    <div id="txAddCat"></div>
    <label class="aw-field-label">الحساب</label>
    <div class="aw-acc-toggle">
      <button class="aw-acc-btn ${account==="personal"?"on":""}" data-acc="personal">شخصي</button>
      <button class="aw-acc-btn ${account==="work"?"on":""}" data-acc="work">شغل</button>
    </div>
    <label class="aw-field-label">التاريخ</label>
    <input class="aw-input" id="txDate" type="date" value="${ed?esc(ed.date):todayStr()}">
    <label class="aw-field-label">ملاحظة (اختياري)</label>
    <input class="aw-input" id="txNote" type="text" placeholder="مثلاً: قهوة، كواشف، أجرة سرفيس…" value="${ed?esc(ed.note||""):""}">
    <label class="aw-field-label">فاتورة (اختياري)</label>
    <div class="aw-inv-attach">
      <input type="file" id="txInvFile" accept="image/*" hidden>
      <button class="aw-attach-btn" id="txInvBtn" type="button">📎 إرفاق صورة فاتورة</button>
      <div id="txInvThumb"></div>
    </div>
    <div class="aw-sheet-actions"><button class="aw-btn ghost" id="txCancel">إلغاء</button><button class="aw-btn primary ${ed?"":"disabled"}" id="txSave">حفظ</button></div>`;
  const m = modalShell(ed?"تعديل الحركة":"حركة جديدة", body);
  const s = m.sheet;
  const catsBox = s.querySelector("#txCats");
  const addCatBox = s.querySelector("#txAddCat");
  const walletsBox = s.querySelector("#txWallets");
  const amount = s.querySelector("#txAmount");
  const saveBtn = s.querySelector("#txSave");

  let addingCat = false, newEmoji = EMOJIS[0];
  function renderCats(){ const cats=type==="income"?state.cats.income:state.cats.expense;
    catsBox.innerHTML = cats.map((c)=>`<button class="aw-cat ${category===c.id?"on":""}" data-cat="${c.id}"><span class="aw-cat-icon">${c.icon}</span><span class="aw-cat-label">${esc(c.label)}</span></button>`).join("")
      + `<button class="aw-cat aw-cat-add" data-addcat><span class="aw-cat-icon">＋</span><span class="aw-cat-label">جديد</span></button>`;
    catsBox.querySelectorAll("[data-cat]").forEach((b)=>b.onclick=()=>{ category=b.dataset.cat; renderCats(); validate(); });
    catsBox.querySelector("[data-addcat]").onclick=()=>{ addingCat=true; renderAddCat(); };
  }
  function renderAddCat(){
    if(!addingCat){ addCatBox.innerHTML=""; return; }
    addCatBox.innerHTML = `<div class="aw-newcat">
      <select class="aw-emoji-sel" id="ncEmoji">${EMOJIS.map((e)=>`<option ${e===newEmoji?"selected":""}>${e}</option>`).join("")}</select>
      <input class="aw-input" id="ncName" type="text" placeholder="اسم التصنيف الجديد">
      <button class="aw-pay" id="ncAdd">إضافة</button></div>`;
    addCatBox.querySelector("#ncEmoji").onchange=(e)=>{ newEmoji=e.target.value; };
    addCatBox.querySelector("#ncAdd").onclick=()=>{ const nm=addCatBox.querySelector("#ncName").value.trim(); if(!nm)return;
      const id="c"+uid(); (type==="income"?state.cats.income:state.cats.expense).push({id,label:nm,icon:addCatBox.querySelector("#ncEmoji").value});
      save(); category=id; addingCat=false; renderAddCat(); renderCats(); validate(); };
  }
  function renderWallets(){ const ws=state.wallets.filter((w)=>w.cur===cur);
    walletsBox.innerHTML = ws.map((w)=>`<button class="aw-wpick-btn ${walletId===w.id?"on":""}" data-w="${w.id}"><span>${walletIcon(w.name)}</span>${esc(w.name)}</button>`).join("")
      + `<button class="aw-wpick-btn ${walletId===""?"on":""}" data-w="">بدون محفظة</button>`
      + (ws.length?"":`<div class="aw-mini-hint">ما في محافظ بعملة ${esc(cur)} — أضفها من تبويب «المحافظ».</div>`);
    walletsBox.querySelectorAll("[data-w]").forEach((b)=>b.onclick=()=>{ walletId=b.dataset.w; renderWallets(); });
  }
  function validate(){ const ok=parseFloat(amount.value)>0 && category; saveBtn.classList.toggle("disabled", !ok); return ok; }

  s.querySelectorAll("[data-type]").forEach((b)=>b.onclick=()=>{ type=b.dataset.type; category=""; addingCat=false;
    s.querySelectorAll("[data-type]").forEach((x)=>x.classList.toggle("on", x.dataset.type===type));
    s.querySelector("#txWalletLabel").textContent = type==="expense"?"من أي محفظة طلعت؟":"لأي محفظة دخلت؟";
    renderAddCat(); renderCats(); validate(); });
  s.querySelectorAll("[data-acc]").forEach((b)=>b.onclick=()=>{ account=b.dataset.acc; s.querySelectorAll("[data-acc]").forEach((x)=>x.classList.toggle("on", x.dataset.acc===account)); });
  s.querySelector('[data-curpick="tx"]').querySelectorAll("[data-cv]").forEach((b)=>b.onclick=()=>{ cur=b.dataset.cv; walletId="";
    s.querySelectorAll('[data-curpick="tx"] [data-cv]').forEach((x)=>x.classList.toggle("on", x.dataset.cv===cur));
    s.querySelector("#txCurSym").textContent=cur; renderWallets(); });
  amount.oninput = validate;
  s.querySelector("#txCancel").onclick = m.close;

  let pendingInvoice = null;
  const invFile = s.querySelector("#txInvFile"), invBtn = s.querySelector("#txInvBtn"), invThumb = s.querySelector("#txInvThumb");
  function drawThumb(){
    if (pendingInvoice){ invThumb.innerHTML = `<div class="aw-inv-thumb"><img src="${pendingInvoice}" alt="معاينة"><button type="button" class="aw-inv-rm" id="txInvRm">إزالة</button></div>`;
      invThumb.querySelector("#txInvRm").onclick = ()=>{ pendingInvoice=null; invFile.value=""; drawThumb(); }; }
    else invThumb.innerHTML = "";
  }
  invBtn.onclick = ()=> invFile.click();
  invFile.onchange = async ()=>{ const f = invFile.files && invFile.files[0]; if(!f) return;
    invBtn.disabled=true; invBtn.textContent="جارٍ المعالجة…";
    try{ pendingInvoice = await compressImage(f); drawThumb(); }catch(e){ pendingInvoice=null; alert("تعذّر قراءة الصورة، جرّب صورة ثانية."); }
    invBtn.disabled=false; invBtn.textContent="📎 إرفاق صورة فاتورة"; };
  // عند التعديل: حمّل الفاتورة الموجودة إن وُجدت
  if (ed && ed.hasInvoice){ invGet(ed.id).then((data)=>{ if(data){ pendingInvoice=data; drawThumb(); } }); }

  saveBtn.onclick = async ()=>{ if(!validate())return;
    const id = ed ? ed.id : uid();
    const tx = { id, type, amount:parseFloat(amount.value), cur, category, account, walletId:walletId||null, date:s.querySelector("#txDate").value, note:s.querySelector("#txNote").value.trim() };
    if (pendingInvoice){ const ok = await invSave(id, pendingInvoice); if(ok) tx.hasInvoice = true; }
    else if (ed && ed.hasInvoice){ await invDel(id); } // أُزيلت الفاتورة
    if (ed){ const i = state.transactions.findIndex((t)=>t.id===ed.id); if(i>=0) state.transactions[i]=tx; }
    else state.transactions.push(tx);
    state.activeCur=cur; state.viewMonth=monthKeyOf(s.querySelector("#txDate").value); save(); m.close(); render();
  };
  renderCats(); renderWallets();
}

/* --- محفظة --- */
function openWalletModal(wallet) {
  const editing = wallet && wallet.id;
  let cur = editing?wallet.cur:state.activeCur;
  const current = editing ? walletCurrent(wallet) : null;
  const body = `
    ${editing?`<div class="aw-pay-rem">الرصيد الحالي: <b>${fmt(current)} ${esc(cur)}</b></div>`:""}
    <label class="aw-field-label">الاسم</label>
    <input class="aw-input" id="wName" type="text" placeholder="مثلاً: بنك فلسطين" value="${editing?esc(wallet.name):""}" autofocus>
    ${editing?"":`<div class="aw-suggest">${WALLET_SUGGEST.map((s)=>`<button class="aw-suggest-btn" data-sug="${esc(s)}">${esc(s)}</button>`).join("")}</div>`}
    <label class="aw-field-label">العملة</label>${curPickerHTML(cur,"w")}
    <label class="aw-field-label">المبلغ الأساسي</label>
    <div class="aw-amount-wrap"><span class="aw-amount-cur" id="wCurSym">${esc(cur)}</span>
      <input class="aw-amount-input" id="wOpen" type="number" inputmode="decimal" placeholder="0" value="${editing?esc(wallet.opening):""}"></div>
    <div class="aw-mini-hint">الرصيد الحالي بيتحسب لحاله = المبلغ الأساسي + الوارد − الصادر المربوطين بهالمحفظة.</div>
    <div class="aw-sheet-actions"><button class="aw-btn ghost" id="wCancel">إلغاء</button><button class="aw-btn primary" id="wSave">حفظ</button></div>`;
  const m = modalShell(editing?"تعديل المحفظة":"محفظة / حساب جديد", body);
  const s = m.sheet;
  const nameI = s.querySelector("#wName"), openI = s.querySelector("#wOpen"), saveBtn=s.querySelector("#wSave");
  s.querySelectorAll("[data-sug]").forEach((b)=>b.onclick=()=>{ nameI.value=b.dataset.sug; });
  s.querySelector('[data-curpick="w"]').querySelectorAll("[data-cv]").forEach((b)=>b.onclick=()=>{ cur=b.dataset.cv; s.querySelectorAll('[data-curpick="w"] [data-cv]').forEach((x)=>x.classList.toggle("on", x.dataset.cv===cur)); s.querySelector("#wCurSym").textContent=cur; });
  s.querySelector("#wCancel").onclick = m.close;
  saveBtn.onclick = ()=>{ const op=parseFloat(openI.value); if(!nameI.value.trim()||isNaN(op))return;
    const obj={ id:editing?wallet.id:uid(), name:nameI.value.trim(), cur, opening:op };
    if (editing) state.wallets=state.wallets.map((x)=>x.id===obj.id?obj:x); else state.wallets.push(obj);
    state.activeCur=cur; save(); m.close(); render();
  };
}

/* --- دَين --- */
function openDebtModal(prefill, onDone) {
  let type=(prefill&&prefill.type)||"owed_to_me", cur=(prefill&&prefill.cur)||state.activeCur;
  const pname=(prefill&&prefill.name)||"";
  const body = `
    <div class="aw-type-toggle">
      <button class="aw-type-btn in ${type==="owed_to_me"?"on":""}" data-dtype="owed_to_me">إلي عند حدا</button>
      <button class="aw-type-btn out ${type==="i_owe"?"on":""}" data-dtype="i_owe">عليّ لحدا</button>
    </div>
    <label class="aw-field-label">الاسم</label>
    <input class="aw-input" id="dName" type="text" placeholder="${type==="owed_to_me"?"مين بدّو يردّلك؟":"لمين بدّك تردّ؟"}" value="${esc(pname)}" ${pname?"":"autofocus"}>
    <label class="aw-field-label">العملة</label>${curPickerHTML(cur,"d")}
    <label class="aw-field-label">المبلغ</label>
    <div class="aw-amount-wrap"><span class="aw-amount-cur" id="dCurSym">${esc(cur)}</span>
      <input class="aw-amount-input" id="dAmount" type="number" inputmode="decimal" placeholder="0" ${pname?"autofocus":""}></div>
    <label class="aw-field-label" id="dWalletLabel">${type==="owed_to_me"?"من أي محفظة طلعت الفلوس؟ (اختياري)":"لأي محفظة دخلت الفلوس؟ (اختياري)"}</label>
    <div class="aw-wallet-pick" id="dWallets"></div>
    <label class="aw-field-label">التاريخ</label>
    <input class="aw-input" id="dDate" type="date" value="${todayStr()}">
    <label class="aw-field-label">تاريخ الاستحقاق (اختياري — للتذكير)</label>
    <input class="aw-input" id="dDue" type="date">
    <label class="aw-field-label">ملاحظة (اختياري)</label>
    <input class="aw-input" id="dNote" type="text" placeholder="مثلاً: سلفة، ثمن أدوية، أجار…">
    <div class="aw-sheet-actions"><button class="aw-btn ghost" id="dCancel">إلغاء</button><button class="aw-btn primary disabled" id="dSave">حفظ</button></div>`;
  const m = modalShell(pname?("دَين جديد على "+esc(pname)):"دَين جديد", body);
  const s = m.sheet;
  const nameI=s.querySelector("#dName"), amtI=s.querySelector("#dAmount"), saveBtn=s.querySelector("#dSave");
  let walletId="";
  const walletsBox=s.querySelector("#dWallets"), walLabel=s.querySelector("#dWalletLabel");
  function renderWallets(){ const wsx=state.wallets.filter((w)=>w.cur===cur);
    walletsBox.innerHTML = wsx.map((w)=>`<button class="aw-wpick-btn ${walletId===w.id?"on":""}" data-w="${w.id}"><span>${walletIcon(w.name)}</span>${esc(w.name)}</button>`).join("")
      + `<button class="aw-wpick-btn ${walletId===""?"on":""}" data-w="">بدون محفظة</button>`
      + (wsx.length?"":`<div class="aw-mini-hint">ما في محافظ بعملة ${esc(cur)} — أضفها من تبويب «المحافظ».</div>`);
    walletsBox.querySelectorAll("[data-w]").forEach((b)=>b.onclick=()=>{ walletId=b.dataset.w; renderWallets(); });
  }
  function validate(){ const ok=parseFloat(amtI.value)>0 && nameI.value.trim(); saveBtn.classList.toggle("disabled",!ok); return ok; }
  s.querySelectorAll("[data-dtype]").forEach((b)=>b.onclick=()=>{ type=b.dataset.dtype; s.querySelectorAll("[data-dtype]").forEach((x)=>x.classList.toggle("on", x.dataset.dtype===type)); nameI.placeholder = type==="owed_to_me"?"مين بدّو يردّلك؟":"لمين بدّك تردّ؟"; walLabel.textContent = type==="owed_to_me"?"من أي محفظة طلعت الفلوس؟ (اختياري)":"لأي محفظة دخلت الفلوس؟ (اختياري)"; });
  s.querySelector('[data-curpick="d"]').querySelectorAll("[data-cv]").forEach((b)=>b.onclick=()=>{ cur=b.dataset.cv; s.querySelectorAll('[data-curpick="d"] [data-cv]').forEach((x)=>x.classList.toggle("on", x.dataset.cv===cur)); s.querySelector("#dCurSym").textContent=cur; walletId=""; renderWallets(); });
  nameI.oninput=validate; amtI.oninput=validate; validate(); renderWallets();
  s.querySelector("#dCancel").onclick=m.close;
  saveBtn.onclick=()=>{ if(!validate())return;
    const amount=parseFloat(amtI.value);
    const nm=nameI.value.trim();
    state.debts.push({ id:uid(), type, name:nm, amount, paid:0, cur, date:s.querySelector("#dDate").value, dueDate:s.querySelector("#dDue").value||null, note:s.querySelector("#dNote").value.trim() });
    if (walletId){
      const mine = type==="owed_to_me"; // أعطيت فلوس => صادر ؛ أخذت فلوس => وارد
      state.transactions.push({ id:uid(), type: mine?"expense":"income", amount, cur,
        category: mine?"debt_lend":"debt_borrow", account:"personal", walletId,
        date:s.querySelector("#dDate").value, note:(mine?"دين لـ ":"دين من ")+nm });
    }
    state.activeCur=cur; save(); m.close(); render(); if(onDone) onDone();
  };
}

/* --- تسديد دَين (مربوط بمحفظة) --- */
function openPayModal(debt, onDone) {
  const rem = Math.max(0, debt.amount-(debt.paid||0));
  const mine = debt.type==="owed_to_me";
  let walletId = "";
  const ws = state.wallets.filter((w)=>w.cur===debt.cur);
  const body = `
    <div class="aw-pay-rem">المتبقّي: <b>${fmt(rem)} ${esc(debt.cur)}</b></div>
    <label class="aw-field-label">قيمة التسديد</label>
    <div class="aw-amount-wrap"><span class="aw-amount-cur">${esc(debt.cur)}</span>
      <input class="aw-amount-input" id="pAmount" type="number" inputmode="decimal" placeholder="0" value="${rem}" autofocus></div>
    <label class="aw-field-label">${mine?"لأي محفظة دخلت الفلوس؟":"من أي محفظة دفعت؟"} (اختياري)</label>
    <div class="aw-wallet-pick" id="pWallets">
      ${ws.map((w)=>`<button class="aw-wpick-btn" data-w="${w.id}"><span>${walletIcon(w.name)}</span>${esc(w.name)}</button>`).join("")}
      <button class="aw-wpick-btn on" data-w="">بدون محفظة</button>
    </div>
    <div class="aw-sheet-actions"><button class="aw-btn ghost" id="pCancel">إلغاء</button><button class="aw-btn primary" id="pSave">تسجيل</button></div>`;
  const m = modalShell("تسديد — "+esc(debt.name), body);
  const s = m.sheet;
  s.querySelectorAll("#pWallets [data-w]").forEach((b)=>b.onclick=()=>{ walletId=b.dataset.w; s.querySelectorAll("#pWallets [data-w]").forEach((x)=>x.classList.toggle("on", x.dataset.w===walletId)); });
  s.querySelector("#pCancel").onclick=m.close;
  s.querySelector("#pSave").onclick=()=>{
    let amt=parseFloat(s.querySelector("#pAmount").value); if(!(amt>0))return; amt=Math.min(rem,amt);
    state.debts = state.debts.map((d)=> d.id===debt.id ? {...d, paid: Math.min(d.amount,(d.paid||0)+amt)} : d);
    if (walletId) {
      state.transactions.push({ id:uid(), type: mine?"income":"expense", amount:amt, cur:debt.cur,
        category: mine?"debt_collect":"debt_payment", account:"personal", walletId,
        date:todayStr(), note:(mine?"تحصيل من ":"تسديد لـ ")+debt.name });
    }
    save(); m.close(); render(); if(onDone) onDone();
  };
}

/* --- الإعدادات: نسخ احتياطي / تصدير / استرجاع --- */
function openSettings() {
  const body = `
    <p class="aw-set-p">عدّل تصنيفاتك أو احفظ نسخة من بياناتك، وتقدر ترجّعها وقت ما بدك.</p>
    <button class="aw-set-btn" id="licBtn"></button>
    <button class="aw-set-btn" id="editCats">🏷️ تعديل التصنيفات</button>
    <button class="aw-set-btn" id="howInstall">📲 كيف أثبّت التطبيق؟</button>
    ${isOwner()?`<button class="aw-set-btn" id="payBtn">💳 إعدادات الدفع</button>`:""}
    <button class="aw-set-btn" id="expCsv">📊 تصدير الحركات (CSV / Excel)</button>
    <button class="aw-set-btn" id="expJson">💾 نسخة احتياطية كاملة (JSON)</button>
    <label class="aw-set-btn" id="impLbl">📥 استرجاع نسخة احتياطية<input type="file" id="impFile" accept="application/json,.json" hidden></label>
    <button class="aw-set-btn danger" id="wipe">🗑️ مسح كل البيانات</button>
    <div class="aw-sheet-actions"><button class="aw-btn ghost" id="setClose">إغلاق</button></div>`;
  const m = modalShell("الإعدادات والنسخ الاحتياطي", body);
  const s = m.sheet;
  s.querySelector("#setClose").onclick=m.close;
  const st = licStatus();
  const licBtn = s.querySelector("#licBtn");
  licBtn.textContent = st.kind==="pro"
    ? (st.plan==="life" ? `✅ النسخة الكاملة مفعّلة (${lic.name})` : `✅ اشتراك ${PLAN_LABEL[st.plan]||""} — باقي ${st.days} يوم`)
    : st.kind==="trial" ? `🔑 تفعيل النسخة الكاملة — باقي ${st.days} يوم تجربة` : "🔑 تفعيل النسخة الكاملة";
  if (st.kind==="pro" && st.plan==="life") licBtn.disabled = true; else licBtn.onclick = ()=>{ m.close(); openSubscribe(); };
  s.querySelector("#editCats").onclick=()=>{ m.close(); openCatsModal(); };
  s.querySelector("#howInstall").onclick=()=>{ m.close(); openWelcome(); };
  const payB = s.querySelector("#payBtn"); if (payB) payB.onclick=()=>{ m.close(); openPayEditor(); };
  s.querySelector("#expCsv").onclick=exportCSV;
  s.querySelector("#expJson").onclick=exportJSON;
  s.querySelector("#wipe").onclick=()=>confirmDialog("متأكد؟ رح ينمسح كل شي ولا في رجعة.", ()=>{ state.transactions=[];state.debts=[];state.wallets=[]; save(); m.close(); render(); });
  s.querySelector("#impFile").onchange=(e)=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader();
    r.onload=()=>{ try{ const data=JSON.parse(r.result);
      if(Array.isArray(data.transactions)) state.transactions=data.transactions;
      if(Array.isArray(data.debts)) state.debts=data.debts;
      if(Array.isArray(data.wallets)) state.wallets=data.wallets;
      if(data.cats && Array.isArray(data.cats.income) && Array.isArray(data.cats.expense)) state.cats=data.cats;
      if(data.activeCur) state.activeCur=data.activeCur;
      save(); m.close(); render(); alert("تم الاسترجاع ✅");
    }catch(err){ alert("الملف مش صالح."); } };
    r.readAsText(f);
  };
}

/* --- إعدادات الدفع (تظهر للمالك فقط من الإعدادات) --- */
function openPayEditor(){
  if (!isOwner()) return;
  const m = modalShell("إعدادات الدفع", `<div id="peBody"></div>`);
  const s = m.sheet;
  const body = s.querySelector("#peBody");
  function renderEditor(){
    const methodsHTML = PAY.methods.map((mth,i)=>`
      <div class="aw-pe-row" data-mi="${i}">
        <input class="aw-input aw-pe-name" data-mname placeholder="اسم الطريقة" value="${esc(mth.name)}">
        <input class="aw-input" data-mval placeholder="الرقم / الحساب" value="${esc(mth.val)}">
      </div>`).join("");
    const plansHTML = PAY.plans.map((p,i)=>`
      <div class="aw-pe-row" data-pi="${i}">
        <input class="aw-input aw-pe-name" data-pname placeholder="اسم الخطة" value="${esc(p.name)}">
        <input class="aw-input" data-pprice placeholder="السعر" value="${esc(p.price)}">
      </div>`).join("");
    body.innerHTML = `
      <label class="aw-field-label">رقم الواتساب (صيغة دولية بدون +)</label>
      <input class="aw-input" id="peWa" value="${esc(PAY.whatsapp)}" inputmode="numeric">
      <div class="aw-cats-h">طرق الدفع</div>${methodsHTML}
      <div class="aw-cats-h">الخطط والأسعار</div>${plansHTML}
      <div class="aw-mini-hint">هالتعديلات بتنحفظ على جهازك. لو بدك التغيير يوصل كل الزباين، عدّل القيم بملف app.js وأعد رفعه.</div>
      <div class="aw-sheet-actions"><button class="aw-btn ghost" id="peCancel">إلغاء</button><button class="aw-btn primary" id="peSave">حفظ</button></div>`;
    body.querySelector("#peCancel").onclick = m.close;
    body.querySelector("#peSave").onclick = ()=>{
      const wa = body.querySelector("#peWa").value.trim().replace(/[^0-9]/g,"");
      if (wa) PAY.whatsapp = wa;
      body.querySelectorAll("[data-mi]").forEach((r)=>{ const i=+r.dataset.mi;
        const nm=r.querySelector("[data-mname]").value.trim(), vl=r.querySelector("[data-mval]").value.trim();
        if(nm) PAY.methods[i].name=nm; PAY.methods[i].val=vl; });
      body.querySelectorAll("[data-pi]").forEach((r)=>{ const i=+r.dataset.pi;
        const nm=r.querySelector("[data-pname]").value.trim(), pr=r.querySelector("[data-pprice]").value.trim();
        if(nm) PAY.plans[i].name=nm; if(pr) PAY.plans[i].price=pr; });
      savePay(); m.close();
    };
  }
  renderEditor();
}

/* --- إعدادات الدفع نهاية --- */
function openCatsModal() {
  const m = modalShell("تعديل التصنيفات", `<div id="catsBody"></div><div class="aw-sheet-actions"><button class="aw-btn primary" id="catsDone">تم</button></div>`);
  const s = m.sheet;
  const body = s.querySelector("#catsBody");
  function rowHTML(cat, kind){
    return `<div class="aw-catrow" data-row="${cat.id}" data-kind="${kind}">
      <select class="aw-emoji-sel" data-emoji>${EMOJIS.map((e)=>`<option ${e===cat.icon?"selected":""}>${e}</option>`).join("")}</select>
      <input class="aw-input" data-name value="${esc(cat.label)}">
      <button class="aw-del" data-delcat>🗑</button></div>`;
  }
  function draw(){
    body.innerHTML =
      `<div class="aw-cats-h">تصنيفات الصادر</div>` + state.cats.expense.map((c)=>rowHTML(c,"expense")).join("") +
      `<button class="aw-set-btn aw-add-cat" data-add="expense">＋ إضافة تصنيف صادر</button>` +
      `<div class="aw-cats-h">تصنيفات الوارد</div>` + state.cats.income.map((c)=>rowHTML(c,"income")).join("") +
      `<button class="aw-set-btn aw-add-cat" data-add="income">＋ إضافة تصنيف وارد</button>`;
    body.querySelectorAll(".aw-catrow").forEach((r)=>{
      const id=r.dataset.row, kind=r.dataset.kind;
      const list=()=> kind==="income"?state.cats.income:state.cats.expense;
      r.querySelector("[data-emoji]").onchange=(e)=>{ const c=list().find((x)=>x.id===id); if(c){ c.icon=e.target.value; save(); } };
      r.querySelector("[data-name]").onchange=(e)=>{ const c=list().find((x)=>x.id===id); if(c){ c.label=e.target.value.trim()||c.label; save(); } };
      r.querySelector("[data-delcat]").onclick=()=>confirmDialog("حذف هذا التصنيف؟", ()=>{ const a=list(); const i=a.findIndex((x)=>x.id===id); if(i>=0)a.splice(i,1); save(); draw(); });
    });
    body.querySelectorAll("[data-add]").forEach((b)=>b.onclick=()=>{ const kind=b.dataset.add;
      (kind==="income"?state.cats.income:state.cats.expense).push({ id:"c"+uid(), label:"تصنيف جديد", icon:"📦" }); save(); draw(); });
  }
  draw();
  s.querySelector("#catsDone").onclick=()=>{ m.close(); render(); };
}

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime||"text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url); }, 100);
}
function exportJSON() {
  download(`daftar-backup-${todayStr()}.json`, JSON.stringify({
    transactions:state.transactions, debts:state.debts, wallets:state.wallets, cats:state.cats, activeCur:state.activeCur,
    exportedAt: new Date().toISOString(),
  }, null, 2), "application/json");
}
function exportCSV() {
  const head = ["التاريخ","النوع","العملة","المبلغ","التصنيف","الحساب","المحفظة","ملاحظة"];
  const rows = state.transactions.slice().sort((a,b)=>a.date<b.date?1:-1).map((t)=>[
    t.date, t.type==="income"?"وارد":"صادر", t.cur, t.amount, catInfo(t.category).label,
    t.account==="work"?"شغل":"شخصي", t.walletId?(walletName(t.walletId)||""):"", (t.note||"").replace(/\n/g," "),
  ]);
  const csv = "\uFEFF" + [head, ...rows].map((r)=>r.map((c)=>{
    const v=String(c==null?"":c); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v;
  }).join(",")).join("\r\n");
  download(`daftar-transactions-${todayStr()}.csv`, csv, "text/csv;charset=utf-8");
}

/* ---------- إقلاع ---------- */
load();
loadLic();
loadPay();
render();
maybeWelcome();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", ()=>{ navigator.serviceWorker.register("./service-worker.js").catch(()=>{}); });
}
