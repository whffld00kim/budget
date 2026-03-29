/* =============================================
   상수 / 설정
============================================= */
const DEFAULT_INCOME_ACCOUNTS  = ['개인연금', '보너스', '월급'];
const DEFAULT_EXPENSE_ACCOUNTS = ['주식', '금', '개인연금', '대출금상환', '비과세연금', '생활비'];
const SUBJECTS = ['도연', '민성', '공통'];
const MONTHS   = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const ACCOUNT_COLORS = {
  '개인연금':'#6366F1', '보너스':'#F59E0B', '월급':'#22C55E',
  '주식':'#3B82F6', '금':'#F97316', '대출금상환':'#EF4444',
  '비과세연금':'#8B5CF6', '생활비':'#06B6D4',
};
const COLOR_PALETTE = [
  '#6366F1','#F59E0B','#22C55E','#3B82F6','#F97316',
  '#EF4444','#8B5CF6','#06B6D4','#EC4899','#10B981','#F43F5E','#A78BFA',
];

function getColor(account, idx) {
  return ACCOUNT_COLORS[account] || COLOR_PALETTE[idx % COLOR_PALETTE.length];
}

/* =============================================
   localStorage
============================================= */
const STORAGE_TX  = 'gaegybu_final_tx_v3';
const STORAGE_CUS = 'gaegybu_final_custom_v3';

