// ================= boot: the loading screen shown while the page and physics engine start =================
// (function declarations so the imports part can call them before this file's code runs)
function bootStep(p, msg) {
  const bar = document.getElementById('bootBar'), tip = document.getElementById('bootMsg');
  if (bar) bar.style.width = Math.round(p * 100) + '%'; if (tip && msg) tip.textContent = msg;
}
function bootFail(kind) {
  const b = document.getElementById('boot'); if (!b) return;
  b.classList.add('failed');
  document.getElementById('bootMsg').textContent = kind === 'old'
    ? 'This browser is too old for Tower Smash. Update to iOS 16.4 or newer, or the latest Chrome, Safari or Firefox.'
    : kind === 'webgl'
    ? 'Tower Smash needs 3D graphics, which this browser has turned off. Try Chrome or Safari, or update your browser.'
    : 'Your browser couldn’t start the physics engine. Try Chrome or Safari, or update your browser.';
}
function bootDone() {
  bootStep(1, 'Ready!');
  const b = document.getElementById('boot'); if (!b) return;
  setTimeout(() => { b.classList.add('gone'); setTimeout(() => b.remove(), 600); }, 250);
}
