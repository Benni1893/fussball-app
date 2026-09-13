/* Kleiner Dateiserver auf dem Repo-Wurzelverzeichnis. Liefert sowohl die App
   (index.html, app.js, styles.css) als auch die Vorlage aus .design-sync/.
   So wird der ARBEITSSTAND gemessen, nicht das letzte Deployment.            */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript',
               '.mjs':'text/javascript', '.png':'image/png', '.json':'application/json',
               '.svg':'image/svg+xml', '.ico':'image/x-icon' };

export async function starte(root = process.cwd()) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    // assets/ liegt im Wurzelverzeichnis, die Vorlage zwei Ebenen tiefer.
    rel = rel.replace(/^\.design-sync\/concepts\/assets\//, 'assets/');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('nicht gefunden'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
                         'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return { server, port, basis: `http://127.0.0.1:${port}/` };
}
