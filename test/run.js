#!/usr/bin/env node
/* 가계부 동기화·계산 시험 (2026-10-12)
   실제 Chromium(Playwright)으로 index.html 을 열고, Firebase 스크립트 요청을 test/fake-firebase.js 로 바꿔치기해
   로그인·내려받기·저장·오프라인을 흉내 낸다. 가짜 서버 데이터는 이 파일(Node)이 들고 있고
   브라우저 안의 가짜 SDK 와 window.__fakeDb 바인딩으로 오간다. 시험마다 새 브라우저 컨텍스트(=새 기기)를 쓴다.
   실행: npm install && npm test   (Chromium 이 없으면 npx playwright install chromium) */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let pw;
try { pw = require('playwright'); }
catch { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }

const UID = 'uid-test', HID = 'hid-test', USER = { uid: UID, email: 'test@example.test' };
const KEY = { tx: 'gaegybu_final_tx_v3', custom: 'gaegybu_final_custom_v3', fixed: 'gaegybu_final_fixed_v1',
              irr: 'gaegybu_irregular_v1', deduct: 'gaegybu_deduct_v1', living: 'gaegybu_living_v1' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 정적 서버 ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('404'); }
      res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream');
      res.setHeader('cache-control', 'no-store');
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

/* ---------- 가짜 RTDB (Node 쪽) ---------- */
// 실제 RTDB 처럼 빈 배열·빈 객체·null 은 저장하지 않는다 (키째로 사라진다)
function clean(v) {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) { const a = v.map(clean).filter(x => x !== undefined); return a.length ? a : undefined; }
  if (typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) { const c = clean(x); if (c !== undefined) o[k] = c; }
    return Object.keys(o).length ? o : undefined;
  }
  return v;
}
const parts = p => String(p || '').split('/').filter(Boolean);
function getAt(obj, p) { let cur = obj; for (const k of parts(p)) { if (cur == null || typeof cur !== 'object') return undefined; cur = cur[k]; } return cur; }
function setAt(obj, p, v) {
  const ks = parts(p); let cur = obj;
  for (const k of ks.slice(0, -1)) { if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; }
  const last = ks[ks.length - 1];
  if (v === undefined) delete cur[last]; else cur[last] = v;
}
function makeServer(ledger) {
  const data = { users: { [UID]: { householdId: HID } }, 'home-ledger': {} };
  const s = {
    data, writes: [],
    get ledger() { return data['home-ledger'][HID] || {}; },
    setLedger(l) { data['home-ledger'][HID] = clean(l); },
    txs() { const t = s.ledger.transactions; return t ? (Array.isArray(t) ? t : Object.values(t)) : []; },
  };
  if (ledger) s.setLedger(ledger);
  return s;
}

