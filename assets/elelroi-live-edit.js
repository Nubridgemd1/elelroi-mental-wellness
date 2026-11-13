/* Elelroi — live inline editor.
 * Lets the admin edit EVERY text block and the site fonts, in place.
 * Open any page with ?edit=<passcode> to enter edit mode (launched from the admin console).
 * Edits + font choices save to localStorage (this browser) and are re-applied on load.
 * NOTE: this is a per-browser studio (the site is static / no backend), same as the rest of the admin.
 */
(function () {
  var PASS = 'elelroi2026';
  var LS_TEXT = 'elelroi_text_ov', LS_FONT = 'elelroi_fonts';
  // Comprehensive set of editable text blocks on the public pages.
  var SEL = [
    'header .brand .b1', 'header .brand .b2',
    '.hero-content .eyebrow', '.hero-content h1 .hln', '.hero-content p.lede',
    '.hero-cta a', '.stats-band .stat b', '.stats-band .stat em',
    '#services .eyebrow', '#services h2.title', '#services .body',
    '.svc h3', '.svc p', '.svc .fcta',
    '#provider .eyebrow', '#provider h2.title', '.eval-body h3', '.eval-body p', '.eval-body a',
    '#insurance .eyebrow', '#insurance h2.title', '#insurance h3', '#insurance p', '#insurance .btn',
    '.about .eyebrow', '.about h2.title', '.about .body', '.about .qbox',
    'footer h4', 'footer .fbrand p', 'footer .copyright span',
    '.cta-band h2', '.cta-band p', '.cta-band .btn'
  ].join(',');

  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function els() { return Array.prototype.slice.call(document.querySelectorAll(SEL)); }
  function tag() { els().forEach(function (el, i) { if (!el.getAttribute('data-ed')) el.setAttribute('data-ed', 'e' + i); }); }

  function loadGF(name) {
    if (!name) return; var id = 'gf-' + name.replace(/\s+/g, '');
    if (document.getElementById(id)) return;
    var l = document.createElement('link'); l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name) + ':wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }
  function fam(name, kind) { return "'" + name + "'," + (kind === 'sans' ? 'Arial,sans-serif' : 'Georgia,serif'); }
  function applyFonts() {
    var f = read(LS_FONT); if (!f) return; var r = document.documentElement;
    if (f.serifName) { loadGF(f.serifName); r.style.setProperty('--serif', fam(f.serifName)); r.style.setProperty('--script', fam(f.serifName)); r.style.setProperty('--accent', fam(f.serifName)); }
    if (f.sansName) { loadGF(f.sansName); r.style.setProperty('--sans', fam(f.sansName, 'sans')); }
  }
  function applyText() {
    var ov = read(LS_TEXT) || {}; els().forEach(function (el) { var k = el.getAttribute('data-ed'); if (k && ov[k] != null) el.innerHTML = ov[k]; });
  }

  function enterEdit() {
    var ov = read(LS_TEXT) || {};
    els().forEach(function (el) {
      el.setAttribute('contenteditable', 'true');
      el.style.outline = '1px dashed rgba(243,192,18,.9)'; el.style.outlineOffset = '3px'; el.style.cursor = 'text';
      el.addEventListener('input', function () { ov[el.getAttribute('data-ed')] = el.innerHTML; write(LS_TEXT, ov); });
      if (el.tagName === 'A') el.addEventListener('click', function (e) { e.preventDefault(); });
    });
    toolbar();
  }

  function toolbar() {
    var FONTS = ['Cormorant', 'Playfair Display', 'Merriweather', 'Lora', 'EB Garamond', 'Georgia', 'Montserrat', 'Poppins', 'Inter', 'Nunito', 'Raleway'];
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:999999;background:#15304a;color:#fff;padding:10px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;font:14px Arial,sans-serif;box-shadow:0 -4px 22px rgba(0,0,0,.28)';
    var lbl = document.createElement('span');
    lbl.innerHTML = '<b style="color:#f3c012">&#10047; Live edit</b> &nbsp;<span style="opacity:.82">Click any text to edit — changes save as you type.</span>';
    bar.appendChild(lbl);
    bar.appendChild(fontPicker('Headings', 'serif', FONTS));
    bar.appendChild(fontPicker('Body', 'sans', FONTS));
    var spacer = document.createElement('span'); spacer.style.flex = '1'; bar.appendChild(spacer);
    var reset = btn('Reset all', 'transparent', '#fff', '1px solid rgba(255,255,255,.45)');
    reset.onclick = function () { if (confirm('Reset all text and font changes on this browser?')) { localStorage.removeItem(LS_TEXT); localStorage.removeItem(LS_FONT); location.href = location.pathname + '?edit=' + PASS; } };
    var done = btn('Done', '#f3c012', '#15304a', '0'); done.style.fontWeight = '700';
    done.onclick = function () { location.href = location.pathname; };
    bar.appendChild(reset); bar.appendChild(done);
    document.body.appendChild(bar);
    document.body.style.paddingBottom = '64px';
    function btn(t, bg, c, bd) { var b = document.createElement('button'); b.textContent = t; b.style.cssText = 'background:' + bg + ';color:' + c + ';border:' + bd + ';border-radius:7px;padding:8px 16px;cursor:pointer;font:14px Arial'; return b; }
    function fontPicker(label, key, list) {
      var w = document.createElement('label'); w.style.cssText = 'display:flex;gap:6px;align-items:center;font-size:13px';
      var s = document.createElement('select'); s.style.cssText = 'padding:6px;border-radius:6px;border:0';
      list.forEach(function (f) { var o = document.createElement('option'); o.value = f; o.textContent = f; s.appendChild(o); });
      var cur = read(LS_FONT) || {}; var nameKey = key + 'Name'; if (cur[nameKey]) s.value = cur[nameKey];
      s.onchange = function () { var f = read(LS_FONT) || {}; f[nameKey] = s.value; write(LS_FONT, f); applyFonts(); };
      w.appendChild(document.createTextNode(label + ': ')); w.appendChild(s); return w;
    }
  }

  function init() {
    tag(); applyText(); applyFonts();
    var q = new URLSearchParams(location.search);
    if (q.get('edit') === PASS) enterEdit();
  }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
