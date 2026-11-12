/* Elelroi Mental Wellness — standalone local content store (no external backend).
   Mirrors the original sync API but persists to THIS browser's localStorage only,
   so the admin works without any server and never touches another site's data. */
(function () {
  var P = 'elelroi_';
  function get(key) {
    return Promise.resolve().then(function () {
      try { var v = localStorage.getItem(P + key); return v ? JSON.parse(v) : null; }
      catch (e) { return null; }
    });
  }
  function set(key, value) {
    return Promise.resolve().then(function () {
      try { localStorage.setItem(P + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    });
  }
  function applyContactIds(c) {
    if (!c) return;
    var fe = document.getElementById('footEmail');
    if (fe && c.email) { fe.textContent = '\u2709 ' + c.email; fe.setAttribute('href', 'mailto:' + c.email); }
    var fp = document.getElementById('footPhone');
    if (fp && c.phone) { fp.textContent = '\uD83D\uDCDE ' + c.phone; fp.setAttribute('href', 'tel:' + c.phone.replace(/[^0-9+]/g, '')); }
    var cb = document.getElementById('callBtn');
    if (cb && c.phone) { cb.textContent = 'Call ' + c.phone; if (cb.getAttribute('href') && cb.getAttribute('href').indexOf('tel:') === 0) cb.setAttribute('href', 'tel:' + c.phone.replace(/[^0-9+]/g, '')); }
  }
  function uploadPhoto(path, file) {
    // Store the chosen image as a data URL so it persists locally for this browser.
    return new Promise(function (resolve) {
      try { var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.onerror = function () { resolve(null); }; r.readAsDataURL(file); }
      catch (e) { resolve(null); }
    });
  }
  function addBooking(obj) {
    return get('bookings').then(function (arr) {
      arr = Array.isArray(arr) ? arr : [];
      arr.push(obj);
      return set('bookings', arr).then(function (ok) { return ok; });
    });
  }
  window.ElelroiSync = {
    url: '', get: get, set: set,
    getConfig: function () { return get('config'); },
    setConfig: function (v) { return set('config', v); },
    getImages: function () { return get('images'); },
    setImages: function (v) { return set('images', v); },
    uploadPhoto: uploadPhoto, addBooking: addBooking,
    getBookings: function () { return get('bookings'); },
    setBookings: function (v) { return set('bookings', v); },
    applyContactIds: applyContactIds
  };
})();
