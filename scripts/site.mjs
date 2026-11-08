import { build, context } from 'esbuild';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configScript, loadWebConfig } from './config.mjs';
import { rewriteAssetPaths, siteBase, stripSiteBase } from './paths.mjs';
import { extendLegacyContent } from './legacy-content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const demo = process.argv[2] === 'demo';
const dev = process.argv[2] === 'dev' || demo;
const out = path.join(root, dev ? '.dev' : 'dist');
const base = siteBase();
if (!(await readFile(path.join(root, 'index.html'), 'utf8')).includes('./assets/index-DJJMUmeZ.js')) throw new Error('Editor entry changed: update scripts/legacy-content.mjs before deployment.');
const options = {
  entryPoints: [path.join(root, 'src/cloud/app.js')],
  outfile: path.join(out, 'cloud/app.js'),
  bundle: true, format: 'esm', target: 'es2022', minify: !dev,
  sourcemap: dev ? 'inline' : false,
};

await mkdir(path.join(out, 'cloud'), { recursive: true });
const config = demo ? { apiKey: 'demo-key', authDomain: 'demo-slime-castle.firebaseapp.com', projectId: 'demo-slime-castle', storageBucket: 'demo-slime-castle.firebasestorage.app', messagingSenderId: '123', appId: '1:123:web:demo' } : await loadWebConfig({ required: !dev });
if (!dev) {
  await build(options);
  await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
  async function rewriteCopiedAssets(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await rewriteCopiedAssets(file);
      else if (/\.(?:js|css)$/.test(entry.name)) {
        const original = await readFile(file, 'utf8');
        await writeFile(file, rewriteAssetPaths(file.endsWith('index-DJJMUmeZ.js') ? extendLegacyContent(original) : original, base));
      }
    }
  }
  // The supplied React bundles hardcode their old repository path. Only rewrite
  // deployment copies, keeping the original assets and history untouched.
  await rewriteCopiedAssets(path.join(out, 'assets'));
  await cp(path.join(root, 'index.html'), path.join(out, 'index.html'));
  await cp(path.join(root, 'src/cloud/styles.css'), path.join(out, 'cloud/styles.css'));
  await cp(path.join(root, 'src/cloud/favicon.svg'), path.join(out, 'cloud/favicon.svg'));
  await writeFile(path.join(out, 'cloud/config.js'), configScript(config));
  console.log(`Built dist/ for GitHub Pages at ${base}. Firebase browser configuration is public in the published site.`);
} else {
  const builder = await context(options);
  await builder.watch();
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
  createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (base !== '/' && pathname === base.slice(0, -1)) {
        res.writeHead(302, { Location: base }); return res.end();
      }
      pathname = stripSiteBase(pathname, base);
      if (pathname === '/cloud/config.js') {
        res.writeHead(200, { 'Content-Type': mime['.js'], 'Cache-Control': 'no-store' });
        return res.end(configScript(config) + (demo ? 'window.__FIREBASE_EMULATORS__ = true;\n' : ''));
      }
      let file;
      if (pathname === '/cloud/app.js') file = options.outfile;
      else if (pathname === '/cloud/styles.css') file = path.join(root, 'src/cloud/styles.css');
      else if (pathname === '/cloud/favicon.svg') file = path.join(root, 'src/cloud/favicon.svg');
      else if (pathname === '/') file = path.join(root, 'index.html');
      else if (pathname.startsWith('/assets/')) {
        const assetRoot = path.join(root, 'assets');
        file = path.resolve(root, '.' + pathname);
        // Windows also treats backslashes as separators, even inside a decoded URL.
        if (!file.startsWith(assetRoot + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
      }
      else { res.writeHead(404); return res.end('Not found'); }
      // Never serve local configuration files, credentials, source files or dot directories.
      if (!file.startsWith(root) || pathname.split('/').some(part => part === '..')) {
        res.writeHead(403); return res.end('Forbidden');
      }
      if (!(await stat(file)).isFile()) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      const content = await readFile(file);
      res.end(/\.(?:js|css|html)$/.test(file) ? rewriteAssetPaths(file.endsWith('index-DJJMUmeZ.js') ? extendLegacyContent(content.toString('utf8')) : content.toString('utf8'), base) : content);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500);
      res.end('Unable to serve file');
    }
  }).listen(demo ? 5174 : 5173, '127.0.0.1', () => console.log(`http://127.0.0.1:${demo ? 5174 : 5173}${base}`));
}