/* ---------- 기기(브라우저 컨텍스트) ---------- */
const FAKE_SRC = fs.readFileSync(path.join(__dirname, 'fake-firebase.js'), 'utf8');
async function newDevice(browser, base, server) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Seoul', locale: 'ko-KR', viewport: { width: 400, height: 800 } });
  const dev = { ctx, server, online: true, pending: [], user: USER, errors: [], pages: [] };
  await ctx.exposeBinding('__fakeDb', async (source, op, args) => {
    if (op === 'user') return dev.user;
    if (op === 'signin') { dev.user = USER; return USER; }
    if (op === 'signout') { dev.user = null; return null; }
    if (op === 'connected') return dev.online;
    const run = () => {
      if (op === 'get') { const v = getAt(server.data, args.path); return v === undefined ? null : JSON.parse(JSON.stringify(v)); }
      if (op === 'update') {
        for (const [k, v] of Object.entries(args.obj)) setAt(server.data, args.path + '/' + k, clean(v));
        server.writes.push({ path: args.path, keys: Object.keys(args.obj) });
        return null;
      }
      if (op === 'set') { setAt(server.data, args.path, clean(args.v)); return null; }
      throw new Error('unknown op ' + op);
    };
    if (dev.online) return run();
    // 오프라인: 실제 SDK 처럼 연결될 때까지 멈춰 있는다 (기기가 켜져 있으면 연결 뒤 이어서 처리된다)
    return new Promise(resolve => dev.pending.push(() => resolve(run())));
  });
  await ctx.route(u => u.hostname === 'www.gstatic.com', r => r.fulfill({ contentType: 'application/javascript', body: FAKE_SRC }));
  await ctx.route(u => u.hostname === 'cdn.jsdelivr.net', r => r.fulfill({ contentType: 'application/javascript', body: 'window.Chart = class { constructor() {} destroy() {} };' }));
  await ctx.addInitScript(() => {
    window.__toasts = [];
    Object.defineProperty(navigator, 'onLine', { get: () => (window.__onLine === undefined ? true : window.__onLine) });
    document.addEventListener('DOMContentLoaded', () => {
      const el = document.getElementById('toast');
      if (!el) return;
      new MutationObserver(() => {
        const t = el.textContent.trim();
        if (t && !el.classList.contains('hidden') && window.__toasts[window.__toasts.length - 1] !== t) window.__toasts.push(t);
      }).observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
    });
  });
  const live = () => dev.pages.filter(p => !p.isClosed());
  dev.open = async (o = {}) => {
    const page = await ctx.newPage();
    dev.pages.push(page);
    page.dialogs = []; page.dialogReply = { accept: true, text: '' };
    page.on('dialog', async d => {
      page.dialogs.push({ type: d.type(), message: d.message() });
      const r = page.dialogReply;
      if (r.accept) await d.accept(r.text || undefined); else await d.dismiss();
    });
    page.on('pageerror', e => dev.errors.push(String(e.message).split('\n')[0]));
    if (o.fixedTime) await page.clock.setFixedTime(o.fixedTime);
    if (dev.online === false) await page.addInitScript(() => { window.__onLine = false; });
    await page.goto(base + 'index.html');
    return page;
  };
  // 앱이 죽은 것처럼: 페이지를 닫고, 그 페이지가 기다리던 서버 요청도 버린다
  dev.kill = async page => { dev.pending = []; await page.close(); };
  dev.goOffline = async () => {
    dev.online = false;
    for (const p of live()) await p.evaluate(() => { window.__onLine = false; window.__fakeConnected && window.__fakeConnected(false); }).catch(() => {});
  };
  dev.goOnline = async () => {
    dev.online = true;
    dev.pending.splice(0).forEach(fn => { try { fn(); } catch {} });
    for (const p of live()) await p.evaluate(() => { window.__onLine = true; window.__fakeConnected && window.__fakeConnected(true); }).catch(() => {});
  };
  dev.close = () => ctx.close();
  return dev;
}

/* ---------- 도우미 ---------- */
async function waitFor(fn, ms = 5000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(50); } return false; }
async function appReady(page, ms = 10000) { await page.waitForSelector('#auth-screen.hidden', { state: 'attached', timeout: ms }); }
const local = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const toasts = page => page.evaluate(() => window.__toasts);
const text = (page, sel) => page.locator(sel).first().textContent().then(t => (t || '').replace(/\s+/g, ' ').trim());
const waitPush = (server, prevAt, ms = 5000) => waitFor(() => (server.ledger.updatedAt || 0) > prevAt, ms);
async function addTx(page, { type = 'income', account = '월급', subject = '민성', desc = '', amount = 1000, date } = {}) {
  await page.click('#nav-add');
  await page.waitForSelector('#modal:not(.hidden)');
  await page.click(`.type-btn[data-t="${type}"]`);
  await page.click(`#account-chips .chip[data-acc="${account}"]`);
  if (type === 'income') await page.click(`#subject-chips .chip[data-subj="${subject}"]`);
  if (date) await page.fill('#f-date', date);
  if (desc) await page.fill('#f-desc', desc);
  await page.fill('#f-amount', String(amount));
  await page.click('#btn-save');
  await page.waitForSelector('#modal.hidden', { state: 'attached' });
}

