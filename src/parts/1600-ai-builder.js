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
MATERIALS: stone wood glass marble concrete sand gold tnt striped checker random
EXTRAS: windows N · floors N (tower/round only) · thick N · battlements · roof (spire on round/small towers, pitched roof otherwise) · tnt core
PHYSICS RULES (important — the build is simulated and will collapse if unsupported):
  • Structures must not overlap: something W wide at X spans X-W/2 … X+W/2.
  • Anything with "up N" must rest exactly on the top of a structure that is N tall where they meet.
  • A hollow tower/round can only support something with the SAME W and L on top — otherwise put a slab of the same footprint on it first, then build on the slab.
  • Bridges/decks across gaps must be slabs whose ends rest on supports.
  • Keep the total under 6000 blocks (solid W·L·H; tower ≈ 2·(W+L)·H). Max 40 x 40 x 60. Aim for a recognizable silhouette in 4–20 lines.
EXAMPLE — a lighthouse:
\`\`\`blueprint
solid 6x6x4 stone
round 4x4x14 striped windows 3 floors 4 up 4
slab 5x5x1 concrete up 18
tower 3x3x2 glass up 19 roof
\`\`\``;
const LANDMARKS = [
  [/eiffel|paris/, 'solid 2x2x6 stone at -4,-4\nsolid 2x2x6 stone at 4,-4\nsolid 2x2x6 stone at -4,4\nsolid 2x2x6 stone at 4,4\nslab 10x10x1 concrete up 6\ntower 6x6x8 stone windows 2 up 7\nslab 6x6x1 concrete up 15\ntower 4x4x10 stone windows 2 up 16\nslab 4x4x1 concrete up 26\nsolid 2x2x8 stone up 27\ntower 2x2x3 gold up 35 roof'],
  [/lighthouse/, 'solid 6x6x4 stone\nround 4x4x14 striped windows 3 floors 4 up 4\nslab 5x5x1 concrete up 18\ntower 3x3x2 glass up 19 roof'],
  [/castle|fort|keep/, CB_EXAMPLES[1][1].replace(/^clear\n/, '')],
  [/pyramid|egypt|giza/, 'pyramid 21x21 sand tnt core\npyramid 9x9 sand at -15,8\npyramid 7x7 sand at 15,-9'],
  [/bridge/, 'tower 4x4x8 stone windows 3 at -10,0\ntower 4x4x8 stone windows 3 at 10,0\nslab 4x4x1 concrete at -10,0 up 8\nslab 4x4x1 concrete at 10,0 up 8\nslab 24x4x1 wood up 9\nsolid 2x4x9 stone at 0,0'],
  [/colosseum|stadium|arena/, 'round 24x24x5 stone thick 2 windows 2 battlements'],
  [/temple|parthenon|greek/, 'solid 12x8x1 marble\nsolid 1x1x5 marble at -5,-3 up 1\nsolid 1x1x5 marble at -2,-3 up 1\nsolid 1x1x5 marble at 2,-3 up 1\nsolid 1x1x5 marble at 5,-3 up 1\nsolid 1x1x5 marble at -5,3 up 1\nsolid 1x1x5 marble at -2,3 up 1\nsolid 1x1x5 marble at 2,3 up 1\nsolid 1x1x5 marble at 5,3 up 1\nslab 12x8x1 marble up 6\npyramid 12x8 marble up 7'],
  [/sky|city|tower|building|new york|manhattan/, 'solid 12x12x1 concrete\ntower 8x8x40 glass windows 1 floors 5 up 1 roof\ntower 5x5x22 concrete windows 2 floors 4 at -11,-6\ntower 5x5x28 glass windows 1 floors 4 at 11,6 roof\ntower 4x4x16 checker windows 2 at 11,-8'],
  [/house|cabin|home|cottage/, 'tower 7x6x4 wood windows 2 floors 3 roof\ntower 3x3x2 stone at -6,-5\nslab 3x3x1 wood at -6,-5 up 2'],
  [/space needle|seattle|needle/, 'solid 3x3x20 concrete\nslab 9x9x1 concrete up 20\nround 7x7x2 glass up 21\nslab 9x9x1 concrete up 23\ntower 1x1x6 gold up 24']
];
let sampleP = null;
function extractBlueprint(text) {
  const m = text.match(/```(?:blueprint)?\s*\n([\s\S]*?)```/), body = m ? m[1] : text;
  return body.split('\n').map(l => l.trim()).filter(l => l && /\d\s*[x×]\s*\d|\bslab\b/i.test(l));
}
async function aiBuild(desc) {
  desc = desc.trim(); if (!desc) return;
  const status = t => { const el = $('aiStatus'); if (el) el.textContent = t; };
  const go = $('aiGo'); if (go) go.disabled = true;
  const done = () => { if (go) go.disabled = false; };
  const s = await (sampleP || (sampleP = useCap('sample')));
  if (!s) {
    const lm = LANDMARKS.find(([re]) => re.test(desc.toLowerCase()));
    if (!lm) { status('AI building isn’t available here — try: Eiffel Tower, lighthouse, castle, pyramid, bridge, temple, skyscraper, house'); done(); return; }
    if (runBlueprint(['clear', ...lm[1].split('\n')])) { closeCustom(); toast('✨ Built from the landmark library'); }
    done(); return;
  }
  const msgs = [{ role: 'user', content: `${AI_GUIDE}\n\nBuild this: ${desc}` }];
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      status(attempt ? 'Fixing the design…' : 'Designing…');
      const r = await s(msgs, { modelTier: 'default', cache: false, onText: ({ text }) => status(`Designing… ${extractBlueprint(text).length} structures so far`) });
      const lines = extractBlueprint(r.text);
      if (!lines.length) { status('No buildable design came back — try describing it differently'); break; }
      cbLastErr = '';
      if (runBlueprint(['clear', ...lines])) { $('cbBp').value = cbBlueprint = lines.join('\n'); closeCustom(); toast(`✨ ${desc.slice(0, 40)} — ${lines.length} structures`); break; }
      msgs.push({ role: 'assistant', content: r.text }, { role: 'user', content: `Building failed: "${cbLastErr}". Fix that problem and reply with the complete corrected blueprint.` });
    }
  } catch (e) {
    status(e && e.code === 'rate_limited' ? 'Too many requests — wait a moment and try again' : e && e.code === 'not_granted' ? 'AI building wasn’t allowed — using the landmark library instead' : 'Something went wrong — try again');
    if (e && e.code === 'not_granted') sampleP = Promise.resolve(null);
  }
  done();
}
function renderAI(f) {
  const box = document.createElement('div'); box.className = 'aibox';
  box.innerHTML = `<div class="lab">✨ Describe it — AI builds it</div>
    <div class="airow"><input id="aiIn" placeholder="e.g. the Eiffel Tower, a castle on a hill…" enterkeyhint="go"><button class="b1" id="aiGo">Build</button></div>
    <div id="aiStatus" class="aist"></div><div class="chips" id="aiEx"></div>`;
  f.appendChild(box);
  const ex = box.querySelector('#aiEx');
  for (const t of ['Eiffel Tower', 'Lighthouse', 'Medieval castle', 'Suspension bridge', 'Space Needle', 'Pirate ship', 'Roman temple']) {
    const b = document.createElement('button'); b.className = 'chip ex'; b.textContent = t; b.onclick = () => { $('aiIn').value = t; aiBuild(t); }; ex.appendChild(b);
  }
  box.querySelector('#aiGo').onclick = () => aiBuild($('aiIn').value);
  box.querySelector('#aiIn').onkeydown = e => { if (e.key === 'Enter') aiBuild(e.target.value); };
}



