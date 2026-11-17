// Bundles src/ into one self-contained page: dist/index.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';

const out = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true,
  format: 'esm', target: 'es2022', write: false
});
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = readFileSync('src/index.template.html', 'utf8')
  .replace('<script>/*BUNDLE*/</script>', '<script type="module">/*BUNDLE*/</script>')
  .replace('/*BUNDLE*/', () => js);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
cpSync('public', 'dist', { recursive: true });   // manifest, service worker, icons
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);
