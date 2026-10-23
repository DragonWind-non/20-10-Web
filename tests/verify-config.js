// tests/verify-config.js
import assert from 'assert';
import { CONFIG } from '../public/config.js';

console.log('Testing CONFIG schema...');

assert(CONFIG, 'CONFIG must be defined');
assert(typeof CONFIG.recipientName === 'string' && CONFIG.recipientName.length > 0, 'recipientName must be non-empty string');
assert(CONFIG.seasons, 'seasons must be defined');
assert(CONFIG.seasons.stage1 && CONFIG.seasons.stage1.dialogue, 'stage1 must have dialogue');
assert(CONFIG.seasons.stage2 && CONFIG.seasons.stage2.dialogue, 'stage2 must have dialogue');
assert(CONFIG.seasons.stage3 && CONFIG.seasons.stage3.dialogue, 'stage3 must have dialogue');
assert(CONFIG.seasons.stage4 && CONFIG.seasons.stage4.dialogue, 'stage4 must have dialogue');
assert(CONFIG.seasons.stage5 && CONFIG.seasons.stage5.dialogue, 'stage5 must have dialogue');
for (const stage of [2, 3, 4, 5]) {
  const season = CONFIG.seasons[`stage${stage}`];
  assert.equal(season.poem.split('\n').length, 2, `stage${stage} must have a two-line poem`);
  assert(season.wish.length > 200, `stage${stage} must include the full seasonal wish`);
}
assert.equal(CONFIG.seasons.stage1.poem, undefined, 'The opening must not gain a seasonal poem');
assert.equal(CONFIG.seasons.stage1.wish, undefined, 'The opening must not gain a seasonal wish');

assert(Array.isArray(CONFIG.playlist) && CONFIG.playlist.length >= 2, 'playlist must have at least 2 songs');
CONFIG.playlist.forEach((song, idx) => {
  assert(song.id, `song[${idx}] must have an id`);
  assert(song.title, `song[${idx}] must have a title`);
  assert(song.artist, `song[${idx}] must have an artist`);
  assert(song.src, `song[${idx}] must have a src`);
  assert(Array.isArray(song.lyrics), `song[${idx}] must have a lyrics array`);
});

assert(Array.isArray(CONFIG.wishesStream) && CONFIG.wishesStream.length >= 3, 'wishesStream must contain at least 3 wishes');

console.log('PASS: CONFIG schema is valid and complete!');
