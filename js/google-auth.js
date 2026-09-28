/* Google Sign-In (Google Identity Services) for IEPM Ticket System.
   Get a Web OAuth Client ID: Google Cloud Console -> APIs & Services -> Credentials.
   Configure via GOOGLE_CLIENT_ID env (server), window.IEPM_GOOGLE_CLIENT_ID,
   <meta name="google-signin-client_id">, or the in-app setup dialog (localStorage). */
(function () {
  'use strict';
  var LS_KEY = 'iepm_google_client_id';
  var GIS_SRC = 'https://accounts.google.com/gsi/client';
  var cachedId = '';
  var gisPromise = null;

  function currentClientId() {
    if (cachedId) return cachedId;
    if (window.IEPM_GOOGLE_CLIENT_ID && String(window.IEPM_GOOGLE_CLIENT_ID).indexOf('YOUR_') !== 0)
      return (cachedId = String(window.IEPM_GOOGLE_CLIENT_ID).trim());
    var m = document.querySelector('meta[name="google-signin-client_id"]');
    if (m && m.content && m.content.indexOf('YOUR_') !== 0 && m.content.trim())
      return (cachedId = m.content.trim());
    try {
      var v = localStorage.getItem(LS_KEY);
      if (v && v.trim()) return (cachedId = v.trim());
    } catch (e) { /* storage unavailable */ }
    return '';
  }

  // Auto-discover the server-configured Client ID (GOOGLE_CLIENT_ID env).
  function fetchServerId() {
    if (window.location.protocol === 'file:') return;
    fetch('/api/config').then(function (r) { return r.json(); }).then(function (cfg) {
      if (cfg && cfg.googleClientId) cachedId = String(cfg.googleClientId).trim();
    }).catch(function () { /* offline or no server - local config still works */ });
  }

  function loadGIS() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise(function (resolve, reject) {
      var ready = function () { return !!(window.google && google.accounts && google.accounts.oauth2); };
      var done = function () {
        if (ready()) resolve();
        else reject(new Error('Google Identity Services unavailable'));
      };
      var s = document.querySelector('script[src="' + GIS_SRC + '"]');
      if (s) { s.addEventListener('load', done); setTimeout(done, 8000); return; }
      s = document.createElement('script');
      s.src = GIS_SRC; s.async = true; s.defer = true;
      s.onload = done;
      s.onerror = function () { reject(new Error('Could not load Google (offline?)')); };
      document.head.appendChild(s);
      setTimeout(function () { if (!ready()) reject(new Error('Google load timeout')); }, 15000);
    });
    return gisPromise;
  }

  function toastSafe(m) { try { toast(m); } catch (e) { alert(m); } }

  async function verifyOnServer(idToken, profile) {
    if (window.location.protocol === 'file:') return null;
    try {
      var r = await fetch('/api/auth/google', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: idToken || null, profile: profile || null })
      });
      var d = await r.json().catch(function () { return null; });
      return (d && d.ok && d.user) ? d.user : null;
    } catch (e) { return null; }
  }

  async function loginOrCreate(profile) {
    var email = String(profile.email || '').trim().toLowerCase();
    if (!email) { toastSafe('Google did not return an email address.'); return; }
    var u = DB.users.find(function (x) { return String(x.email || '').toLowerCase() === email; });
    if (!u && profile.sub) u = DB.users.find(function (x) { return x.googleId === profile.sub; });
    if (!u) {
      u = {
        id: uid('u'), name: profile.name || email.split('@')[0], email: email,
        pass: await hashPw('google-' + (profile.sub || email) + '-' + Date.now()),
        role: DB.users.length ? 'employee' : 'admin',
        dept: 'IT', phone: '', location: 'Head Office',
        googleId: profile.sub || '', avatar: profile.picture || ''
      };
      DB.users.push(u);
      audit('Google sign-up: ' + u.name + ' (' + u.email + ')');
      if (typeof notify === 'function') notify(u.id, 'Welcome, ' + u.name.split(' ')[0] + '!');
    } else {
      if (profile.sub && !u.googleId) u.googleId = profile.sub;
      if (profile.picture && !u.avatar) u.avatar = profile.picture;
      audit(u.name + ' signed in with Google');
    }
    try { clearFails(email); } catch (e) { /* no lockout helper */ }
    DB.session = u.id; DB.sessionAt = Date.now(); save(); boot();
    toastSafe('Welcome, ' + u.name);
  }

  async function fetchProfile(accessToken) {
    try {
      var r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + accessToken }
      });
      if (!r.ok) throw new Error('profile');
      var p = await r.json();
      var verified = await verifyOnServer(null, p);
      loginOrCreate(verified || p);
    } catch (e) { toastSafe('Could not read Google profile. Try again.'); }
  }

  function signInWithGoogle() {
    var id = currentClientId();
    if (!id) { openGoogleSetup(); return; }
    toastSafe('Connecting to Google...');
    loadGIS().then(function () {
      var client = google.accounts.oauth2.initTokenClient({
        client_id: id, scope: 'openid email profile',
        callback: function (resp) {
          if (resp && resp.access_token) fetchProfile(resp.access_token);
          else toastSafe('Google sign-in was cancelled.');
        }
      });
      client.requestAccessToken();
    }).catch(function (err) { toastSafe(err.message || 'Google unavailable'); });
  }

  function openGoogleSetup() {
    openModal('<h2>Connect Google sign-in</h2>' +
      '<p style="color:var(--muted);font-size:13px">Paste your Google <b>Web OAuth Client ID</b> ' +
      '(Google Cloud Console &rarr; APIs &amp; Services &rarr; Credentials). ' +
      'Or set <code>GOOGLE_CLIENT_ID</code> on the server.</p>' +
      '<div class="field"><label for="gId">Google Client ID</label>' +
      '<input id="gId" placeholder="xxxxx.apps.googleusercontent.com"></div>' +
      '<button class="btn btn-primary btn-block" onclick="saveGoogleClientId()">Save &amp; enable Google</button>');
  }

  function saveGoogleClientId() {
    var v = (document.getElementById('gId').value || '').trim();
    if (!/\.apps\.googleusercontent\.com$/.test(v)) { toastSafe('That does not look like a Client ID.'); return; }
    try { localStorage.setItem(LS_KEY, v); } catch (e) { /* ignore */ }
    cachedId = v; closeModal(); toastSafe('Google connected - click Google again to sign in.');
  }

  // Rewire the placeholder Google buttons every time the auth screen renders.
  function wireGoogleButtons() {
    document.querySelectorAll('.sso-google').forEach(function (b) {
      b.onclick = function (e) { e.preventDefault(); signInWithGoogle(); };
    });
  }

  var _renderAuth = renderAuth;
  renderAuth = function (mode) { _renderAuth(mode); wireGoogleButtons(); };
  var _logout = logout;
  logout = function () {
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); }
    catch (e) { /* ignore */ }
    _logout();
  };

  window.signInWithGoogle = signInWithGoogle;
  window.saveGoogleClientId = saveGoogleClientId;
  window.openGoogleSetup = openGoogleSetup;

  fetchServerId();
  wireGoogleButtons();
})();
