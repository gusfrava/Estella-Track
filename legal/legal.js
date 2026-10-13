// ES/EN switch for the legal pages. Uses the app's saved language (or ?lang=en).
(function () {
  var KEY = 'estellatrack.lang';
  var q = new URLSearchParams(location.search).get('lang');
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  function show(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll('article[data-lang]').forEach(function (a) { a.hidden = a.dataset.lang !== lang; });
    document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.setLang === lang); });
  }
  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () { show(b.dataset.setLang); try { localStorage.setItem(KEY, b.dataset.setLang); } catch (e) {} });
  });
  show(q === 'en' || q === 'es' ? q : (saved === 'en' ? 'en' : 'es'));
})();
