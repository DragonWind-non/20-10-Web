import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from '../server.js';

const serverPath = fileURLToPath(new URL('../server.js', import.meta.url));

async function startServer(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), '20-10-server-'));
  const publicRoot = path.join(root, 'public');
  await fs.mkdir(publicRoot);
  await fs.mkdir(path.join(root, 'private'));
  await fs.mkdir(path.join(root, 'public-neighbor'));
  await fs.mkdir(path.join(publicRoot, '.hidden'));
  await fs.writeFile(path.join(publicRoot, 'index.html'), '<h1>20/10</h1>');
  await fs.writeFile(path.join(publicRoot, 'nhạc.wav'), '0123456789');
  await fs.writeFile(path.join(publicRoot, 'empty.wav'), '');
  await fs.writeFile(path.join(publicRoot, '.env'), 'PRIVATE_FIXTURE=not-public');
  await fs.writeFile(path.join(root, 'private', 'secret.txt'), 'PRIVATE_FIXTURE=outside-public');
  await fs.writeFile(path.join(root, 'public-neighbor', 'secret.txt'), 'PRIVATE_FIXTURE=prefix-neighbor');
  await fs.writeFile(path.join(publicRoot, '.hidden', 'secret.txt'), 'PRIVATE_FIXTURE=hidden');
  await fs.symlink(path.join(root, 'private'), path.join(publicRoot, 'escape'), 'junction');
  await fs.symlink(path.join(root, 'public-neighbor'), path.join(publicRoot, 'prefix-escape'), 'junction');
  await fs.symlink(path.join(publicRoot, '.hidden'), path.join(publicRoot, 'hidden-alias'), 'junction');
  const server = createServer(publicRoot);
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    for (const link of ['escape', 'prefix-escape', 'hidden-alias']) await fs.unlink(path.join(publicRoot, link));
    assert.equal(path.dirname(root), os.tmpdir());
    assert.ok(path.basename(root).startsWith('20-10-server-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  return (url = '/nh%E1%BA%A1c.wav', headers = {}, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: url, headers, method, agent: false }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.setTimeout(3000, () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end();
  });
}

test('static files, query strings, missing files and HEAD remain available', async t => {
  const request = await startServer(t);
  assert.equal((await request('/?preview=1')).body, '<h1>20/10</h1>');
  const audio = await request();
  assert.equal(audio.status, 200);
  assert.equal(audio.headers['content-type'], 'audio/wav');
  assert.equal(audio.body, '0123456789');
  assert.equal((await request('/missing.wav')).status, 404);
  const head = await request(undefined, { Range: 'bytes=2-5' }, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.headers['content-length'], '10');
  assert.equal(head.body, '');
});

for (const [range, body, contentRange] of [
  ['bytes=0-3', '0123', 'bytes 0-3/10'],
  ['bytes=7-', '789', 'bytes 7-9/10'],
  ['bytes=-3', '789', 'bytes 7-9/10'],
  ['bytes=7-999', '789', 'bytes 7-9/10'],
  ['bytes=-999', '0123456789', 'bytes 0-9/10']
]) {
  test(`audio seek ${range} returns exactly the requested bytes`, async t => {
    const request = await startServer(t);
    const response = await request(undefined, { Range: range });
    assert.equal(response.status, 206);
    assert.equal(response.headers['content-range'], contentRange);
    assert.equal(response.headers['content-length'], String(body.length));
    assert.equal(response.body, body);
  });
}

for (const range of ['bytes=abc', 'bytes=-', 'bytes=6-2', 'bytes=10-', 'bytes=-0', 'bytes=9007199254740992-']) {
  test(`invalid or unsatisfiable ${range} cannot stop the server`, async t => {
    const request = await startServer(t);
    const response = await request(undefined, { Range: range });
    assert.equal(response.status, 416);
    assert.equal(response.headers['content-range'], 'bytes */10');
    assert.equal((await request('/')).status, 200);
  });
}

test('an empty audio file cannot produce an invalid stream range', async t => {
  const request = await startServer(t);
  assert.equal((await request('/empty.wav', { Range: 'bytes=0-' })).status, 416);
  assert.equal((await request('/')).status, 200);
});

test('unsupported range units and multiple ranges fall back to the full file', async t => {
  const request = await startServer(t);
  for (const range of ['items=0-3', 'bytes=0-1,5-6']) {
    const response = await request(undefined, { Range: range });
    assert.equal(response.status, 200);
    assert.equal(response.body, '0123456789');
  }
});

for (const url of ['/%', '/%E0%A4%A', '/%00']) {
  test(`malformed URL ${url} returns 400 and the server stays available`, async t => {
    const request = await startServer(t);
    assert.equal((await request(url)).status, 400);
    assert.equal((await request('/')).status, 200);
  });
}

test('private files must never be served', async t => {
  const request = await startServer(t);
  for (const url of ['/.env', '/.git/config', '/server.js', '/package.json', '/tests/test-server.js',
    '/docs/SECURITY.md', '/../private/secret.txt', '/%2e%2e/private/secret.txt', '/%2eenv',
    '/escape/secret.txt', '/prefix-escape/secret.txt', '/hidden-alias/secret.txt', '/%252eenv']) {
    const response = await request(url);
    assert.equal(response.status, 404, url);
    assert(!response.body.includes('PRIVATE_FIXTURE'), url);
  }
  for (const url of ['/..%5cprivate%5csecret.txt', '/index.html::$DATA']) {
    assert.equal((await request(url)).status, 400, url);
  }
  assert.equal((await request('/')).status, 200);
});

test('only GET and HEAD are supported', async t => {
  const request = await startServer(t);
  const response = await request('/', {}, 'POST');
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, 'GET, HEAD');
});

test('security headers also cover errors and range responses', async t => {
  const request = await startServer(t);
  for (const response of [await request('/'), await request('/missing'), await request(undefined, { Range: 'bytes=0-3' })]) {
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['x-frame-options'], 'DENY');
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert(response.headers['content-security-policy'].includes("script-src 'self'"));
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  }
});

test('CLI serves the project public directory even when started from another working directory', async t => {
  const child = spawn(process.execPath, [serverPath], {
    cwd: os.tmpdir(), env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, 'close');
      child.kill();
      await closed;
    }
  });
  const output = await Promise.race([
    once(child.stdout, 'data').then(([chunk]) => chunk.toString()),
    once(child, 'exit').then(() => { throw new Error('CLI exited before listening'); })
  ]);
  const url = /http:\/\/127\.0\.0\.1:\d+/.exec(output)?.[0];
  assert(url, output);
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert((await response.text()).includes('lang="vi"'));
  assert.equal((await fetch(`${url}/server.js`)).status, 404);
});