/* =============================================
   초기 데이터 (최초 1회만 로드)
============================================= */
const INIT_TX = [
  // ── 1월 ──
  { id:'d01', date:'2026-01-21', type:'income',  account:'월급',      subject:'도연', description:'도연월급',                                          amount:4539950  },
  { id:'d02', date:'2026-01-21', type:'income',  account:'월급',      subject:'민성', description:'민성월급',                                          amount:5142290  },
  { id:'d03', date:'2026-01-21', type:'income',  account:'개인연금',  subject:'민성', description:'민성 개인연금(월급)',                               amount:500720   },
  { id:'d04', date:'2026-01-21', type:'income',  account:'개인연금',  subject:'도연', description:'도연 개인연금(월급)',                               amount:546820   },
  { id:'d05', date:'2026-01-21', type:'expense', account:'개인연금',  subject:'-', description:'민성 개인연금(월급)',                               amount:500720   },
  { id:'d06', date:'2026-01-21', type:'expense', account:'개인연금',  subject:'-', description:'도연 개인연금(월급)',                               amount:546820   },
  { id:'d07', date:'2026-01-21', type:'expense', account:'기타',      subject:'-', description:'중도금대출이자(도연)',                              amount:279420   },
  { id:'d08', date:'2026-01-21', type:'expense', account:'기타',      subject:'-', description:'중도금대출이자(민성)',                              amount:279420   },
  { id:'d09', date:'2026-01-21', type:'expense', account:'비과세연금',subject:'-', description:'도연비과세연금',                                    amount:300000   },
  { id:'d10', date:'2026-01-21', type:'expense', account:'개인연금',  subject:'-', description:'도연개인연금',                                      amount:50000    },
  { id:'d11', date:'2026-01-21', type:'expense', account:'생활비',    subject:'-', description:'매월생활비',                                        amount:5000000  },
  { id:'d12', date:'2026-01-21', type:'expense', account:'대출금상환',subject:'-', description:'전세대출상환',                                      amount:187000   },
  { id:'d13', date:'2026-01-21', type:'expense', account:'비과세연금',subject:'-', description:'민성비과세연금',                                    amount:300000   },
  { id:'d14', date:'2026-01-21', type:'expense', account:'개별주식',  subject:'-', description:'개별주식',                                          amount:61191040 },
  { id:'d15', date:'2026-01-21', type:'expense', account:'금',        subject:'-', description:'금현물',                                            amount:460000   },
  { id:'d16', date:'2026-01-23', type:'income',  account:'기타',      subject:'공통', description:'아동수당',                                          amount:100000   },
  { id:'d17', date:'2026-01-25', type:'income',  account:'기타',      subject:'공통', description:'도겸이 돌반지+100, 이모님5, 처남장인어른5, 내생일10, 기타2', amount:1220000 },
  { id:'d18', date:'2026-01-30', type:'income',  account:'보너스',    subject:'민성', description:'OPI',                                               amount:29884730 },
  { id:'d19', date:'2026-01-30', type:'income',  account:'보너스',    subject:'도연', description:'OPI',                                               amount:27159910 },
  // ── 2월 ──
  { id:'d20', date:'2026-02-20', type:'income',  account:'월급',      subject:'도연', description:'도연월급',                                          amount:4347950  },
  { id:'d21', date:'2026-02-20', type:'income',  account:'월급',      subject:'민성', description:'민성월급',                                          amount:4760264  },
  { id:'d22', date:'2026-02-20', type:'income',  account:'개인연금',  subject:'민성', description:'민성 개인연금(월급)',                               amount:508840   },
  { id:'d23', date:'2026-02-20', type:'income',  account:'개인연금',  subject:'도연', description:'도연 개인연금(월급)',                               amount:498140   },
  { id:'d24', date:'2026-02-20', type:'expense', account:'개인연금',  subject:'-', description:'민성 개인연금(월급)',                               amount:508840   },
  { id:'d25', date:'2026-02-20', type:'expense', account:'개인연금',  subject:'-', description:'도연 개인연금(월급)',                               amount:508840   },
  { id:'d26', date:'2026-02-20', type:'expense', account:'개별주식',  subject:'-', description:'개별주식',                                          amount:2798949  },
  { id:'d27', date:'2026-02-20', type:'expense', account:'금',        subject:'-', description:'금현물',                                            amount:702725   },
  { id:'d28', date:'2026-02-20', type:'expense', account:'생활비',    subject:'-', description:'매월생활비',                                        amount:5000000  },
  { id:'d29', date:'2026-02-20', type:'expense', account:'비과세연금',subject:'-', description:'도연비과세연금',                                    amount:300000   },
  { id:'d30', date:'2026-02-20', type:'expense', account:'개인연금',  subject:'-', description:'도연개인연금',                                      amount:50000    },
  { id:'d31', date:'2026-02-20', type:'expense', account:'대출금상환',subject:'-', description:'전세대출상환',                                      amount:187000   },
  { id:'d32', date:'2026-02-20', type:'expense', account:'비과세연금',subject:'-', description:'민성비과세연금',                                    amount:300000   },
  { id:'d33', date:'2026-02-23', type:'income',  account:'기타',      subject:'공통', description:'설 수입금',                                         amount:800000   },
  { id:'d34', date:'2026-02-23', type:'expense', account:'기타',      subject:'-', description:'중도금대출이자(도연)',                              amount:279420   },
  { id:'d35', date:'2026-02-23', type:'expense', account:'기타',      subject:'-', description:'중도금대출이자(민성)',                              amount:279420   },
  { id:'d36', date:'2026-02-25', type:'income',  account:'기타',      subject:'공통', description:'아동수당',                                          amount:100000   },
  // ── 3월 ──
  { id:'d37', date:'2026-03-10', type:'income',  account:'보너스',    subject:'민성', description:'연차수당',                                          amount:1460580  },
  { id:'d38', date:'2026-03-10', type:'income',  account:'보너스',    subject:'도연', description:'연차수당',                                          amount:1073910  },
  { id:'d39', date:'2026-03-20', type:'income',  account:'월급',      subject:'도연', description:'도연월급',                                          amount:4242680  },
  { id:'d40', date:'2026-03-20', type:'income',  account:'월급',      subject:'민성', description:'민성월급',                                          amount:4785500  },
  { id:'d41', date:'2026-03-20', type:'income',  account:'개인연금',  subject:'민성', description:'민성 개인연금(월급)',                               amount:508840   },
  { id:'d42', date:'2026-03-20', type:'income',  account:'개인연금',  subject:'도연', description:'도연 개인연금(월급)',                               amount:498140   },
  { id:'d43', date:'2026-03-20', type:'expense', account:'개인연금',  subject:'-', description:'민성 개인연금(월급)',                               amount:508840   },
  { id:'d44', date:'2026-03-20', type:'expense', account:'개인연금',  subject:'-', description:'도연 개인연금(월급)',                               amount:508840   },
  { id:'d45', date:'2026-03-20', type:'expense', account:'금',        subject:'-', description:'금현물',                                            amount:670710   },
  { id:'d46', date:'2026-03-20', type:'expense', account:'생활비',    subject:'-', description:'매월생활비',                                        amount:5000000  },
  { id:'d47', date:'2026-03-20', type:'expense', account:'비과세연금',subject:'-', description:'도연비과세연금',                                    amount:300000   },
  { id:'d48', date:'2026-03-20', type:'expense', account:'개인연금',  subject:'-', description:'도연개인연금',                                      amount:50000    },
  { id:'d49', date:'2026-03-20', type:'expense', account:'대출금상환',subject:'-', description:'전세대출상환',                                      amount:187000   },
  { id:'d50', date:'2026-03-20', type:'expense', account:'비과세연금',subject:'-', description:'민성비과세연금',                                    amount:300000   },
  { id:'d51', date:'2026-03-23', type:'expense', account:'기타',      subject:'-', description:'중도금대출이자(도연)',                              amount:252380   },
  { id:'d52', date:'2026-03-23', type:'expense', account:'기타',      subject:'-', description:'중도금대출이자(민성)',                              amount:252380   },
];

