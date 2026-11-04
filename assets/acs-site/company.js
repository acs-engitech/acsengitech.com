// Company pages: reveal sections once as they enter the viewport. CSS only hides .co-reveal under .co-js,
// so content stays visible if this script never runs.
(function () {
  var root = document.documentElement;
  root.classList.add('co-js');
  var items = document.querySelectorAll('.co-reveal');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });
  // Content rendered later (blog posts, career roles) is revealed immediately.
  window.acsRevealAll = function (scope) {
    (scope || document).querySelectorAll('.co-reveal').forEach(function (el) { el.classList.add('is-in'); });
  };
}());
