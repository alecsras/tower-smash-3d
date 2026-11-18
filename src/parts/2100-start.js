// ================= start =================
$('detBtn').onclick = detonateC4;
document.body.classList.toggle('calm', !!SAVE.calm);
const closeNews = () => { $('news').classList.remove('open'); SAVE.seen3 = true; persist(); };
$('newsX').onclick = $('newsGo').onclick = closeNews;
if (!SAVE.seen3 && !navigator.webdriver) setTimeout(() => $('news').classList.add('open'), 900);
resize(); renderToolbar(); buildUI(); updateHud(); showHint();
loadPreset(PRESETS.find(p => p.id === 'castle'));
applyQuality(); updateCoins(); checkIncomingDuel();
if ('serviceWorker' in navigator && location.protocol === 'https:' && !inFrame) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__game = { startChallenge, campaignDef, dailyDef, duelDef, encodeFortress, unpackJSON, startReplay, stopReplay, get replay() { return replay; }, get rec() { return rec; }, fracture, ignite, igniteNear, get burning() { return burning; }, SAVE, aiBuild, runBlueprint, set duelBuild(v) { duelBuild = v; }, throwAt(kind, x, y, z, pw = 1, size = 1) { curProj = kind; curSize = size; const o = launchOrigin(), tp = new THREE.Vector3(x, y, z); const { vel } = solveVelocity(o, tp, MIN_SPEED + (MAX_SPEED - MIN_SPEED) * pw); throwProj(vel, tp, pw); }, startQuake, startTornado, startLevel, setNight, LEVELS, get chal() { return chal; }, cb: { parseCmd, genStructure, pieceAABB }, kick(o, x, y, z) { activate(o); o.body.wakeUp(); o.body.setAngularVelocity(x, y, z); }, ff(sec) { for (let i = 0; i < sec * 60; i++) { preActivate(); dominoAssist(); P.step(STEP, onHit); simTime += STEP; } for (const o of objs) if (!o.gone) { syncMesh(o); o.mdirty = true; } }, setMode, get objs() { return objs; }, cam, loadPreset, PRESETS, openMenu, setTool, toolDown, toolMove, toolUp, undo, redo, get tool() { return tool; }, set mirrorX(v) { mirrorX = v; }, set toolH(v) { toolH = v; }, set curBlock(v) { curBlock = v; }, brushAt, pickAt, ARSENAL, get AFX() { return AFX; }, setCat(c) { wcat = c; buildUI(); } };
requestAnimationFrame(t => { last = t; requestAnimationFrame(tick); });