const INIT_CUSTOM = { income: ['기타'], expense: ['개별주식', '기타'] };

function loadTx() {
  try {
    const raw = localStorage.getItem(STORAGE_TX);
    if (!raw) {
      saveTx(INIT_TX);
      saveCustom(INIT_CUSTOM);
      return [...INIT_TX];
    }
    return JSON.parse(raw);
  } catch { return [...INIT_TX]; }
}
function saveTx(list) {
  try {
    localStorage.setItem(STORAGE_TX, JSON.stringify(list));
  } catch(e) {
    toast('저장 실패: 저장 공간이 부족합니다');
  }
}

function loadCustom() {
  try {
    const raw = localStorage.getItem(STORAGE_CUS);
    return raw ? JSON.parse(raw) : { income:[], expense:[] };
  } catch { return { income:[], expense:[] }; }
}
function saveCustom(obj) { localStorage.setItem(STORAGE_CUS, JSON.stringify(obj)); }

function getIncomeAccounts()  { return [...DEFAULT_INCOME_ACCOUNTS,  ...loadCustom().income];  }
function getExpenseAccounts() { return [...DEFAULT_EXPENSE_ACCOUNTS, ...loadCustom().expense]; }

function addCustomAccount(type, name) {
  const c = loadCustom();
  const k = type === 'income' ? 'income' : 'expense';
  if (!c[k].includes(name)) { c[k].push(name); saveCustom(c); }
}


/* =============================================
   앱 상태
============================================= */
let txList = [];
let viewYear  = new Date().getFullYear();
let viewMonth = new Date().getMonth() + 1; // 1-indexed

let histTypeFilter    = 'all';
let histSubjectFilter = 'all';

let formType    = 'income';
let formAccount = null;
let formSubject = null;
let editingId   = null;

let chartBar        = null;
let chartExpDonut   = null;
let chartIncDonut   = null;

/* =============================================
   유틸
============================================= */
function fmt(n)   { return '₩' + Math.abs(n).toLocaleString('ko-KR'); }
function today()  { return new Date().toISOString().slice(0, 10); }
function uid()    { return 't' + Date.now() + Math.random().toString(36).slice(2,6); }

function monthTxs(y, m) {
  return txList.filter(t => {
    const [ty, tm] = t.date.split('-').map(Number);
    return ty === y && tm === m;
  });
}

function fmtDate(d) {
  const [,m,dd] = d.split('-');
  return `${+m}/${+dd}`;
}

function monthLabel(y, m) { return `${y}년 ${MONTHS[m-1]}`; }

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2000);
}

