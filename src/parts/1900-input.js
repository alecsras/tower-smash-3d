// ================= input =================
const cv = $('c'), pointers = new Map();
let drag = null, pinch = null;
cv.addEventListener('pointerdown', e => {
  initAudio();
  if (replay) { stopReplay(); return; }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  if (pointers.size === 1) {
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, orbit: false };
    if (mode === 'build' && !cbPlacing && !pfPlacing && tool !== 'place' && tool !== 'pick') drag.tool = toolDown(e.clientX, e.clientY);
    if (mode === 'throw') aim = { id: e.pointerId, x: e.clientX, y: e.clientY, t0: performance.now(), target: pickTarget(e.clientX, e.clientY) };
  } else if (pointers.size === 2) {
    if (stroke) { if (stroke.brush) finishBrush(); else if (!stroke.tapAnchor) clearGhost(); }
    drag = null; aim = null; pinch = pinchState();
  }
});
function pinchState() { const [a, b] = [...pointers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
cv.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && pinch) {
    const p = pinchState();
    if (p.d > 0 && pinch.d > 0) zoom(pinch.d / p.d);
    orbit(-(p.mx - pinch.mx) * .008, (p.my - pinch.my) * .005);
    pinch = p; return;
  }
  if (aim && e.pointerId === aim.id && Math.hypot(e.clientX - aim.x, e.clientY - aim.y) > 3) {
    aim.x = e.clientX; aim.y = e.clientY; aim.target = pickTarget(e.clientX, e.clientY);
  }
  if (!drag || e.pointerId !== drag.id) return;
  drag.cx = e.clientX; drag.cy = e.clientY;
  if (Math.hypot(drag.cx - drag.sx, drag.cy - drag.sy) > 10) drag.moved = true;
  if (freeCam && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) { drag.moved = true; drag.pan = true; aim = null; if (stroke) clearGhost(); drag.tool = false; panCam(e.clientX - drag.lx, e.clientY - drag.ly); drag.lx = e.clientX; drag.ly = e.clientY; return; }
  if (drag.tool) { toolMove(drag.cx, drag.cy); drag.lx = drag.cx; drag.ly = drag.cy; return; }
  if (mode === 'build' && drag.moved) {
    drag.orbit = true;
    orbit(-(drag.cx - drag.lx) * .008, (drag.cy - drag.ly) * .005);
  }
  drag.lx = drag.cx; drag.ly = drag.cy;
});
function endPointer(e, cancel) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  const a = aim; aim = null;
  if (cancel) return;
  if (d.pan) return;
  if (d.tool) { toolUp(d.moved); hideHint('build'); return; }
  if (mode === 'build' && tool === 'pick' && !d.moved) { pickAt(d.sx, d.sy); return; }
  if (mode === 'build') { if (!d.moved) { if (prefabTryPlace(d.sx, d.sy)) return; if (cbTryPlace(d.sx, d.sy)) return; placeAt(d.sx, d.sy); hideHint('build'); } }
  else if (a && a.id === e.pointerId && a.vel) { throwProj(a.vel, a.target.p, chargeOf(a)); hideHint('throw'); }
}
cv.addEventListener('pointerup', e => endPointer(e, false));
cv.addEventListener('pointercancel', e => endPointer(e, true));
cv.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : .9); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());

