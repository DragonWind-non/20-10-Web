import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../public/config.js';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const files = await readdir(root, { recursive: true, withFileTypes: true });
for (const file of files) {
  assert(!file.name.startsWith('.'), `Hidden file in public: ${file.name}`);
  assert(!file.isSymbolicLink(), `Symlink in public: ${file.name}`);
}

// Walk actual imports so a moved or unused runtime module cannot silently pass.
const visited = new Set();
async function visit(file) {
  if (visited.has(file)) return;
  const relative = path.relative(root, file);
  assert(!relative.startsWith('..') && !path.isAbsolute(relative), file);
  visited.add(file);
  const source = await readFile(file, 'utf8');
  for (const [, specifier] of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
    assert(specifier.startsWith('.'), `External module: ${specifier}`);
    await visit(path.resolve(path.dirname(file), specifier));
  }
}
await visit(path.join(root, 'js/app.js'));
for (const file of await readdir(path.join(root, 'js'))) {
  if (file.endsWith('.js')) assert(visited.has(path.join(root, 'js', file)), `Unused module: ${file}`);
}

const html = await readFile(path.join(root, 'index.html'), 'utf8');
for (const [, reference] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (reference.startsWith('https://')) continue;
  assert(!reference.startsWith('/'), `Keep hosting under a repository path working: ${reference}`);
  await readFile(path.join(root, reference));
}
assert(!html.includes('facebook.com/'), 'Personal profile must not be included in the public template');
for (const track of CONFIG.playlist) await readFile(path.join(root, track.src));
assert.equal(createHash('sha256').update(await readFile(path.join(root, 'vendor/three.min.js'))).digest('hex'),
  '9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2', 'Keep the verified Three.js r128 build intact');
console.log('PASS: all runtime imports and page assets resolve; no unused modules or hidden public files');
