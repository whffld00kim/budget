/* 시험용 가짜 Firebase (2026-10-12). test/run.js 가 www.gstatic.com 의 firebase-*-compat.js 요청을 가로채
   이 파일을 대신 내려준다. 실제 SDK 처럼 보이는 최소한의 compat API 만 흉내 낸다:
     firebase.initializeApp / firebase.auth() / firebase.database().ref().get|update|child|on
   데이터·연결 상태는 Node 쪽(run.js)이 들고 있고 window.__fakeDb(op, args) 바인딩으로 오간다.
   오프라인일 때 get()/update() 가 연결될 때까지 멈춰 있는 것(실제 SDK 10.x 동작)도 Node 쪽이 흉내 낸다. */
(function () {
  if (window.firebase) return;
  const authListeners = [];
  const connListeners = [];
  const call = (op, args) => window.__fakeDb(op, args || {});
  const snap = v => ({ val: () => (v === undefined ? null : v), exists: () => v != null });

  function makeRef(path) {
    return {
      path,
      child: p => makeRef(path ? path + '/' + p : p),
      get: () => call('get', { path }).then(snap),
      update: obj => call('update', { path, obj }),
      set: v => call('set', { path, v }),
      on: (ev, cb) => {
        if (path === '.info/connected') { connListeners.push(cb); call('connected').then(v => cb(snap(v))); }
      },
      off: () => {},
    };
  }

  window.__fakeConnected = v => connListeners.forEach(cb => cb(snap(v)));
  window.__fakeSetUser = u => authListeners.forEach(cb => cb(u));

  const auth = () => ({
    setPersistence: () => Promise.resolve(),
    onAuthStateChanged: cb => { authListeners.push(cb); call('user').then(u => cb(u)); },
    signInWithPopup: () => call('signin').then(u => window.__fakeSetUser(u)),
    signInWithRedirect: () => Promise.resolve(),
    signOut: () => call('signout').then(() => window.__fakeSetUser(null)),
  });
  auth.Auth = { Persistence: { LOCAL: 'local' } };
  auth.GoogleAuthProvider = class { setCustomParameters() {} };

  window.firebase = {
    initializeApp: () => {},
    auth,
    database: () => ({ ref: p => makeRef(p) }),
  };
})();
