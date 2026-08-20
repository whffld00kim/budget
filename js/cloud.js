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
============================================= */
(function () {
  'use strict';

  // 부부가계부와 같은 프로젝트. 가구 id = 가구장(김민성) uid — households/{hid} 컨벤션
  const HID = 'CH15y6HUQlSvJJLH95VWK4d0YHl1';

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

  let ref = null;          // /home-ledger/{hid}
  let uid = null;
  let baseUpdatedAt = 0;   // 마지막으로 내려받은 시점의 서버 updatedAt
  let pushTimer = null;
  let pushing = false;
  let ready = false;       // app.js 초기화까지 끝났는지

  /* ---------- 화면 ---------- */
  const $ = id => document.getElementById(id);
  function setStatus(msg) { const el = $('auth-status'); if (el) el.textContent = msg || ''; }
  function setError(msg)  { const el = $('auth-error');  if (el) el.textContent = msg || ''; }
  function showAuth()     { const el = $('auth-screen'); if (el) el.classList.remove('hidden'); }
  function hideAuth()     { const el = $('auth-screen'); if (el) el.classList.add('hidden'); }

  function note(msg) {
    // app.js의 toast를 쓰되, 아직 안 떠 있으면 콘솔로만
    if (typeof window.toast === 'function') window.toast(msg);
    else console.log('[cloud]', msg);
  }

  /* ---------- 내려받기 ---------- */
  async function pull() {
    const snap = await ref.get();
    const data = snap.val() || {};
    baseUpdatedAt = Number(data.updatedAt) || 0;

    const merged = {};
    for (const name of Object.keys(KEYS)) {
      const v = data[name];
      merged[name] = (v === undefined || v === null) ? DEFAULTS[name] : v;
    }
    // RTDB는 연속된 숫자 키를 배열로 돌려주지만, 중간이 비면 객체로 준다.
    // 배열이어야 하는 것들은 형태를 맞춰 준다.
    if (!Array.isArray(merged.transactions)) merged.transactions = Object.values(merged.transactions);
    if (!Array.isArray(merged.fixed))        merged.fixed        = Object.values(merged.fixed);

    return merged;
  }

  // localStorage 가로채기를 잠시 끄고 써넣는다 (내려받은 값을 되쏘면 무한루프)
  let muted = false;
  function writeLocal(data) {
    muted = true;
    try {
      for (const [name, key] of Object.entries(KEYS)) {
        localStorage.setItem(key, JSON.stringify(data[name]));
      }
    } finally { muted = false; }
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

  async function push() {
    if (!ref || !ready || pushing) return;
    pushing = true;
    try {
      // 다른 기기가 먼저 저장했는지 확인. 통째로 덮어쓰는 방식이라 이 확인이 필요하다.
      const remote = Number((await ref.child('updatedAt').get()).val()) || 0;
      if (remote > baseUpdatedAt) {
        note('다른 기기에서 변경됐습니다. 새로고침 후 다시 저장해 주세요.');
        return;
      }
      const now = Date.now();
      await ref.update({ ...readLocal(), version: 2, updatedAt: now, updatedBy: uid });
      baseUpdatedAt = now;
    } catch (e) {
      console.error('[cloud] push 실패', e);
      note('저장에 실패했습니다: ' + (e.code || e.message));
    } finally { pushing = false; }
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, PUSH_DEBOUNCE_MS);
  }

  // app.js의 save* 함수 전부가 결국 localStorage.setItem을 부른다.
  // 함수 하나하나를 감싸는 대신 여기 한 곳만 가로채면 불러오기(restoreData)까지 다 잡힌다.
  const _setItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) {
    _setItem(k, v);
    if (!muted && ready && WATCH.has(k)) schedulePush();
  };

  /* ---------- 앱 시작 ---------- */
  async function start() {
    setStatus('데이터를 불러오는 중…');
    const data = await pull();
    writeLocal(data);

    // app.js가 노출해 둔 초기화 함수. 없으면 앱 자체가 안 뜬 것이니 알린다.
    if (typeof window.__initApp !== 'function') {
      setError('앱 초기화 함수를 찾지 못했습니다 (app.js 확인 필요)');
      return;
    }
    window.__initApp();
    ready = true;
    hideAuth();
    setStatus('');

    const n = Array.isArray(data.transactions) ? data.transactions.length : 0;
    console.log(`[cloud] ${n}건 불러옴 (updatedAt=${baseUpdatedAt || '없음'})`);
  }

  // 포커스가 돌아올 때 다시 내려받는다. 실시간 구독(on('value'))을 쓰지 않은 이유는,
  // 입력 도중 원격 값이 들어와 화면을 덮어쓰는 사고를 막기 위해서다.
  async function refresh() {
    if (!ready || pushTimer) return;   // 저장 대기 중이면 건드리지 않는다
    try {
      const remote = Number((await ref.child('updatedAt').get()).val()) || 0;
      if (remote <= baseUpdatedAt) return;
      const data = await pull();
      writeLocal(data);
      window.__initApp();
      note('다른 기기의 변경을 반영했습니다.');
    } catch (e) { console.warn('[cloud] refresh 건너뜀', e); }
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

    auth.onAuthStateChanged(async user => {
      if (!user) { uid = null; ready = false; showAuth(); setStatus(''); return; }
      uid = user.uid;
      ref = firebase.database().ref('home-ledger/' + HID);
      try {
        await start();
      } catch (e) {
        setStatus('');
        // 규칙에 걸리면 permission_denied. 가구 멤버가 아닌 계정으로 들어온 경우다.
        if (String(e.message || '').toLowerCase().includes('permission')) {
          setError(`이 계정은 가계부에 접근 권한이 없습니다.\n로그인한 계정: ${user.email}\nuid: ${user.uid}`);
        } else {
          setError('데이터를 불러오지 못했습니다: ' + (e.code || e.message));
        }
        await auth.signOut();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });

    // 로그아웃 (설정 대신 홈 화면 하단 버튼에 붙는다)
    const out = $('btn-signout');
    if (out) out.addEventListener('click', async () => {
      if (pushTimer) { clearTimeout(pushTimer); await push(); }   // 대기 중 저장은 먼저 올린다
      await auth.signOut();
      location.reload();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }

  // 디버깅·수동 조작용
  window.Cloud = { pull, push, refresh, get uid() { return uid; }, get hid() { return HID; } };
})();
