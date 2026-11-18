// ================= interface icons (one outline set, drawn inline so every device shows the same thing) =================
// ico('Hammer') -> '<svg class="ico">…</svg>' ; emoji stay only for game content (weapons, prefabs, Blorbs)
const ICON_CACHE = {};
function ico(name, cls = '') {
  const k = name + '|' + cls;
  if (!ICON_CACHE[k]) {
    const node = LUCIDE[name] || LUCIDE.Info, el = lucideEl(node);
    el.setAttribute('class', 'ico ' + cls); el.setAttribute('aria-hidden', 'true'); el.setAttribute('stroke-width', '2.2');
    ICON_CACHE[k] = el.outerHTML;
  }
  return ICON_CACHE[k];
}
// a button built from an icon + optional label: btn('Hammer', 'Build', fn, {cls})
function mkBtn(icon, label, fn, { cls = 'btn secondary', aria, title } = {}) {
  const b = document.createElement('button'); b.className = cls; b.type = 'button';
  b.innerHTML = (icon ? ico(icon) : '') + (label ? `<span>${label}</span>` : '');
  if (aria || (!label && title)) b.setAttribute('aria-label', aria || title); if (title) b.title = title;
  if (fn) b.onclick = fn; return b;
}
