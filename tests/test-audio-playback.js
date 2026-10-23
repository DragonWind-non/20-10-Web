import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { AudioManager } from '../public/js/audio-manager.js';
import { CONFIG } from '../public/config.js';

globalThis.Audio = class extends EventTarget {
  src = ''; currentTime = 0; paused = true; requests = [];
  play() {
    this.paused = false;
    return new Promise((resolve, reject) => this.requests.push({ resolve, reject }));
  }
  pause() { this.paused = true; }
};
const audio = new AudioManager(), media = audio.audioElement;
assert.deepEqual(CONFIG.playlist.map(t => t.src), [
  'assets/audio/mashup-5in1.m4a', 'assets/audio/dung-lam-trai-tim-anh-dau.m4a'
]);
for (const track of CONFIG.playlist) {
  const file = new URL('../public/'+track.src, import.meta.url);
  assert(existsSync(file));
  const bytes = readFileSync(file), movie = bytes.indexOf('mvhd');
  assert(movie >= 0 && movie < bytes.indexOf('mdat'), 'Playback duration must be available before audio data');
  assert.equal(bytes[movie+4], 0, 'These tracks use the version-zero movie header');
  assert(bytes.readUInt32BE(movie+20) / bytes.readUInt32BE(movie+16) > 240,
    'Both complete songs must expose their four-minute duration, not a ten-second DASH fragment');
}
assert.equal(audio.getCurrentTrack(), CONFIG.playlist[0]);
audio.play();
assert.equal(media.src, CONFIG.playlist[0].src);
assert(audio.isPlaying);
audio.next();
media.requests[0].reject(new Error('Previous load aborted'));
await Promise.resolve();
assert(audio.isPlaying && !media.paused, 'Old play rejection must not stop the new song');
media.requests[1].resolve();
assert.equal(audio.currentIndex, 1);
media.dispatchEvent(new Event('ended'));
assert.equal(audio.currentIndex, 0, 'The last song loops to Mashup');
audio.prev();
assert.equal(audio.currentIndex, 1);
audio.pause();
media.requests.at(-1).resolve();
await Promise.resolve();
assert(!audio.isPlaying && media.paused, 'A pending play must not undo pause');
media.currentTime = 12;
assert(audio.togglePlay(), 'Resume reports the intended state immediately');
assert.equal(audio.getCurrentTime(), 12, 'Resume keeps the media position');
const warn = console.warn;
console.warn = () => {};
media.requests.at(-1).reject(new Error('Playback blocked'));
await Promise.resolve();
assert(!audio.isPlaying && media.paused, 'Failed playback stops instead of generating other music');
audio.play();
media.dispatchEvent(new Event('error'));
assert(!audio.isPlaying && media.paused);
console.warn = warn;
console.log('PASS: two real tracks, Mashup default, wrap, resume, cancellation and media errors');
