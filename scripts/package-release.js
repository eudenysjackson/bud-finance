// Build an isolated public artifact; never upload the repository root.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist', 'site');
if (fs.existsSync(output)) throw new Error('dist/site already exists. Review or move the previous artifact before packaging again.');
const extensions = new Set(['.html','.js','.css','.json','.png','.jpg','.jpeg','.webp','.svg','.ico','.woff','.woff2','.ttf']);
function copy(relative) {
  const source = path.join(root, relative);
  if (fs.lstatSync(source).isSymbolicLink()) throw new Error('Symbolic links are not allowed: ' + relative);
  if (fs.statSync(source).isDirectory()) {
    for (const name of fs.readdirSync(source)) {
      if (name.startsWith('.') || name === 'email-templates') continue;
      copy(path.join(relative, name));
    }
    return;
  }
  if (!extensions.has(path.extname(relative)) && !['CNAME', 'robots.txt', 'sitemap.xml'].includes(relative)) return;
  if (/\.example\.|preview-temas\.html$|gerar-icones\.html$/.test(relative)) return;
  const target = path.join(output, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
for (const relative of ['index.html','logo.png','CNAME','robots.txt','sitemap.xml','appbudfinance','budfinance','site-assets','servicos','sobre','produtos','contato']) copy(relative);
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log('Public artifact ready: dist/site (frontend only).');