const T = (id, date, type, account, subject, amount, description = '') => ({ id, date, type, account, subject, description, amount });
const EMPTY = { custom: { income: [], expense: [] }, fixed: [], irregular: { categories: [], entries: [] }, deduct: { accounts: [] }, living: { accounts: [], cards: [] } };
const SEED = {
  version: 2, updatedAt: 1000, updatedBy: UID, ...EMPTY,
  transactions: [
    T('t1', '2025-12-31', 'income',  '월급',   '민성', 3000000),
    T('t2', '2025-12-31', 'expense', '생활비', '-',    1200000),
    T('t3', '2026-01-01', 'income',  '보너스', '도연',  500000),
    T('t4', '2026-01-15', 'expense', '주식',   '-',     700000),
    T('t5', '2026-01-31', 'expense', '금',     '-',     300000),
    T('t6', '2026-02-01', 'income',  '월급',   '민성', 3100000),
  ],
};
const JAN = new Date('2026-01-20T12:00:00+09:00');

/* ---------- 시험 목록 ---------- */
const results = [];
async function scenario(name, fn) {
  const fails = [];
  const check = (cond, msg) => { if (!cond) fails.push(msg); };
  try { await fn(check); } catch (e) { fails.push('예외: ' + String(e.message || e).split('\n')[0]); }
  results.push({ name, fails });
  console.log((fails.length ? '✗ ' : '✓ ') + name + (fails.length ? '\n    - ' + fails.join('\n    - ') : ''));
}

