/* =============================================
   구글 로그인 + Firebase 동기화 (2026-08-20 추가)

   그전까지 이 앱은 4자리 PIN이 js/app.js에 하드코딩돼 있었고, 데이터는
   브라우저 localStorage에만 있었다. PIN은 공개 저장소에서 그냥 보였고, 데이터가
   기기 안에만 있어서 볼트(LifeOS) 동기화가 아예 불가능했다. 둘을 함께 고친 것이다.

   ── 구조 ──────────────────────────────────────
   Firebase 프로젝트는 부부가계부·민성스케줄·Book Tracker와 같은 `minsung-buboo2`다.
   RTDB 경로만 다르다:  /home-ledger/{hid}

   접근 통제는 RTDB 규칙이 한다 (minsung-buboo2/database.rules.json):
     households/{hid}/members/{auth.uid} == true 인 사람만 읽고 쓴다.
   즉 부부가계부의 가구 멤버십을 그대로 쓴다 — 따로 허용목록을 두지 않는다.
   아래 firebaseConfig는 공개돼도 되는 값이다 (실제 통제는 규칙이 한다).

   ── 동기화 방식 ────────────────────────────────
   app.js는 손대지 않고 감싸는 쪽을 택했다. app.js가 6개 localStorage 키를 동기적으로
   읽고 쓰는 구조라, 그걸 전부 async로 바꾸면 71KB를 다 뜯어야 한다. 그래서:

     내려받기 : 로그인 성공 → RTDB 한 번 읽어 6개 키에 써넣음 → app.js 초기화 호출
     올려보내기: localStorage.setItem 을 가로채서, 감시 대상 키가 바뀌면 1.5초 디바운스 후 push

   ⚠ 문서 전체를 통째로 덮어쓰는 방식이다(last-write-wins). 두 사람이 동시에 고치면
     나중 저장이 이긴다. 그래서 다른 기기가 먼저 저장한 흔적(updatedAt)이 보이면
     조용히 덮지 않고 토스트로 알린다. 필드 단위 병합으로 바꾸려면 app.js의 저장
     함수들을 갈라야 하므로, 부부 둘이 쓰는 규모에서는 여기까지가 적정선이라 판단했다.

   ── 못 올린 변경 (2026-10-12) ──────────────────
   올리지 못한 변경이 이 기기에 남아 있는지(dirty)와 마지막으로 서버와 맞춘 시점(base)을
   localStorage 의 gaegybu_cloud_meta 에 적어 둔다. 가계부 데이터가 아니라 동기화 메모라서
   PC 동기화 스크립트가 읽는 /home-ledger 모양과는 무관하다. 이걸로:
     · 오프라인에서 입력하고 앱이 꺼져도, 다음에 열 때 서버가 그대로면 올리고 아니면 알린다
     · 서버를 못 읽으면(오프라인) 저장된 사본으로 열고, 연결되면 맞춘다
     · 로그아웃·새로고침으로 못 올린 변경이 조용히 사라지지 않는다
   그전엔 저장이 실패하면 토스트 한 번 뒤 아무 일도 없었고, 다음에 열 때 서버 값이 로컬을 덮었다.
============================================= */
(function () {
  'use strict';

  // 가구 id는 코드에 두지 않는다 (2026-09-02). 로그인한 계정의 users/{uid}/householdId 에서
  // 읽는다 — 부부가계부가 가입 때 써두는 값이다. 공개 저장소에 가구 id가 박혀 있으면
  // 규칙의 빈틈과 합쳐져 남이 그 가구에 들어올 재료가 된다.
  let HID = null;

  const firebaseConfig = {
    apiKey: 'AIzaSyAPXiob8XeDunXpDMsLod_TwClqg2JL260',
    authDomain: 'minsung-buboo2.firebaseapp.com',
    databaseURL: 'https://minsung-buboo2-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'minsung-buboo2',
    storageBucket: 'minsung-buboo2.firebasestorage.app',
    messagingSenderId: '318424534715',
    appId: '1:318424534715:web:50a3b43ea5c5325ee5239e'
  };

  // app.js의 STORAGE_* 상수와 한 글자도 달라선 안 된다.
  // app.js 쪽 상수 이름을 바꾸면 여기도 같이 바꿀 것.
  const KEYS = {
    transactions: 'gaegybu_final_tx_v3',
    custom:       'gaegybu_final_custom_v3',
    fixed:        'gaegybu_final_fixed_v1',
    irregular:    'gaegybu_irregular_v1',
    deduct:       'gaegybu_deduct_v1',
    living:       'gaegybu_living_v1',
  };

  // 동기화 메모 (2026-10-12). { base: 마지막으로 맞춘 서버 updatedAt, dirty: 못 올린 변경이 있는지,
  //   hid: 가구 id } — hid 는 오프라인으로 열 때 쓴다 (users/{uid}/householdId 도 연결될 때까지 못 읽는다)
  const META_KEY = 'gaegybu_cloud_meta';

  // RTDB는 빈 배열·빈 객체·null을 저장하지 않고 키째로 지운다.
  // 그래서 내려받을 때 없는 필드는 이 기본값으로 되살린다.
  const DEFAULTS = {
    transactions: [],
    custom:       { income: [], expense: [] },
    fixed:        [],
    irregular:    { categories: [], entries: [] },
    deduct:       { accounts: [] },
    living:       { accounts: [], cards: [] },
  };

  const WATCH = new Set(Object.values(KEYS));
  const PUSH_DEBOUNCE_MS = 1500;
  const PULL_TIMEOUT_MS  = 8000;   // 이만큼 서버를 못 읽으면 저장된 사본으로 연다 (get()은 연결될 때까지 멈춰 있다)

  let ref = null;          // /home-ledger/{hid}
  let uid = null;
  let baseUpdatedAt = 0;   // 마지막으로 내려받은(또는 올린) 시점의 서버 updatedAt
  let pushTimer = null;
  let pushing = false;
  let refreshing = false;
  let ready = false;       // app.js 초기화까지 끝났는지
  let dirty = false;       // 올리지 못한 로컬 변경이 있는지
  let connected = false;   // RTDB 실시간 연결 (.info/connected)

  const _setItem = localStorage.setItem.bind(localStorage);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- 화면 ---------- */
  const $ = id => document.getElementById(id);
  function setStatus(msg) { const el = $('auth-status'); if (el) el.textContent = msg || ''; }
  function setError(msg)  { const el = $('auth-error');  if (el) el.textContent = msg || ''; }
  function showAuth()     { const el = $('auth-screen'); if (el) el.classList.remove('hidden'); }
  function hideAuth()     { const el = $('auth-screen'); if (el) el.classList.add('hidden'); }
  // 로그인했던 기기 표시 — index.html의 인라인 스크립트가 읽어 로그인 버튼을 감춘다 (2026-09-29)
  function markSignedIn(on) {
    try { on ? _setItem('signed_in_before', '1') : localStorage.removeItem('signed_in_before'); } catch {}
    if (!on) { const el = $('auth-screen'); if (el) el.classList.remove('resuming'); }
  }

  function note(msg, ms) {
    // app.js의 toast를 쓰되, 아직 안 떠 있으면 콘솔로만. 동기화 안내는 기본(2초)보다 길게 보여 준다
    if (typeof window.toast === 'function') window.toast(msg, ms);
    else console.log('[cloud]', msg);
  }

  /* ---------- 동기화 메모 ---------- */
  function readMeta() {
    try { const m = JSON.parse(localStorage.getItem(META_KEY)); return (m && typeof m === 'object') ? m : {}; }
    catch { return {}; }
  }
  function writeMeta(patch) {
    try { _setItem(META_KEY, JSON.stringify({ ...readMeta(), ...patch })); } catch {}
  }
  // 6개 키가 모두 있어야 "서버 사본이 있는 상태"다. 하나라도 없으면 브라우저가 저장소를 비운 것이고,
  // 그 상태로 올리면 빈 값이 서버를 덮는다.
  function hasLocal() {
    try { return Object.values(KEYS).every(k => localStorage.getItem(k) !== null); } catch { return false; }
  }

  /* ---------- 내려받기 ---------- */
  // 배열이어야 하는 자리를 배열로. RTDB는 연속된 숫자 키를 배열로 돌려주지만 중간이 비면 객체로 주고,
  // 빈 배열은 아예 지워 버린다.
  const arr = v => (v == null) ? [] : (Array.isArray(v) ? v : Object.values(v));
  const withItems = a => ({ ...(a || {}), items: arr(a && a.items) });

  async function pull() {
    const snap = await ref.get();
    const data = snap.val() || {};

    const doc = {};
    for (const name of Object.keys(KEYS)) {
      const v = data[name];
      doc[name] = (v === undefined || v === null) ? DEFAULTS[name] : v;
    }
    doc.transactions = arr(doc.transactions);
    doc.fixed        = arr(doc.fixed);
    // 안쪽의 빈 배열도 되살린다 (2026-10-12): custom.income이 비면 키가 사라져 추가 창이 못 열렸고,
    // 항목 없는 통장은 items가 사라져 이체 탭이 죽었다. 모양만 맞추고 값은 그대로다.
    doc.custom    = { ...doc.custom,    income: arr(doc.custom.income), expense: arr(doc.custom.expense) };
    doc.irregular = { ...doc.irregular, categories: arr(doc.irregular.categories), entries: arr(doc.irregular.entries) };
    doc.deduct    = { ...doc.deduct,    accounts: arr(doc.deduct.accounts).map(withItems) };
    doc.living    = { ...doc.living,    accounts: arr(doc.living.accounts).map(withItems), cards: arr(doc.living.cards) };

    return { doc, updatedAt: Number(data.updatedAt) || 0, updatedBy: data.updatedBy || null };
  }

  // localStorage 가로채기를 잠시 끄고 써넣는다 (내려받은 값을 되쏘면 무한루프)
  let muted = false;
  function writeLocal(doc) {
    muted = true;
    try {
      for (const [name, key] of Object.entries(KEYS)) {
        _setItem(key, JSON.stringify(doc[name]));
      }
    } finally { muted = false; }
  }

  // 내려받은 문서를 이 기기의 사본으로 삼고 화면을 그린다
  function applyPulled(p) {
    writeLocal(p.doc);
    baseUpdatedAt = p.updatedAt;
    dirty = false;
    writeMeta({ base: p.updatedAt, dirty: false });
    window.__initApp();
  }

  /* ---------- 올려보내기 ---------- */
  function readLocal() {
    const out = {};
    for (const [name, key] of Object.entries(KEYS)) {
      try { out[name] = JSON.parse(localStorage.getItem(key)) ?? DEFAULTS[name]; }
      catch (e) { out[name] = DEFAULTS[name]; }
    }
    return out;
  }

  // 올리기. 성공하면 true. 실패·충돌이면 false 이고 dirty 는 그대로 남아, 연결이 돌아오거나
  // 탭에 돌아오거나 다음에 열 때 다시 시도한다.
  async function push() {
    if (!ref || !ready || pushing) return false;
    if (!hasLocal()) {
      // 브라우저가 저장소를 비웠다. 지금 올리면 빈 값이 서버를 덮으니 멈춘다
      ready = false;
      note('이 기기의 저장 공간이 비워져 저장을 멈췄습니다. 새로고침해 주세요.', 8000);
      return false;
    }
    if (!connected) return false;   // 연결되면 .info/connected 가 다시 부른다
    pushing = true;
    let ok = false;
    try {
      // 다른 기기가 먼저 저장했는지 확인. 통째로 덮어쓰는 방식이라 이 확인이 필요하다.
      const remote = Number((await ref.child('updatedAt').get()).val()) || 0;
      if (remote > baseUpdatedAt) {
        note('다른 기기에서 변경됐습니다. 새로고침 후 다시 저장해 주세요.', 6000);
        return false;
      }
      // 확인하는 사이 끊겼으면 쓰기를 줄 세우지 않는다 — 줄 선 쓰기는 재연결 때 확인 없이 나가서
      // 그 사이 다른 기기가 저장한 걸 덮는다
      if (!connected) return false;
      const now = Date.now();
      dirty = false;                       // 이 뒤에 바뀐 건 보내는 동안 다시 dirty 가 된다
      const doc = readLocal();
      await ref.update({ ...doc, version: 2, updatedAt: now, updatedBy: uid });
      baseUpdatedAt = now;
      writeMeta({ base: now, dirty });
      ok = true;
      return true;
    } catch (e) {
      dirty = true;
      console.error('[cloud] push 실패', e);
      note('저장에 실패했습니다: ' + (e.code || e.message) + '\n연결되면 다시 올립니다.', 5000);
      return false;
    } finally {
      pushing = false;
      // 보내는 동안 또 바뀌었으면 한 번 더. 실패·충돌했을 땐 되풀이하지 않는다 — 재연결·탭 복귀·다음 입력이 다시 부른다
      if (ok && ready && dirty && !pushTimer) schedulePush();
    }
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushTimer = null; push(); }, PUSH_DEBOUNCE_MS);
  }

  // app.js의 save* 함수 전부가 결국 localStorage.setItem을 부른다.
  // 함수 하나하나를 감싸는 대신 여기 한 곳만 가로채면 불러오기(restoreData)까지 다 잡힌다.
  localStorage.setItem = function (k, v) {
    _setItem(k, v);
    if (!muted && ready && WATCH.has(k)) {
      dirty = true;
      writeMeta({ dirty: true });
      schedulePush();
    }
  };

  /* ---------- 앱 시작 ---------- */
  function finishStart() {
    ready = true;
    hideAuth();
    setStatus('');
  }

  // 서버를 읽었을 때. 이 기기에 못 올린 변경이 남아 있으면 서버가 그대로인지부터 본다.
  function startWithServer(p) {
    const meta = readMeta();
    if (meta.dirty && hasLocal()) {
      const base = Number(meta.base) || 0;
      if (p.updatedAt <= base) {
        // 그 뒤로 아무도 안 썼다 → 이 기기 사본(= 그때 서버 + 못 올린 변경)으로 열고 올린다
        baseUpdatedAt = p.updatedAt;
        dirty = true;
        writeMeta({ base: p.updatedAt, dirty: true });
        window.__initApp();
        finishStart();
        note('지난번에 올리지 못한 변경을 저장합니다.', 4000);
        schedulePush();
        return;
      }
      // 다른 기기가 먼저 저장했다 → 병합하지 않고(2026-09-03 결정) 서버 사본으로 바꾸되, 조용히 하지 않는다
      applyPulled(p);
      finishStart();
      note('이 기기에 저장되지 않은 변경이 있었지만 다른 기기가 먼저 저장해 반영하지 못했습니다.\n다시 입력해 주세요.', 8000);
      return;
    }
    applyPulled(p);
    finishStart();
  }

  // 서버를 못 읽을 때(오프라인). 저장된 사본으로 열고, 연결되면 .info/connected 가 맞춘다.
  function startFromCache() {
    const meta = readMeta();
    baseUpdatedAt = Number(meta.base) || 0;
    dirty = !!meta.dirty;
    try { window.__initApp(); }
    catch (e) { clearLocal(); throw e; }   // 사본이 깨졌으면 지운다 — 다음엔 서버에서 새로 받는다
    finishStart();
    note('서버에 연결되지 않아 저장된 사본으로 엽니다. 연결되면 자동으로 맞춥니다.', 5000);
  }

  // 가구 id를 읽고 문서를 내려받는다. 둘 다 연결될 때까지 멈춰 있을 수 있다
  async function load() {
    const hidSnap = await firebase.database().ref('users/' + uid + '/householdId').get();
    const hid = hidSnap.val();
    if (!hid) throw new Error('no-household');
    HID = hid;
    ref = firebase.database().ref('home-ledger/' + HID);
    const p = await pull();
    writeMeta({ hid: HID });
    return p;
  }

  async function start() {
    // app.js가 노출해 둔 초기화 함수. 없으면 앱 자체가 안 뜬 것이니 알린다.
    if (typeof window.__initApp !== 'function') {
      setError('앱 초기화 함수를 찾지 못했습니다 (app.js 확인 필요)');
      return;
    }
    setStatus('데이터를 불러오는 중…');
    const loading = load();
    loading.catch(() => {});
    // 오프라인이면 기다리지 않고, 아니면 PULL_TIMEOUT_MS 까지만 기다린다
    const waitMs = navigator.onLine === false ? 0 : PULL_TIMEOUT_MS;
    const first = await Promise.race([loading.then(p => ({ p })), sleep(waitMs).then(() => ({}))]);
    if (first.p) { startWithServer(first.p); return; }

    const meta = readMeta();
    if (!hasLocal() || !meta.hid) {
      // 보여 줄 사본이 없다 — 연결될 때까지 기다린다
      setStatus('서버에 연결하는 중… 연결되면 자동으로 열립니다');
      startWithServer(await loading);
      return;
    }
    HID = meta.hid;
    ref = firebase.database().ref('home-ledger/' + HID);
    startFromCache();
    // 늦게라도 읽히면 (느린 연결) 그걸로 맞춘다
    loading.then(() => { if (dirty) { if (!pushTimer) push(); } else refresh(); }).catch(() => {});
  }

  // 포커스가 돌아올 때 다시 내려받는다. 실시간 구독(on('value'))을 쓰지 않은 이유는,
  // 입력 도중 원격 값이 들어와 화면을 덮어쓰는 사고를 막기 위해서다.
  async function refresh() {
    if (!ready || pushTimer || pushing || refreshing) return;   // 저장 대기 중이면 건드리지 않는다
    if (dirty) { push(); return; }     // 못 올린 변경이 있으면 내려받지 않고 올린다 (push 가 서버와 비교해 알린다)
    if (!connected) return;
    refreshing = true;
    try {
      const remote = Number((await ref.child('updatedAt').get()).val()) || 0;
      if (remote <= baseUpdatedAt) return;
      const p = await pull();
      if (dirty || pushTimer) return;  // 내려받는 사이 편집이 시작됐으면 덮지 않는다
      applyPulled(p);
      note('다른 기기의 변경을 반영했습니다.');
    } catch (e) { console.warn('[cloud] refresh 건너뜀', e); }
    finally { refreshing = false; }
  }

  /* ---------- 로그인 ---------- */
  function initAuth() {
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    $('btn-google').addEventListener('click', async () => {
      setError(''); setStatus('구글 로그인 창을 여는 중…');
      try {
        await auth.signInWithPopup(provider);
      } catch (e) {
        // 홈화면에 추가한 PWA·인앱 브라우저에서는 팝업이 막힌다 → 리다이렉트로 대체
        if (['auth/popup-blocked', 'auth/popup-closed-by-user',
             'auth/cancelled-popup-request', 'auth/operation-not-supported-in-this-environment']
             .includes(e.code)) {
          try { await auth.signInWithRedirect(provider); return; } catch (e2) { e = e2; }
        }
        setStatus('');
        if (e.code === 'auth/operation-not-allowed') {
          setError('구글 로그인이 아직 켜져 있지 않습니다. Firebase 콘솔 → Authentication → Sign-in method 에서 Google을 사용 설정해 주세요.');
        } else if (e.code === 'auth/unauthorized-domain') {
          setError('이 도메인이 승인되지 않았습니다. Firebase 콘솔 → Authentication → Settings → 승인된 도메인에 추가해 주세요.');
        } else {
          setError('로그인 실패: ' + (e.code || e.message));
        }
      }
    });

    // 실시간 연결 상태. 끊겼다 이어지면 못 올린 변경을 올리거나, 없으면 서버 변경을 받아온다
    firebase.database().ref('.info/connected').on('value', snap => {
      connected = snap.val() === true;
      if (!connected || !ready) return;
      if (dirty) { if (!pushTimer) push(); }
      else refresh();
    });

    auth.onAuthStateChanged(async user => {
      if (!user) { uid = null; ready = false; markSignedIn(false); showAuth(); setStatus(''); return; }
      uid = user.uid;
      try {
        await start();
        markSignedIn(true);
      } catch (e) {
        setStatus('');
        // 규칙에 걸리면 permission_denied. 가구 멤버가 아닌 계정으로 들어온 경우다.
        if (e.message === 'no-household') {
          setError(`이 계정은 어느 가구에도 속해 있지 않습니다.\n부부가계부 앱에서 초대코드로 먼저 참여해 주세요.\n로그인한 계정: ${user.email}`);
          clearLocal();
          await auth.signOut();
        } else if (String(e.message || '').toLowerCase().includes('permission')) {
          setError(`이 계정은 가계부에 접근 권한이 없습니다.\n로그인한 계정: ${user.email}\nuid: ${user.uid}`);
          clearLocal();
          await auth.signOut();
        } else {
          // 그 밖의 오류(일시적인 서버·네트워크 문제)로는 캐시를 지우거나 로그아웃하지 않는다 (2026-10-12).
          // 그전엔 어떤 오류든 로그아웃 + 캐시 삭제였다
          setError('데이터를 불러오지 못했습니다: ' + (e.code || e.message) + '\n연결을 확인한 뒤 다시 열어 주세요.');
        }
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });

    // 로그아웃 (설정 대신 홈 화면 하단 버튼에 붙는다)
    const out = $('btn-signout');
    if (out) out.addEventListener('click', async () => {
      if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
      if (dirty) await push();   // 대기 중 저장은 먼저 올린다
      if (dirty || pushing) {
        // 그래도 못 올렸으면(오프라인·충돌) 지우기 전에 묻는다 — 그전엔 묻지 않고 지웠다 (2026-10-12)
        if (!confirm('아직 서버에 저장되지 않은 변경이 있습니다.\n로그아웃하면 이 기기의 변경이 사라집니다. 그래도 로그아웃할까요?')) return;
      }
      ready = false;
      await auth.signOut();
      clearLocal();
      location.reload();
    });
  }

  // 로그아웃·접근 거부 때 이 기기의 가계부 캐시를 지운다 (S12, 2026-09-03).
  // 안 지우면 다음 사람이 같은 브라우저에서 로그인 화면 뒤의 localStorage를 볼 수 있다.
  // ⚠ push()가 끝난 뒤에만 부를 것 — 올리기 전에 지우면 마지막 편집이 사라진다.
  function clearLocal() {
    for (const key of [...Object.values(KEYS), META_KEY]) {
      try { localStorage.removeItem(key); } catch {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }

  // 디버깅·수동 조작용
  window.Cloud = { pull, push, refresh, get uid() { return uid; }, get hid() { return HID; }, get dirty() { return dirty; } };
})();
