import http from 'node:http';
import fs from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_ROOT = fileURLToPath(new URL('./public/', import.meta.url));
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

export function createServer(root = PUBLIC_ROOT) {
  root = fs.realpathSync(root);
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");

    const fail = (status, message) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : message);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      fail(405, '405 Method Not Allowed');
      return;
    }

    let reqPath;
    try {
      reqPath = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      fail(400, '400 Bad Request');
      return;
    }
    if (!reqPath.startsWith('/') || /[\0\\:*?"<>|]/.test(reqPath)) {
      fail(400, '400 Bad Request');
      return;
    }
    if (reqPath.split('/').some(part => part.startsWith('.'))) {
      fail(404, '404 Not Found');
      return;
    }
    if (reqPath === '/') reqPath = '/index.html';

    let handle;
    try {
      const filePath = await realpath(path.join(root, reqPath));
      const relativePath = path.relative(root, filePath);
      // Resolve symlinks/junctions before checking the public boundary.
      if (relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)
        || relativePath.split(path.sep).some(part => part.startsWith('.'))) {
        fail(404, '404 Not Found');
        return;
      }
      const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()];
      if (!contentType) {
        fail(404, '404 Not Found');
        return;
      }
      handle = await open(filePath, 'r');
      const stats = await handle.stat();
      if (!stats.isFile()) {
        fail(404, '404 Not Found');
        return;
      }

      const range = req.method === 'GET' ? req.headers.range : undefined;
      let start = 0;
      let end = stats.size - 1;
      let status = 200;
      // shortcut: multiple ranges use a full response; add multipart only if a client needs it.
      if (range && /^bytes=/i.test(range) && !range.includes(',')) {
        const parts = /^bytes=(\d*)-(\d*)$/i.exec(range);
        start = NaN;
        if (parts && (parts[1] || parts[2])) {
          start = parts[1] ? Number(parts[1]) : Math.max(0, stats.size - Number(parts[2]));
          if (parts[1] && parts[2]) end = Math.min(Number(parts[2]), end);
        }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stats.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${stats.size}`, 'Content-Length': 0 });
          res.end();
          return;
        }
        status = 206;
      }

      res.writeHead(status, {
        'Content-Length': status === 206 ? end - start + 1 : stats.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${stats.size}` } : {})
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const file = handle.createReadStream(status === 206 ? { start, end } : {});
      handle = undefined;
      file.on('error', () => res.destroy());
      res.on('close', () => file.destroy());
      file.pipe(res);
    } catch (error) {
      if (res.headersSent) res.destroy();
      else if (['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'ELOOP'].includes(error.code)) fail(404, '404 Not Found');
      else fail(500, '500 Internal Server Error');
    } finally {
      if (handle) await handle.close();
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535');
  const server = createServer();
  server.on('error', error => {
    console.error(`[Server 20/10] ${error.code}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`[Server 20/10] http://127.0.0.1:${server.address().port}`);
  });
}
