// Joins src/parts/*.js (in name order, one shared scope) and bundles into one self-contained page: dist/index.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'node:fs';

const parts = readdirSync('src/parts').filter(f => f.endsWith('.js')).sort();
const source = parts.map(f => `// ---- ${f} ----\n` + readFileSync(`src/parts/${f}`, 'utf8')).join('\n');
const out = await build({
  stdin: { contents: source, resolveDir: 'src', sourcefile: 'game.js', loader: 'js' },
  bundle: true, minify: true, format: 'esm', target: 'es2022', write: false
});
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = readFileSync('src/index.template.html', 'utf8')
  .replace('<script>/*BUNDLE*/</script>', '<script type="module">/*BUNDLE*/</script>')
  .replace('/*BUNDLE*/', () => js);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
cpSync('public', 'dist', { recursive: true });   // manifest, service worker, icons
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB  (${parts.length} parts)`);
