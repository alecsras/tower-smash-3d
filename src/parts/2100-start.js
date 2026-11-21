// ================= start =================
$('detBtn').onclick = detonateC4;
document.body.classList.toggle('calm', !!SAVE.calm);
const closeNews = () => { $('news').classList.remove('open'); SAVE.seenNews = NEWS_ID; persist(); };
$('newsX').onclick = $('newsGo').onclick = closeNews;
resize(); renderToolbar(); buildUI(); updateHud(); showHint();
loadPreset(PRESETS.find(p => p.id === 'castle'));
applyQuality(); updateCoins(); applyVolume();
// where to start: a duel link goes straight into the duel; automated tests start in the game; everyone else sees the title
const hasDuel = /duel=TS1/.test(location.hash + location.search), testMode = navigator.webdriver && !/[?&]shell\b/.test(location.search);
if (hasDuel) { showScreen('game'); checkIncomingDuel(); } else showScreen(testMode ? 'game' : 'title');
// compile every shader in the opening scene while the loading screen is still up (in parallel where the GPU
// supports it), so the first frames don't stutter; never wait more than 2.5 s for it
bootStep(.92, 'Warming up the graphics…');
try { await Promise.race([renderer.compileAsync(scene, camera), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
bootDone(); logAct(`start ${VERSION_STR} ${deviceLine()}`); track('session');
if ('serviceWorker' in navigator && location.protocol === 'https:' && !inFrame) navigator.serviceWorker.register('sw.js').catch(() => {});
if (DEBUG || navigator.webdriver) window.__game = { boom: (x, y, z, p = 1) => explodeAt(new V3(x, y, z), p), PROJ, PROF, profReport, profReset, get P() { return P; }, get renderer() { return renderer; }, startChallenge, campaignDef, dailyDef, duelDef, encodeFortress, unpackJSON, startReplay, stopReplay, get replay() { return replay; }, get rec() { return rec; }, fracture, ignite, igniteNear, get burning() { return burning; }, SAVE, aiBuild, runBlueprint, set duelBuild(v) { duelBuild = v; }, throwAt(kind, x, y, z, pw = 1, size = 1) { curProj = kind; curSize = size; const o = launchOrigin(), tp = new THREE.Vector3(x, y, z); const { vel } = solveVelocity(o, tp, MIN_SPEED + (MAX_SPEED - MIN_SPEED) * pw); throwProj(vel, tp, pw); }, startQuake, startTornado, startLevel, setNight, LEVELS, get chal() { return chal; }, cb: { parseCmd, genStructure, pieceAABB }, kick(o, x, y, z) { activate(o); o.body.wakeUp(); o.body.setAngularVelocity(x, y, z); }, ff(sec) { for (let i = 0; i < sec * 60; i++) { preActivate(); dominoAssist(); P.step(STEP, onHit); simTime += STEP; } for (const o of objs) if (!o.gone) { syncMesh(o); o.mdirty = true; } }, setMode, get objs() { return objs; }, cam, loadPreset, countOf, repaintPad, MAT_THEMES, rebuild2: () => rebuild(), SCORE, scoreReset, scoreTopple, comboMult, updateHud, applyQuality, removeObj, createPiece, CUBE, clearAll, campLock, WORLDS, openLevels, totalStars, themeLocked, checkUnlocks, renderMega: () => openLibrary("mega"), get sunShadow() { return sun.castShadow; }, perfSummary, perfLine, track, PRESETS, openMenu, setTool, toolDown, toolMove, toolUp, undo, redo, get tool() { return tool; }, set mirrorX(v) { mirrorX = v; }, set toolH(v) { toolH = v; }, set curBlock(v) { curBlock = v; }, brushAt, pickAt, ARSENAL, get AFX() { return AFX; }, setCat(c) { wcat = c; buildUI(); }, LANDMARKS, PREFABS, prefabLines, compileBlueprint, testGravity, autoSupport, openPrefabs, startPlacing, prefabTryPlace, snapBuild, snapPieces, placePieces, bonds, fuseAll, unfuseAll, set bondMode(v) { bondMode = v; }, fuseBrushAt, rebuild, takeSnapshot, startTraining, startIntro, showScreen, goHome, enterFreePlay, openPause, openSettings, openHelp, openFeedback, openLibrary, buildReport, exportSave, importSave, get screen() { return screen; }, get paused() { return paused; }, get tutStep() { return tutStep; }, coach, setFollow, setFree, panCam, get camTarget() { return cam.target; } };
requestAnimationFrame(t => { last = t; requestAnimationFrame(tick); });