/* =============================================
   네비게이션
============================================= */
function goPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  const nb = document.getElementById('nav-' + name);
  if (nb) nb.classList.add('active');

  if (name === 'home')    renderHome();
  if (name === 'history') renderHistory();
  if (name === 'stats')   renderStats();
}

function changeMonth(delta) {
  viewMonth += delta;
  if (viewMonth > 12) { viewMonth = 1;  viewYear++; }
  if (viewMonth < 1)  { viewMonth = 12; viewYear--; }
  updateMonthLabels();
  // 현재 활성 페이지 재렌더
  const active = document.querySelector('.page.active');
  if (active?.id === 'page-home')    renderHome();
  if (active?.id === 'page-history') renderHistory();
  if (active?.id === 'page-stats')   renderStats();
}

function updateMonthLabels() {
  const label = monthLabel(viewYear, viewMonth);
  ['home-month','hist-month','stats-month'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });
}

/* =============================================
   홈 렌더링
============================================= */
function renderHome() {
  const txs = monthTxs(viewYear, viewMonth);
  const totalInc = txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalExp = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const bal = totalInc - totalExp;

  document.getElementById('home-balance').textContent = fmt(bal);
  document.getElementById('home-income').textContent  = fmt(totalInc);
  document.getElementById('home-expense').textContent = fmt(totalExp);

  // 주체별
  const subjEl = document.getElementById('home-subjects');
  const dashExp = txs.filter(t=>t.type==='expense'&&t.subject==='-').reduce((a,t)=>a+t.amount,0);
  const incomeRows = SUBJECTS.map(s => {
    const inc = txs.filter(t=>t.type==='income'&&t.subject===s).reduce((a,t)=>a+t.amount,0);
    return `<div class="subject-row">
      <div class="subject-name">${s}</div>
      <div class="subject-vals">
        <span class="sv-income">+${fmt(inc)}</span>
      </div>
    </div>`;
  }).join('');
  const dashRow = `<div class="subject-row">
    <div class="subject-name" style="color:var(--text3)">지출</div>
    <div class="subject-vals">
      <span class="sv-expense">-${fmt(dashExp)}</span>
    </div>
  </div>`;
  subjEl.innerHTML = incomeRows + dashRow;

  // 최근 내역 (최신 6건)
  const recent = [...txs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  const recentEl = document.getElementById('home-recent');
  if (recent.length === 0) {
    recentEl.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📭</div>
      <div class="empty-msg">이번달 내역이 없습니다</div>
      <div class="empty-sub">아래 + 버튼으로 추가해보세요</div>
    </div>`;
  } else {
    recentEl.innerHTML = recent.map(tx => txItem(tx)).join('');
    bindTxEvents(recentEl);
  }
}

/* =============================================
   내역 렌더링
============================================= */
function renderHistory() {
  let txs = monthTxs(viewYear, viewMonth);
  if (histTypeFilter    !== 'all') txs = txs.filter(t=>t.type===histTypeFilter);
  if (histSubjectFilter !== 'all') txs = txs.filter(t=>t.subject===histSubjectFilter);
  txs = [...txs].sort((a,b)=>b.date.localeCompare(a.date));

  const el = document.getElementById('history-list');
  if (txs.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-msg">내역이 없습니다</div>
    </div>`;
  } else {
    el.innerHTML = txs.map(tx => txItem(tx)).join('');
    bindTxEvents(el);
  }
}

/* =============================================
   거래 항목 HTML
============================================= */
function txItem(tx) {
  const isInc = tx.type === 'income';
  const sign  = isInc ? '+' : '-';
  return `<div class="tx-item" data-id="${tx.id}">
    <div class="tx-dot ${isInc?'inc':'exp'}">${isInc?'↑':'↓'}</div>
    <div class="tx-info">
      <div class="tx-top">
        <span class="tx-account">${tx.account}</span>
        <span class="tx-badge ${tx.subject==='-'?'badge-dash':`badge-${tx.subject}`}">${tx.subject}</span>
      </div>
      <div class="tx-sub">
        <span class="tx-date">${fmtDate(tx.date)}</span>
        ${tx.description ? `<span class="tx-date">·</span><span class="tx-desc">${tx.description}</span>` : ''}
      </div>
    </div>
    <div class="tx-right">
      <span class="tx-amount ${isInc?'inc':'exp'}">${sign}${Number(tx.amount).toLocaleString('ko-KR')}</span>
      <button class="tx-del" data-del="${tx.id}" title="삭제">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
  </div>`;
}

function bindTxEvents(container) {
  container.querySelectorAll('.tx-del[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('이 내역을 삭제하시겠습니까?')) {
        txList = txList.filter(t => t.id !== btn.dataset.del);
        saveTx(txList);
        const active = document.querySelector('.page.active');
        if (active?.id === 'page-home')    renderHome();
        if (active?.id === 'page-history') renderHistory();
        toast('삭제되었습니다');
      }
    });
  });
  container.querySelectorAll('.tx-item[data-id]').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.tx-del')) return;
      openEditModal(item.dataset.id);
    });
  });
}

