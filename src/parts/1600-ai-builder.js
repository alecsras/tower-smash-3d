// ================= ✨ describe-it builder =================
const AI_GUIDE = `You design structures for Tower Smash, a 3D block-physics destruction game. Reply with ONLY a blueprint inside a \`\`\`blueprint code fence: one structure per line in this command language.

GRID: 1 unit = 1 block. Ground is y=0. "at X,Z" = the structure's center (keep X and Z between -20 and 20). "up N" starts it N blocks above the ground so it can sit on something below.
SHAPES:
  solid W x L x H   – filled with blocks (each block is separate, so blocks over empty air fall)
  tower W x L x H   – hollow rectangular walls
  round W x L x H   – hollow cylinder
  pyramid W x L     – stepped pyramid
  wall W x L x H    – a straight wall (use L=1 for a wall running along X, W=1 along Z)
  stairs W x L x H  – steps rising along +X
  slab W x L x H    – ONE solid piece (H = 1..3). Use slabs for floors, decks, bridges, roofs and platforms that span gaps.
  dome W x L x H    – half-ellipsoid shell (H = its height)      sphere N – ball shell N across
  cone W x L x H    – tapering cone/spire                         arch W x L x H – arch with an opening underneath (span W along X)
  gate W x L x H    – wall with an arched doorway + battlements    bridge W x L x H – deck on posts, H tall, running along X
  spiral W x L x H  – spiral staircase around a central column
MATERIALS: stone wood glass marble concrete sand gold tnt steel brick ice rubber crystal obsidian striped checker random
TRANSFORMS: "rot 45" rotates a structure around its center.
PREFIXES (before the command):
  name: …            names a structure, e.g. keep: tower 8x8x14 stone
  on name: …         builds on top of that structure ("at" is then an offset from its center) — the easiest way to stack
  array 3x2 spacing 8: …          grid of copies centered on "at"
  around X,Z radius R count N: …  ring of copies facing the center
  mirror x: …  (or z / xz)        also builds the mirror image across the middle
EXTRAS: windows N · floors N (tower/round only) · thick N · battlements · roof (spire on round/small towers, pitched roof otherwise) · tnt core
PHYSICS RULES (important — the build is simulated and will collapse if unsupported):
  • Structures must not overlap: something W wide at X spans X-W/2 … X+W/2.
  • Anything with "up N" must rest exactly on the top of a structure that is N tall where they meet.
  • A hollow tower/round can only support something with the SAME W and L on top — otherwise put a slab of the same footprint on it first, then build on the slab.
  • Bridges/decks across gaps must be slabs whose ends rest on supports.
  • Keep the total under 6000 blocks (solid W·L·H; tower ≈ 2·(W+L)·H). Max 40 x 40 x 60. Aim for a recognizable silhouette in 4–20 lines.
EXAMPLE — a lighthouse:
\`\`\`blueprint
base: solid 6x6x4 stone
on base: shaft: round 4x4x14 striped windows 3 floors 4
on shaft: deck: slab 5x5x1 concrete
on deck: tower 3x3x2 glass roof
\`\`\``;
const AI_STYLES = ['Medieval', 'Modern', 'Ancient', 'Fantasy', 'Sci-fi', 'Ruined', 'Tiny', 'Massive'];
let aiStyle = null, aiLast = null, aiPreview = false, aiPhoto = null;
const LANDMARKS = [
  [/eiffel|paris/, 'solid 2x2x6 stone at -4,-4\nsolid 2x2x6 stone at 4,-4\nsolid 2x2x6 stone at -4,4\nsolid 2x2x6 stone at 4,4\nslab 10x10x1 concrete up 6\ntower 6x6x8 stone windows 2 up 7\nslab 6x6x1 concrete up 15\ntower 4x4x10 stone windows 2 up 16\nslab 4x4x1 concrete up 26\nsolid 2x2x8 stone up 27\ntower 2x2x3 gold up 35 roof'],
  [/lighthouse/, 'base: solid 6x6x4 stone\non base: shaft: round 4x4x14 striped windows 3 floors 4\non shaft: deck: slab 5x5x1 concrete\non deck: tower 3x3x2 glass roof'],
  [/castle|fort|keep/, CB_EXAMPLES[1][1].replace(/^clear\n/, '')],
  [/pyramid|egypt|giza/, 'pyramid 21x21 sand tnt core\npyramid 9x9 sand at -16,9\npyramid 7x7 sand at 16,-9'],
  [/bridge/, 'tower 4x4x8 stone windows 3 at -10,0\ntower 4x4x8 stone windows 3 at 10,0\nslab 4x4x1 concrete at -10,0 up 8\nslab 4x4x1 concrete at 10,0 up 8\nslab 24x4x1 wood up 9\nsolid 2x4x9 stone at 0,0'],
  [/colosseum|stadium|arena/, 'round 24x24x5 stone thick 2 windows 2 battlements'],
  [/temple|parthenon|greek/, 'solid 12x8x1 marble\nsolid 1x1x5 marble at -5,-3 up 1\nsolid 1x1x5 marble at -2,-3 up 1\nsolid 1x1x5 marble at 2,-3 up 1\nsolid 1x1x5 marble at 5,-3 up 1\nsolid 1x1x5 marble at -5,3 up 1\nsolid 1x1x5 marble at -2,3 up 1\nsolid 1x1x5 marble at 2,3 up 1\nsolid 1x1x5 marble at 5,3 up 1\nslab 12x8x1 marble up 6\npyramid 12x8 marble up 7'],
  [/house|cabin|home|cottage/, 'tower 7x6x4 wood windows 2 floors 3 roof\ntower 3x3x2 stone at -6,-5\nslab 3x3x1 wood at -6,-5 up 2'],
  [/space needle|seattle|needle/, 'solid 3x3x20 concrete\nslab 9x9x1 concrete up 20\nround 7x7x2 glass up 21\nslab 9x9x1 concrete up 23\ntower 1x1x6 gold up 24'],
  [/taj|mahal/, 'solid 14x14x1 marble\ntower 8x8x6 marble windows 2 up 1\ndome 8x8x5 marble up 7\naround 0,0 radius 9 count 4: round 2x2x11 marble roof'],
  [/pisa|leaning/, 'round 5x5x18 marble windows 2 floors 4 rot 10'],
  [/big ben|clock tower|london/, 'clock: tower 5x5x18 brick windows 4 floors 4\non clock: tower 5x5x3 gold windows 1 roof'],
  [/liberty|statue/, 'pyramid 9x9 concrete\nsolid 3x3x8 marble up 5\ncone 3x3x3 gold up 13'],
  [/stonehenge|henge/, 'around 0,0 radius 7 count 10: arch 3x1x4 stone'],
  [/pagoda|japan|shrine/, 'p1: tower 7x7x4 wood windows 2\non p1: slab 9x9x1 concrete\np2: tower 5x5x4 wood windows 2 up 5\non p2: slab 7x7x1 concrete\ntower 3x3x3 wood up 10 roof'],
  [/great wall|china/, 'wall 30x2x5 stone battlements\narray 3x1 spacing 13: tower 4x4x8 stone battlements at 0,3'],
  [/kremlin|basil|moscow/, 'tower 6x6x8 brick windows 2\ndome 6x6x4 gold up 8\naround 0,0 radius 7 count 4: round 3x3x8 brick\naround 0,0 radius 7 count 4: dome 3x3x2 crystal up 8'],
  [/capitol|white house|washington/, 'solid 16x8x1 marble\ntower 14x6x6 marble windows 2 up 1\nround 6x6x3 marble up 7\ndome 6x6x4 marble up 10'],
  [/burj|dubai|khalifa/, 'a: tower 7x7x14 glass windows 1 floors 4\non a: b: tower 5x5x14 glass windows 1 floors 4\non b: c: tower 3x3x14 glass windows 1\non c: cone 3x3x6 steel'],
  [/empire state|chrysler/, 'a: tower 9x9x16 concrete windows 1 floors 4\non a: b: tower 7x7x12 concrete windows 1 floors 4\non b: c: tower 5x5x8 concrete windows 1\non c: cone 3x3x5 steel'],
  [/arc de|triomphe|triumph/, 'arch 11x4x10 marble thick 2'],
  [/aqueduct|roman/, 'array 5x1 spacing 5: arch 5x2x7 sand'],
  [/golden gate|suspension/, 'bridge 30x4x6 brick\nmirror x: tower 2x2x14 brick at 10,3.5\nmirror x: tower 2x2x14 brick at 10,-3.5'],
  [/windmill/, 'mill: round 6x6x10 stone windows 3\non mill: cone 6x6x4 wood\nwall 9x1x1 wood at 0,3.7 up 7\nsolid 1x1x9 wood at 0,4.8 up 3'],
  [/igloo|eskimo/, 'dome 11x11x6 ice'],
  [/volcano/, 'cone 17x17x10 obsidian thick 2'],
  [/planet|moon|globe/, 'sphere 13 random'],
  [/ufo|saucer/, 'solid 1x1x6 steel\nslab 11x11x1 steel up 6\ndome 7x7x3 glass up 7'],
  [/rocket ship|spaceship/, 'mirror x: solid 1x1x3 steel at 2,0\nround 4x4x16 steel windows 3 up 3\ncone 4x4x5 brick up 19'],
  [/ferris|wheel/, 'mirror x: wall 1x1x10 steel at 2,0\naround 0,0 radius 6 count 12: solid 1x1x1 crystal up 10'],
  [/ship|boat|pirate/, 'solid 14x5x2 wood\ntower 14x5x2 wood up 2\nsolid 1x1x10 wood up 2\nwall 7x1x5 rubber at 0,1 up 6\ntower 4x4x2 wood at -5,0 up 4'],
  [/fortress|citadel|stronghold/, 'keep: tower 8x8x14 stone windows 3 floors 4 battlements\non keep: dome 8x8x4 marble\naround 0,0 radius 14 count 8: round 4x4x9 brick roof'],
  [/church|cathedral|chapel/, 'tower 8x14x8 stone windows 2 floors 4 roof\ntower 4x4x16 stone windows 3 at 0,-9.8 roof'],
  [/mosque/, 'tower 10x10x5 sand windows 2\ndome 10x10x6 marble up 5\nmirror x: round 2x2x16 sand roof at 7,7'],
  [/barn|farm/, 'tower 9x6x5 wood windows 2 roof\nround 4x4x12 concrete at 8,0 roof'],
  [/stadium|arena|colosseum/, 'round 24x24x5 stone thick 2 windows 2 battlements'],
  [/tree|forest/, 'array 3x3 spacing 6: cone 4x4x6 wood'],
  [/maze|labyrinth/, 'wall 16x1x3 brick at 0,-8\nwall 16x1x3 brick at 0,8\nwall 1x15x3 brick at -8,0\nwall 1x9x3 brick at 8,-3\nwall 10x1x3 brick at -2,-3\nwall 1x7x3 brick at 3,3\nwall 8x1x3 brick at -3,3'],
  [/wizard|tower of|mage/, 'w: round 6x6x18 crystal windows 3 floors 4\non w: cone 7x7x7 obsidian'],
  [/sky|city|tower|building|new york|manhattan/, 'solid 12x12x1 concrete\ntower 8x8x40 glass windows 1 floors 5 up 1 roof\ntower 5x5x22 concrete windows 2 floors 4 at -11,-6\ntower 5x5x28 glass windows 1 floors 4 at 11,6 roof\ntower 4x4x16 checker windows 2 at 11,-8']
];
let sampleP = null;
function extractBlueprint(text) {
  const m = text.match(/```(?:blueprint)?\s*\n([\s\S]*?)```/), body = m ? m[1] : text;
  const shapeRe = new RegExp('\\b(' + Object.keys(CB_SHAPE_WORDS).join('|') + ')\\b', 'i');
  return body.split('\n').map(l => l.trim()).filter(l => l && !/^clear\b/i.test(l) && shapeRe.test(l));
}
// desc: what to build; opts.edit: change the last design instead of starting over
async function aiBuild(desc, opts = {}) {
  desc = (desc || '').trim(); const photo = opts.photo || null;
  if (!desc && !photo) return;
  const status = t => { const el = $('aiStatus'); if (el) el.textContent = t; };
  const btns = ['aiGo', 'aiEditGo', 'aiPhotoBtn'].map(id => $(id)).filter(Boolean); btns.forEach(b => b.disabled = true);
  const done = () => btns.forEach(b => b.disabled = false);
  const want = desc + (aiStyle && !opts.edit ? ` — in a ${aiStyle.toLowerCase()} style` : '');
  const s = await (sampleP || (sampleP = useCap('sample')));
  if (!s) {
    const lm = LANDMARKS.find(([re]) => re.test(desc.toLowerCase()));
    if (!lm) { status('AI building isn’t available here — try a landmark: Eiffel Tower, Taj Mahal, Big Ben, pagoda, Burj Khalifa, windmill, UFO, castle, pyramid…'); done(); return; }
    finishAI(desc, lm[1].split('\n'), status, '✨ Built from the landmark library'); done(); return;
  }
  let prompt;
  if (opts.edit && aiLast) prompt = `${AI_GUIDE}\n\nHere is the current design ("${aiLast.desc}"):\n\`\`\`blueprint\n${aiLast.lines.join('\n')}\n\`\`\`\nChange it: ${desc}\nReply with the COMPLETE updated blueprint.`;
  else if (photo) prompt = `${AI_GUIDE}\n\nRecreate the main building or structure in the attached photo as a blueprint — match its silhouette, proportions and materials as closely as the shapes allow.${desc ? ' Notes: ' + desc : ''}`;
  else prompt = `${AI_GUIDE}\n\nBuild this: ${want}`;
  const msgs = [{ role: 'user', content: prompt }];
  try {
    let imgs = null;
    if (photo) { const lim = s.limits ? await s.limits() : null; if (!lim || !lim.images) { status('Photo building isn’t available here — describe it in words instead'); done(); return; } imgs = [photo]; }
    for (let attempt = 0; attempt < 2; attempt++) {
      status(attempt ? 'Fixing the design…' : opts.edit ? 'Changing it…' : photo ? 'Studying your photo…' : 'Designing…');
      const r = await s(msgs, { modelTier: 'default', cache: false, ...(imgs ? { images: imgs } : {}), onText: ({ text }) => status(`Designing… ${extractBlueprint(text).length} lines so far`) });
      const lines = extractBlueprint(r.text);
      if (!lines.length) { status('No buildable design came back — try describing it differently'); break; }
      cbLastErr = '';
      if (finishAI(opts.edit && aiLast ? aiLast.desc + ' + ' + desc : (desc || 'your photo'), lines, status)) break;
      msgs.push({ role: 'assistant', content: r.text }, { role: 'user', content: `Building failed: "${cbLastErr}". Fix that problem and reply with the complete corrected blueprint.` });
    }
  } catch (e) {
    status(e && e.code === 'rate_limited' ? 'Too many requests — wait a moment and try again' : e && e.code === 'not_granted' ? 'AI building wasn’t allowed — using the landmark library instead' : 'Something went wrong — try again');
    if (e && e.code === 'not_granted') sampleP = Promise.resolve(null);
  }
  done();
}
// build it (or, in preview mode, put the plan in the blueprint box for review)
function finishAI(desc, lines, status, msg) {
  if (aiPreview) {
    const C = compileBlueprint(lines); if (C.err) { cbLastErr = C.err; return false; }
    aiLast = { desc, lines }; $('cbBp').value = cbBlueprint = 'clear\n' + lines.join('\n'); cbUpdate(); renderAIEdit();
    status(`📝 Plan ready — ${lines.length} lines, ${C.structs.reduce((n, a) => n + a.length, 0).toLocaleString()} blocks. Review it in the Blueprint box below, then tap “Build blueprint”.`);
    $('cbBp').scrollIntoView({ behavior: 'smooth', block: 'center' }); return true;
  }
  if (!runBlueprint(['clear', ...lines])) return false;
  aiLast = { desc, lines }; $('cbBp').value = cbBlueprint = lines.join('\n'); closeCustom(); fitView();
  toast(msg || `✨ ${desc.slice(0, 40)} — ${lines.length} lines`); return true;
}
function renderAIEdit() {
  const el = $('aiEdit'); if (!el) return;
  el.style.display = aiLast ? 'block' : 'none'; if (!aiLast) return;
  el.querySelector('small').textContent = `Last design: ${aiLast.desc.slice(0, 60)}`;
}
function renderAI(f) {
  const box = document.createElement('div'); box.className = 'aibox';
  box.innerHTML = `<div class="lab">✨ Describe it — AI builds it</div>
    <div class="airow"><input id="aiIn" placeholder="e.g. the Eiffel Tower, a castle on a hill…" enterkeyhint="go"><button class="b1" id="aiGo">Build</button></div>
    <div class="chips" id="aiStyles"></div>
    <div class="airow aiopts"><label class="chk"><input type="checkbox" id="aiPrev"${aiPreview ? ' checked' : ''}> Show the plan first</label>
      <button class="b2" id="aiPhotoBtn">📷 From a photo</button><input type="file" id="aiPhotoIn" accept="image/*" hidden></div>
    <div id="aiEdit" style="display:none"><div class="lab">🔁 Change the last design <small></small></div>
      <div class="airow"><input id="aiEditIn" placeholder="e.g. make it twice as tall, add a moat, use brick" enterkeyhint="go"><button class="b1" id="aiEditGo">Change</button></div></div>
    <div id="aiStatus" class="aist"></div><div class="chips" id="aiEx"></div>`;
  f.appendChild(box);
  const st = box.querySelector('#aiStyles');
  for (const t of AI_STYLES) { const b = document.createElement('button'); b.className = 'chip' + (aiStyle === t ? ' on' : ''); b.textContent = t; b.onclick = () => { aiStyle = aiStyle === t ? null : t; [...st.children].forEach(c => c.classList.toggle('on', c.textContent === aiStyle)); }; st.appendChild(b); }
  const ex = box.querySelector('#aiEx');
  for (const t of ['Eiffel Tower', 'Taj Mahal', 'Lighthouse', 'Medieval castle', 'Pagoda', 'Burj Khalifa', 'Windmill', 'Pirate ship', 'UFO']) {
    const b = document.createElement('button'); b.className = 'chip ex'; b.textContent = t; b.onclick = () => { $('aiIn').value = t; aiBuild(t); }; ex.appendChild(b);
  }
  box.querySelector('#aiGo').onclick = () => aiBuild($('aiIn').value);
  box.querySelector('#aiIn').onkeydown = e => { if (e.key === 'Enter') aiBuild(e.target.value); };
  box.querySelector('#aiPrev').onchange = e => aiPreview = e.target.checked;
  box.querySelector('#aiEditGo').onclick = () => aiBuild($('aiEditIn').value, { edit: true });
  box.querySelector('#aiEditIn').onkeydown = e => { if (e.key === 'Enter') aiBuild(e.target.value, { edit: true }); };
  box.querySelector('#aiPhotoBtn').onclick = () => box.querySelector('#aiPhotoIn').click();
  box.querySelector('#aiPhotoIn').onchange = async e => { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
    const blob = await shrinkImage(file); aiBuild($('aiIn').value, { photo: blob }); };
  renderAIEdit();
}
// keep uploads small: max 1024px JPEG
async function shrinkImage(file) {
  try { const bmp = await createImageBitmap(file), k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', .85)); } catch (e) { return file; }
}
