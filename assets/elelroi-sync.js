/* Elelroi Mental Wellness — cross-device sync client.
 * Talks to the Cloudflare Worker (shared store) with localStorage as an offline cache,
 * so the passcode, recovery question, contact details, flyers, content and bookings
 * are the SAME on every device. If the Worker is unreachable, reads fall back to the
 * local cache and the admin can still work offline on this device. */
(function () {
  var API = 'https://elelroi-sync.elelroi.workers.dev';
  var P = 'elelroi_';
  var _pass = null; // current admin passcode (set after login) — authorises writes

  function lput(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} }
  function lget(k) { try { var v = localStorage.getItem(P + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

  function api(path, body) {
    return fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  // reads: Worker first (and refresh the cache), else the local cache
  function get(key) {
    return api('/get', { key: key }).then(function (r) {
      if (r && Object.prototype.hasOwnProperty.call(r, 'value')) {
        if (r.value != null) lput(key, r.value);
        return r.value != null ? r.value : lget(key);
      }
      return lget(key);
    }).catch(function () { return lget(key); });
  }
  // writes: Worker (passcode-gated) + local cache
  function set(key, value) {
    lput(key, value);
    return api('/set', { pass: _pass, key: key, value: value }).then(function (r) { return !!(r && r.ok); }).catch(function () { return false; });
  }

  function applyContactIds(c) {
    if (!c) return;
    var fe = document.getElementById('footEmail');
    if (fe && c.email) { fe.textContent = '✉ ' + c.email; fe.setAttribute('href', 'mailto:' + c.email); }
    var fp = document.getElementById('footPhone');
    if (fp && c.phone) { fp.textContent = '📞 ' + c.phone; fp.setAttribute('href', 'tel:' + c.phone.replace(/[^0-9+]/g, '')); }
    var cb = document.getElementById('callBtn');
    if (cb && c.phone) { cb.textContent = 'Call ' + c.phone; if (cb.getAttribute('href') && cb.getAttribute('href').indexOf('tel:') === 0) cb.setAttribute('href', 'tel:' + c.phone.replace(/[^0-9+]/g, '')); }
  }

  window.ElelroiSync = {
    url: API, api: api,
    /* auth (cross-device) */
    setPasscode: function (p) { _pass = p; },
    login: function (pass) { return api('/login', { pass: pass }); },               // -> {ok:bool}
    changePass: function (oldp, newp) { return api('/setpass', { old: oldp, new: newp }); }, // -> {ok} / {error}
    recoveryQuestion: function () { return api('/recovery/question', {}).then(function (r) { return r && r.question ? r.question : null; }).catch(function () { return null; }); },
    recoverySet: function (q, ans) { return api('/recovery/set', { pass: _pass, question: q, answer: ans }); },
    recoveryReset: function (ans, newp) { return api('/recovery/reset', { answer: ans, new: newp }); },
    /* shared key/value content */
    get: get, set: set,
    getConfig: function () { return get('config'); },
    setConfig: function (v) { return set('config', v); },
    getImages: function () { return get('images'); },
    setImages: function (v) { return set('images', v); },
    /* bookings (public add, passcode-gated list) */
    addBooking: function (obj) { var a = lget('bookings') || []; a.push(obj); lput('bookings', a); return api('/bookings/add', { data: obj }).then(function (r) { return !!(r && r.ok); }).catch(function () { return false; }); },
    getBookings: function () { return api('/bookings/list', { pass: _pass }).then(function (r) { return (r && r.rows) || lget('bookings') || []; }).catch(function () { return lget('bookings') || []; }); },
    setBookings: function (v) { lput('bookings', v); return Promise.resolve(true); },
    clearBookings: function () { return api('/bookings/clear', { pass: _pass }).then(function (r) { return !!(r && r.ok); }).catch(function () { return false; }); },
    uploadPhoto: function (path, file) { return new Promise(function (resolve) { try { var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.onerror = function () { resolve(null); }; r.readAsDataURL(file); } catch (e) { resolve(null); } }); },
    applyContactIds: applyContactIds
  };
})();