/* =============================================
   통계 렌더링
============================================= */
function renderStats() {
  const txs = monthTxs(viewYear, viewMonth);

  // ── 월별 막대 차트 (최근 6개월) ──
  const months6 = [];
  for (let i = 5; i >= 0; i--) {
    let m = viewMonth - i, y = viewYear;
    while (m < 1)  { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    const mt = monthTxs(y, m);
    months6.push({
      label: MONTHS[m-1],
      inc:   mt.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),
      exp:   mt.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),
    });
  }

  const barCanvas = document.getElementById('chart-bar');
  if (chartBar) chartBar.destroy();
  chartBar = new Chart(barCanvas, {
    type: 'bar',
    data: {
      labels: months6.map(m=>m.label),
      datasets: [
        { label:'수입', data:months6.map(m=>m.inc),  backgroundColor:'rgba(16,185,129,.75)', borderRadius:5 },
        { label:'지출', data:months6.map(m=>m.exp),  backgroundColor:'rgba(239,68,68,.75)',  borderRadius:5 },
      ],
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ position:'top', labels:{ font:{size:12}, usePointStyle:true, pointStyleWidth:8 } },
        tooltip:{ callbacks:{ label:c=>`${c.dataset.label}: ${fmt(c.parsed.y)}` } },
      },
      scales:{
        x:{ grid:{display:false}, ticks:{font:{size:11}} },
        y:{ grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}, callback:v=>v>=1000000?(v/1000000).toFixed(0)+'M':v>=1000?(v/1000).toFixed(0)+'K':v } },
      },
    },
  });

  // ── 지출 도넛 ──
  buildDonut('expense', txs.filter(t=>t.type==='expense'), 'chart-expense-donut', 'expense-legend', 'expense-empty');

  // ── 수입 도넛 ──
  buildDonut('income',  txs.filter(t=>t.type==='income'),  'chart-income-donut',  'income-legend',  'income-empty');

  // ── 주체별 상세 ──
  const statsSubj = document.getElementById('stats-subjects');
  const statsDashExp = txs.filter(t=>t.type==='expense'&&t.subject==='-').reduce((a,t)=>a+t.amount,0);
  const statsIncRows = SUBJECTS.map(s => {
    const inc = txs.filter(t=>t.type==='income'&&t.subject===s).reduce((a,t)=>a+t.amount,0);
    return `<div class="subject-row">
      <div class="subject-name">${s}</div>
      <div class="subject-vals">
        <span class="sv-income">+${fmt(inc)}</span>
      </div>
    </div>`;
  }).join('');
  const statsDashRow = `<div class="subject-row">
    <div class="subject-name" style="color:var(--text3)">지출</div>
    <div class="subject-vals">
      <span class="sv-expense">-${fmt(statsDashExp)}</span>
    </div>
  </div>`;
  statsSubj.innerHTML = statsIncRows + statsDashRow;
}

