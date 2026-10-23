import assert from 'node:assert/strict';
import { AudioManager } from '../public/js/audio-manager.js';

const lyrics = [
  { time: 2, text: 'Line 1' },
  { time: 5.5, text: 'Line 2' },
  { time: 10, text: 'Line 3' }
];
const updates = [];
const audio = Object.create(AudioManager.prototype);
audio.getCurrentTrack = () => ({ lyrics });
audio.lyricListeners = [update => updates.push(update)];
audio.beatListeners = [];
audio.currentLyricIndex = -2;

for (const [time, index, next] of [[1, -1, 0], [2, 0, 1], [6, 1, 2], [12, 2, -1], [0, -1, 0]]) {
  audio.checkLyrics(time);
  assert.deepEqual(updates.at(-1), {
    activeLine: lyrics[index] ?? null,
    nextLine: lyrics[next] ?? null,
    prevLine: index > 0 ? lyrics[index - 1] : null,
    index
  });
}
const count = updates.length;
audio.checkLyrics(0.5);
assert.equal(updates.length, count, 'Do not notify the same lyric twice');
audio.getCurrentTrack = () => ({ lyrics: [] });
audio.checkLyrics(100);
assert.equal(updates.length, count, 'An empty track does not emit a lyric');

let scheduledFrames = 0;
globalThis.requestAnimationFrame = () => { scheduledFrames++; };
audio.startAnimationLoop();
audio.startAnimationLoop();
assert.equal(scheduledFrames, 1, 'Unlocking audio twice must not duplicate beat and lyric updates');
console.log('PASS: actual lyric boundaries, seeking backwards, empty tracks, deduplication and one animation loop');