async function main() {
  const { srv, base } = await serve();
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--proxy-server=direct://', '--proxy-bypass-list=*'] });
  const only = process.argv[2];
  const run = (name, fn) => (!only || name.includes(only)) ? scenario(name, fn) : Promise.resolve();

  await run('S0 로그인 → 내려받기 → 입력 → 올리기', async check => {
    const server = makeServer(SEED); const dev = await newDevice(browser, base, server);
    const page = await dev.open({ fixedTime: JAN }); await appReady(page);
    check((await local(page, KEY.tx)).length === 6, '로그인 뒤 localStorage 에 거래 6건');
    await addTx(page, { desc: '첫입력', amount: 1000 });
    check(await waitPush(server, 1000), '1.5초 디바운스 뒤 서버에 올라감');
    check(server.txs().some(t => t.description === '첫입력'), '서버 거래에 새 항목');
    check(server.ledger.updatedBy === UID && server.ledger.version === 2, 'updatedBy·version 유지');
    check(dev.errors.length === 0, '페이지 오류 없음: ' + dev.errors.join(' | '));
    await dev.close();
  });

  await run('S1 탭 복귀 때 다른 기기 변경을 받아온다 (첫 저장 뒤에도)', async check => {
    const server = makeServer(SEED); const dev = await newDevice(browser, base, server);
    const page = await dev.open({ fixedTime: JAN }); await appReady(page);
    await addTx(page, { desc: '내입력' });
    check(await waitPush(server, 1000), '첫 저장 올라감');
    const at = server.ledger.updatedAt;
    server.setLedger({ ...server.ledger, transactions: [...server.txs(), T('b2', '2026-01-20', 'income', '월급', '도연', 777, '다른기기')], updatedAt: at + 1000, updatedBy: 'other' });
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    check(await page.evaluate(() => document.visibilityState) === 'visible', 'visibilityState=visible');
    const got = await waitFor(async () => (await local(page, KEY.tx)).some(t => t.id === 'b2'), 4000);
    check(got, '탭 복귀 뒤 다른 기기 거래(b2)가 로컬에 반영됨');
    check((await toasts(page)).some(t => t.includes('다른 기기의 변경을 반영')), '반영 토스트');
    check(await waitFor(() => page.locator('#home-recent').textContent().then(t => t.includes('다른기기')), 2000), '홈 최근 내역에 표시');
    await dev.close();
  });

  await run('S2 다른 기기가 먼저 저장했으면 덮지 않고 알린다 (멈추고 알림 유지)', async check => {
    const server = makeServer(SEED); const dev = await newDevice(browser, base, server);
    const page = await dev.open({ fixedTime: JAN }); await appReady(page);
    server.setLedger({ ...server.ledger, updatedAt: 9000, updatedBy: 'other' });
    await addTx(page, { desc: '충돌입력' });
    await sleep(3000);
    check(server.ledger.updatedAt === 9000 && !server.txs().some(t => t.description === '충돌입력'), '서버를 덮지 않음');
    check((await toasts(page)).some(t => t.includes('다른 기기에서 변경')), '충돌 토스트');
    check((await local(page, KEY.tx)).some(t => t.description === '충돌입력'), '이 기기 사본에는 남아 있음');
    await dev.close();
  });

  await run('S3 오프라인 입력 → 앱 종료 → 온라인으로 다시 열면 올린다', async check => {
    const server = makeServer(SEED); const dev = await newDevice(browser, base, server);
    let page = await dev.open({ fixedTime: JAN }); await appReady(page);
    await dev.goOffline();
    await addTx(page, { desc: '오프라인입력' });
    await sleep(2500);
    check(!server.txs().some(t => t.description === '오프라인입력'), '오프라인 동안은 서버에 없음');
    await dev.kill(page);
    await dev.goOnline();
    page = await dev.open({ fixedTime: JAN }); await appReady(page);
    check(await waitFor(() => server.txs().some(t => t.description === '오프라인입력'), 5000), '다시 열면 못 올린 거래가 서버에 올라감');
    check((await local(page, KEY.tx)).some(t => t.description === '오프라인입력'), '로컬에도 그대로');
    await dev.close();
  });

  await run('S3b 오프라인 입력 뒤 다른 기기가 먼저 저장했으면 덮지 않고 알린다', async check => {
    const server = makeServer(SEED); const dev = await newDevice(browser, base, server);
    let page = await dev.open({ fixedTime: JAN }); await appReady(page);
    await dev.goOffline();
    await addTx(page, { desc: '오프라인입력' });
    await sleep(2500);
    await dev.kill(page);
    server.setLedger({ ...server.ledger, transactions: [...server.txs(), T('b1', '2026-01-21', 'income', '월급', '도연', 5, '다른기기')], updatedAt: 5000, updatedBy: 'other' });
    await dev.goOnline();
    page = await dev.open({ fixedTime: JAN }); await appReady(page);
    await sleep(2500);
    check(server.ledger.updatedAt === 5000 && !server.txs().some(t => t.description === '오프라인입력'), '서버(다른 기기 버전)를 덮지 않음');
    check((await local(page, KEY.tx)).some(t => t.id === 'b1') && !(await local(page, KEY.tx)).some(t => t.description === '오프라인입력'), '로컬은 서버 버전');
    check((await toasts(page)).some(t => t.includes('반영하지 못했')), '못 올렸다는 알림');
    await dev.close();
  });

  await run('S4 못 올린 변경이 있을 때 로그아웃하면 지우기 전에 묻는다', async check => {
    const server = makeServer(SEED); const dev = await newDevice(browser, base, server);
    const page = await dev.open({ fixedTime: JAN }); await appReady(page);
    await dev.goOffline();
    await addTx(page, { desc: '오프라인입력' });
    await sleep(2500);
    page.dialogReply = { accept: false };
    await page.click('#btn-signout');
    await sleep(1500);
    check(page.dialogs.some(d => d.type === 'confirm' && d.message.includes('저장되지 않은')), '확인 창');
    check(await page.evaluate(() => document.getElementById('auth-screen').classList.contains('hidden')), '취소하면 로그인 유지');
    check((await local(page, KEY.tx) || []).some(t => t.description === '오프라인입력'), '취소하면 로컬 유지');
    await dev.close();
  });

  await run('S5 서버가 빈 배열을 지워 돌려줘도 추가 창·이체 탭이 열린다', async check => {
    const server = makeServer({ ...SEED, transactions: [T('x1', '2026-01-05', 'expense', 'ISA2', '-', 100)],
      custom: { income: [], expense: ['ISA2'] }, deduct: { accounts: [{ id: 'a1', name: '월급통장', items: [] }] } });
    check(server.ledger.custom.income === undefined && server.ledger.deduct.accounts[0].items === undefined, '가짜 서버가 빈 배열을 지웠음');
    const dev = await newDevice(browser, base, server);
    const page = await dev.open({ fixedTime: JAN }); await appReady(page);
    await page.click('#nav-add'); await sleep(300);
    check(await page.locator('#account-chips .chip[data-acc]').count() > 0, '추가 창에 계정 칩이 그려짐');
    await page.click('#modal-close');
    await page.click('#nav-transfer'); await sleep(300);
    check((await text(page, '#deduct-list')).includes('월급통장'), '이체 탭에 통장이 그려짐');
    check(dev.errors.length === 0, '페이지 오류 없음: ' + dev.errors.join(' | '));
    await dev.close();
  });

  await run('S6 불러오기 뒤 고정 항목이 파일 것으로 바뀐다 (메모리도)', async check => {
    const server = makeServer({ ...SEED, fixed: [{ id: 'f1', type: 'expense', account: '생활비', subject: '-', description: '관리비', amount: 150000 }] });
    const dev = await newDevice(browser, base, server);
    const page = await dev.open({ fixedTime: JAN }); await appReady(page);
    const file = { version: 2, transactions: SEED.transactions, custom: EMPTY.custom,
      fixed: [{ id: 'f2', type: 'expense', account: '생활비', subject: '-', description: '보험료', amount: 99000 }] };
    await page.setInputFiles('#restore-file', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
    check(await waitFor(async () => (await toasts(page)).some(t => t.includes('불러오기 완료')), 3000), '불러오기 완료');
    await page.click('#nav-fixed'); await sleep(300);
    const shown = await text(page, '#fixed-list');
    check(shown.includes('보험료') && !shown.includes('관리비'), '고정 탭에 파일의 항목(보험료)만 보임: ' + shown);
    page.dialogReply = { accept: true, text: '120000' };
    await page.click('#fixed-list .fixed-amt'); await sleep(300);
    const fixed = await local(page, KEY.fixed);
    check(fixed.length === 1 && fixed[0].description === '보험료' && fixed[0].amount === 120000, '금액 수정 뒤에도 파일의 항목이 유지됨: ' + JSON.stringify(fixed));
    await dev.close();
  });

  await run('S7 오프라인으로 열어도 저장된 사본으로 열리고, 연결되면 올린다', async check => {
    const server = makeServer(SEED); const dev = await newDevice(browser, base, server);
    let page = await dev.open({ fixedTime: JAN }); await appReady(page);
    await dev.kill(page);
    await dev.goOffline();
    page = await dev.open({ fixedTime: JAN });
    let opened = true;
    try { await appReady(page, 4000); } catch { opened = false; }
    check(opened, '오프라인에서 4초 안에 앱이 열림');
    if (opened) {
      check(await text(page, '#home-balance') === '1,300,000', '사본의 잔액 표시');
      await addTx(page, { desc: '오프라인추가' });
      await sleep(2000);
      await dev.goOnline();
      check(await waitFor(() => server.txs().some(t => t.description === '오프라인추가'), 5000), '연결되면 서버에 올라감');
    }
    await dev.close();
  });

  await run('S8 오늘 날짜는 기기 시간대 기준 (11월 1일 아침 8시 30분)', async check => {
    const server = makeServer(SEED); const dev = await newDevice(browser, base, server);
    const page = await dev.open({ fixedTime: new Date('2026-11-01T08:30:00+09:00') }); await appReady(page);
    check((await text(page, '#home-month')) === '2026년 11월', '홈 월 표시 11월');
    await page.click('#nav-add'); await page.waitForSelector('#modal:not(.hidden)');
    const d = await page.inputValue('#f-date');
    check(d === '2026-11-01', '추가 창 기본 날짜가 2026-11-01 (실제: ' + d + ')');
    await dev.close();
  });

  await run('S9 고정 항목 추가가 거래로 새지 않고, 취소해도 다음 입력에 영향 없음', async check => {
    const server = makeServer(SEED); const dev = await newDevice(browser, base, server);
    const page = await dev.open({ fixedTime: JAN }); await appReady(page);
    await page.click('#nav-fixed'); await page.click('#btn-add-fixed');
    await page.waitForSelector('#modal:not(.hidden)');
    await page.click('#account-chips .chip[data-acc="월급"]'); await page.click('#subject-chips .chip[data-subj="민성"]');
    await page.fill('#f-desc', '월급고정'); await page.fill('#f-amount', '3000000'); await page.click('#btn-save');
    await sleep(300);
    check((await local(page, KEY.fixed)).length === 1, '고정 항목 1건');
    check((await local(page, KEY.tx)).length === 6, '거래는 그대로 6건');
    await page.click('#btn-add-fixed'); await page.waitForSelector('#modal:not(.hidden)'); await page.click('#modal-close');   // 취소
    await addTx(page, { desc: '보통입력', amount: 500 });
    const tx = await local(page, KEY.tx), fx = await local(page, KEY.fixed);
    check(tx.length === 7 && tx.filter(t => t.description === '월급고정').length === 0, '거래 7건, 고정 항목이 거래로 새지 않음 (실제 ' + tx.length + '건)');
    check(fx.length === 1, '취소한 뒤의 보통 입력은 고정 항목이 되지 않음 (실제 ' + fx.length + '건)');
    await dev.close();
  });

  await run('S10 월·연 합계, 이월잔액, 삭제 뒤 합계', async check => {
    const server = makeServer(SEED); const dev = await newDevice(browser, base, server);
    const page = await dev.open({ fixedTime: JAN }); await appReady(page);
    check(await text(page, '#home-income') === '500,000', '1월 수입 500,000');
    check(await text(page, '#home-expense') === '1,000,000', '1월 지출 1,000,000');
    check(await text(page, '#home-carry') === '+1,800,000', '이월 +1,800,000');
    check(await text(page, '#home-balance') === '1,300,000', '잔액 1,300,000');
    const subj = await text(page, '#home-subjects');
    check(subj.includes('도연 +500,000') && subj.includes('민성 +0') && subj.includes('지출 -1,000,000'), '주체별 현황: ' + subj);
    await page.click('#nav-stats'); await sleep(200);
    check((await text(page, '#stats-subjects')).includes('지출 -1,000,000'), '통계(월) 지출');
    await page.click('#stats-mode .seg-btn[data-mode="year"]'); await sleep(200);
    check(await text(page, '#stats-month') === '2026년', '연 단위 라벨');
    const ys = await text(page, '#stats-subjects');
    check(ys.includes('도연 +500,000') && ys.includes('민성 +3,100,000') && ys.includes('지출 -1,000,000'), '연 합계 주체별: ' + ys);
    const leg = await text(page, '#expense-legend');
    check(leg.includes('주식 70%') && leg.includes('금 30%'), '지출 도넛 비율: ' + leg);
    await page.click('#stats-prev'); await sleep(200);
    check(await text(page, '#stats-month') === '2025년' && (await text(page, '#stats-subjects')).includes('민성 +3,000,000'), '이전 해로 이동');
    await page.click('#stats-next'); await page.click('#stats-mode .seg-btn[data-mode="month"]'); await sleep(200);
    check(await text(page, '#stats-month') === '2026년 1월', '월 단위로 돌아오면 보던 달');
    await page.click('#nav-home'); await sleep(200);
    page.dialogReply = { accept: true };
    await page.click('.tx-del[data-del="t4"]'); await sleep(300);
    check(await text(page, '#home-expense') === '300,000' && await text(page, '#home-balance') === '2,000,000', '삭제 뒤 지출 300,000 · 잔액 2,000,000');
    check(await waitPush(server, 1000) && server.txs().length === 5, '삭제가 서버에 반영');
    await dev.close();
  });

  await run('S11 계정 이름의 HTML 이 실행되지 않는다 (XSS)', async check => {
    const evil = '<img src=x onerror="window.__xss=1">';
    const server = makeServer({ ...SEED, transactions: [T('x1', '2026-01-10', 'expense', evil, '-', 100)], custom: { income: [], expense: [evil] } });
    const dev = await newDevice(browser, base, server);
    const page = await dev.open({ fixedTime: JAN }); await appReady(page);
    await page.click('#nav-add'); await page.waitForSelector('#modal:not(.hidden)'); await page.click('.type-btn[data-t="expense"]'); await sleep(500);
    check(await page.evaluate(() => window.__xss) === undefined, '추가 창 계정 칩에서 실행되지 않음');
    check((await page.locator('#account-chips').innerHTML()).includes('&lt;img'), '계정 칩이 이스케이프됨');
    await page.click('#modal-close');
    await page.click('#nav-stats'); await sleep(500);
    check(await page.evaluate(() => window.__xss) === undefined, '통계 범례에서 실행되지 않음');
    check((await page.locator('#expense-legend').innerHTML()).includes('&lt;img'), '범례가 이스케이프됨');
    await dev.close();
  });

  await browser.close(); srv.close();
  const failed = results.filter(r => r.fails.length);
  console.log(`\n${results.length - failed.length}/${results.length} 통과`);
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(2); });