function buildDonut(kind, txs, canvasId, legendId, emptyId) {
  const map = {};
  txs.forEach(t => { map[t.account] = (map[t.account]||0) + t.amount; });
  const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]);
  const total   = entries.reduce((s,[,v])=>s+v,0);

  const canvas = document.getElementById(canvasId);
  const legend = document.getElementById(legendId);
  const empty  = document.getElementById(emptyId);

  const prev = kind === 'expense' ? chartExpDonut : chartIncDonut;
  if (prev) prev.destroy();

  if (entries.length === 0) {
    empty.style.display = 'block';
    canvas.style.display = 'none';
    legend.innerHTML = '';
    return;
  }
  empty.style.display = 'none';
  canvas.style.display = 'block';

  const colors = entries.map(([acc],i) => getColor(acc,i));

  const inst = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: entries.map(([a])=>a),
      datasets: [{ data:entries.map(([,v])=>v), backgroundColor:colors, borderWidth:0, hoverOffset:6 }],
    },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'65%',
      plugins:{
        legend:{ display:false },
        tooltip:{ callbacks:{ label:c=>`${c.label}: ${fmt(c.parsed)}` } },
      },
    },
  });

  if (kind === 'expense') chartExpDonut = inst;
  else                    chartIncDonut = inst;

  legend.innerHTML = entries.map(([acc,val],i) => `
    <li>
      <span class="legend-dot" style="background:${colors[i]}"></span>
      <span class="legend-name">${acc}</span>
      <span class="legend-pct">${total?Math.round(val/total*100):0}%</span>
    </li>`).join('');
}

