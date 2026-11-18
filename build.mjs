// Builds one self-contained page (dist/index.html):
//   src/parts/*.js   joined in name order (one shared scope) and bundled with esbuild
//   src/styles/*.css joined in name order, with the bundled font inlined
// plus the static files in public/ (manifest, service worker, icons, tester pages).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const git = cmd => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return ''; } };
const BUILD = { version: pkg.version, build: git('git rev-list --count HEAD') || '0', commit: git('git rev-parse --short HEAD') || 'dev', date: new Date().toISOString().slice(0, 10) };
const prod = process.env.NODE_ENV !== 'development';

const parts = readdirSync('src/parts').filter(f => f.endsWith('.js')).sort();
const source = parts.map(f => `// ---- ${f} ----\n` + readFileSync(`src/parts/${f}`, 'utf8')).join('\n');
const out = await build({
  stdin: { contents: source, resolveDir: 'src', sourcefile: 'game.js', loader: 'js' },
  bundle: true, minify: prod, format: 'esm', target: 'es2022', write: false,
  define: { __BUILD__: JSON.stringify(BUILD) }
});
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');

const font = w => readFileSync(`node_modules/@fontsource/nunito/files/nunito-latin-${w}-normal.woff2`).toString('base64');
const fontCss = [700, 800, 900].filter(w => { try { font(w); return true; } catch (e) { return false; } })
  .map(w => `@font-face{font-family:'Nunito';font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${font(w)}) format('woff2')}`).join('\n');
const css = fontCss + '\n' + readdirSync('src/styles').filter(f => f.endsWith('.css')).sort().map(f => readFileSync(`src/styles/${f}`, 'utf8')).join('\n');

const html = readFileSync('src/index.template.html', 'utf8')
  .replace('/*STYLES*/', () => css)
  .replace('<script>/*BUNDLE*/</script>', '<script type="module">/*BUNDLE*/</script>')
  .replace('/*BUNDLE*/', () => js);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
cpSync('public', 'dist', { recursive: true });
writeFileSync('dist/version.json', JSON.stringify(BUILD));
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB  (${parts.length} parts)  v${BUILD.version} (${BUILD.build})`);