/* =============================================
   모달 – 추가 / 수정
============================================= */
function openAddModal() {
  editingId   = null;
  formType    = 'income';
  formAccount = null;
  formSubject = null; // 입금은 사용자가 선택
  document.getElementById('modal-title').textContent = '거래 추가';
  renderModalForm();
  document.getElementById('modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function openEditModal(id) {
  const tx = txList.find(t => t.id === id);
  if (!tx) return;
  editingId   = id;
  formType    = tx.type;
  formAccount = tx.account;
  formSubject = tx.subject;
  document.getElementById('modal-title').textContent = '거래 수정';
  renderModalForm(tx);
  document.getElementById('modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function renderModalForm(tx) {
  if (formType === 'expense') formSubject = '-';
  const dateVal    = tx?.date        || today();
  const descVal    = tx?.description || '';
  const amountVal  = tx?.amount      || '';

  document.getElementById('modal-body').innerHTML = `
    <!-- 구분 -->
    <div class="form-group">
      <label class="form-label">구분</label>
      <div class="type-toggle">
        <button class="type-btn ${formType==='income'?'sel-inc':''}"  data-t="income">입금</button>
        <button class="type-btn ${formType==='expense'?'sel-exp':''}" data-t="expense">출금</button>
      </div>
    </div>

    <!-- 날짜 -->
    <div class="form-group">
      <label class="form-label">날짜</label>
      <input type="date" id="f-date" class="form-input" value="${dateVal}" />
    </div>

    <!-- 계정 -->
    <div class="form-group">
      <label class="form-label">계정</label>
      <div id="account-chips" class="chip-group"></div>
    </div>

    <!-- 주체 -->
    <div class="form-group">
      <label class="form-label">주체</label>
      <div class="chip-group" id="subject-chips">
        ${formType === 'expense'
          ? `<div class="chip selected chip-dash">-</div>`
          : SUBJECTS.map(s=>`<button class="chip ${formSubject===s?'selected':''}" data-subj="${s}">${s}</button>`).join('')
        }
      </div>
    </div>

    <!-- 내용 -->
    <div class="form-group">
      <label class="form-label">내용</label>
      <input type="text" id="f-desc" class="form-input" placeholder="내용을 입력하세요 (선택)" value="${escHtml(descVal)}" />
    </div>

    <!-- 금액 -->
    <div class="form-group">
      <label class="form-label">금액</label>
      <div class="amount-wrap">
        <input type="number" id="f-amount" class="form-input" placeholder="0" min="0" inputmode="numeric" value="${amountVal}" />
        <span class="amount-unit">원</span>
      </div>
    </div>

    <button class="btn-save" id="btn-save">${editingId ? '수정하기' : '저장하기'}</button>
  `;

  renderAccountChips();
  bindModalEvents();
}

function renderAccountChips() {
  const accounts = formType === 'income' ? getIncomeAccounts() : getExpenseAccounts();
  const container = document.getElementById('account-chips');
  if (!container) return;

  container.innerHTML = accounts.map(acc =>
    `<button class="chip ${formAccount===acc?'selected':''}" data-acc="${acc}">${acc}</button>`
  ).join('') + `<button class="chip add-chip" id="btn-add-acc">+ 추가</button>`;

  container.querySelectorAll('.chip[data-acc]').forEach(chip => {
    chip.addEventListener('click', () => {
      formAccount = chip.dataset.acc;
      renderAccountChips();
    });
  });

  document.getElementById('btn-add-acc').addEventListener('click', () => {
    showNewAccInput(container);
  });
}

function renderSubjectChips() {
  const container = document.getElementById('subject-chips');
  if (!container) return;
  if (formType === 'expense') {
    formSubject = '-';
    container.innerHTML = `<div class="chip selected chip-dash">-</div>`;
  } else {
    container.innerHTML = SUBJECTS.map(s =>
      `<button class="chip ${formSubject===s?'selected':''}" data-subj="${s}">${s}</button>`
    ).join('');
    container.querySelectorAll('.chip[data-subj]').forEach(chip => {
      chip.addEventListener('click', () => {
        formSubject = chip.dataset.subj;
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
    });
  }
}

function showNewAccInput(container) {
  if (container.querySelector('.new-acc-wrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'new-acc-wrap';
  wrap.innerHTML = `<input type="text" class="form-input" placeholder="새 계정 이름 입력" maxlength="10" /><button class="btn-acc-confirm">확인</button>`;
  container.appendChild(wrap);
  const inp = wrap.querySelector('input');
  inp.focus();
  wrap.querySelector('.btn-acc-confirm').addEventListener('click', () => confirmNewAcc(inp.value.trim()));
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmNewAcc(inp.value.trim());
    if (e.key === 'Escape') wrap.remove();
  });
  inp.addEventListener('blur', () => setTimeout(() => { if (wrap.isConnected && !inp.value.trim()) wrap.remove(); }, 200));
}

function confirmNewAcc(name) {
  if (!name) return;
  addCustomAccount(formType, name);
  formAccount = name;
  renderAccountChips();
}

function bindModalEvents() {
  // 구분 전환 – 폼 전체 재렌더 없이 버튼 스타일 + 계정 칩만 갱신
  document.querySelectorAll('.type-btn[data-t]').forEach(btn => {
    btn.addEventListener('click', () => {
      formType    = btn.dataset.t;
      formAccount = null;
      // 버튼 active 스타일 교체
      document.querySelectorAll('.type-btn[data-t]').forEach(b => {
        b.className = 'type-btn' + (b.dataset.t === formType
          ? (formType === 'income' ? ' sel-inc' : ' sel-exp')
          : '');
      });
      // 계정 칩 + 주체 칩 갱신
      renderAccountChips();
      renderSubjectChips();
    });
  });

  // 주체 선택 (입금일 때만 해당)
  document.querySelectorAll('#subject-chips .chip[data-subj]').forEach(chip => {
    chip.addEventListener('click', () => {
      formSubject = chip.dataset.subj;
      document.querySelectorAll('#subject-chips .chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });

  // 저장
  document.getElementById('btn-save').addEventListener('click', saveTransaction);
}

function saveTransaction() {
  const date   = document.getElementById('f-date').value;
  const desc   = document.getElementById('f-desc').value.trim();
  const amtStr = document.getElementById('f-amount').value;

  if (!date)                     { toast('날짜를 선택해주세요'); return; }
  if (!formAccount)              { toast('계정을 선택해주세요'); return; }
  if (!formSubject)              { toast('주체를 선택해주세요'); return; }
  if (!amtStr || +amtStr <= 0)   { toast('금액을 입력해주세요'); return; }

  const amount = Math.floor(+amtStr);

  if (editingId) {
    const idx = txList.findIndex(t => t.id === editingId);
    if (idx !== -1) txList[idx] = { id:editingId, date, type:formType, account:formAccount, subject:formSubject, description:desc, amount };
    toast('수정되었습니다');
  } else {
    txList.push({ id:uid(), date, type:formType, account:formAccount, subject:formSubject, description:desc, amount });
    toast('저장되었습니다');
  }

  saveTx(txList);
  closeModal();

  const active = document.querySelector('.page.active');
  if (active?.id === 'page-home')    renderHome();
  if (active?.id === 'page-history') renderHistory();
  if (active?.id === 'page-stats')   renderStats();
}

/* =============================================
   HTML 이스케이프
============================================= */
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* =============================================
   백업 / 불러오기
============================================= */
function backupData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: txList,
    custom: loadCustom(),
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `가계부_백업_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('백업 파일이 저장되었습니다.');
}

function restoreData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.transactions)) throw new Error('올바른 백업 파일이 아닙니다.');
      if (!confirm(`${data.transactions.length}개의 거래 내역을 불러옵니다.\n현재 데이터는 덮어씌워집니다. 계속할까요?`)) return;
      txList = data.transactions;
      saveTx();
      saveCustom(data.custom || { income: [], expense: [] });
      renderHome();
      toast('불러오기 완료!');
    } catch (err) {
      alert('파일을 읽는 중 오류가 발생했습니다:\n' + err.message);
    }
  };
  reader.readAsText(file);
}

/* =============================================
   이벤트 바인딩 (초기화)
============================================= */
document.addEventListener('DOMContentLoaded', () => {
  txList = loadTx();
  updateMonthLabels();

  // 페이지 네비게이션
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => goPage(btn.dataset.page));
  });

  // 추가 버튼
  document.getElementById('nav-add').addEventListener('click', openAddModal);

  // 월 이동 – 홈
  document.getElementById('home-prev').addEventListener('click', () => changeMonth(-1));
  document.getElementById('home-next').addEventListener('click', () => changeMonth(1));
  // 월 이동 – 내역
  document.getElementById('hist-prev').addEventListener('click', () => changeMonth(-1));
  document.getElementById('hist-next').addEventListener('click', () => changeMonth(1));
  // 월 이동 – 통계
  document.getElementById('stats-prev').addEventListener('click', () => changeMonth(-1));
  document.getElementById('stats-next').addEventListener('click', () => changeMonth(1));

  // 내역 필터 – 구분 탭
  document.querySelectorAll('#hist-type-tabs .ftab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#hist-type-tabs .ftab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      histTypeFilter = btn.dataset.val;
      renderHistory();
    });
  });

  // 내역 필터 – 주체 칩
  document.querySelectorAll('#hist-subject-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#hist-subject-chips .chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      histSubjectFilter = chip.dataset.val;
      renderHistory();
    });
  });

  // 홈 – 전체보기
  document.getElementById('btn-see-all').addEventListener('click', () => goPage('history'));

  // 백업 / 불러오기
  document.getElementById('btn-backup').addEventListener('click', backupData);
  document.getElementById('btn-restore').addEventListener('click', () => document.getElementById('restore-file').click());
  document.getElementById('restore-file').addEventListener('change', e => {
    restoreData(e.target.files[0]);
    e.target.value = '';
  });

  // 모달 닫기
  document.getElementById('modal-close').addEventListener('click',    closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', closeModal);

  // 앱이 백그라운드에서 돌아올 때 데이터 새로고침 (iOS PWA 대응)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      txList = loadTx();
      const active = document.querySelector('.page.active');
      if (active?.id === 'page-home')    renderHome();
      if (active?.id === 'page-history') renderHistory();
      if (active?.id === 'page-stats')   renderStats();
    }
  });

  // 초기 렌더
  renderHome();
});
