// tests/verify-audio.js
import assert from 'assert';
import { AudioManager } from '../public/js/audio-manager.js';

console.log('Testing AudioManager class interface...');

// Mock browser globals for Node test environment
global.window = { AudioContext: null };
global.Audio = class {
  constructor() {
    this.src = '';
    this.currentTime = 0;
  }
  addEventListener() {}
  play() { return Promise.resolve(); }
  pause() {}
};

const audioMgr = new AudioManager();
assert(typeof audioMgr.init === 'function', 'init must be a function');
assert(typeof audioMgr.play === 'function', 'play must be a function');
assert(typeof audioMgr.pause === 'function', 'pause must be a function');
assert(typeof audioMgr.next === 'function', 'next must be a function');
assert(typeof audioMgr.prev === 'function', 'prev must be a function');
assert(typeof audioMgr.onLyricChange === 'function', 'onLyricChange must be a function');
assert(typeof audioMgr.onBeat === 'function', 'onBeat must be a function');
assert(typeof audioMgr.getCurrentTime === 'function', 'getCurrentTime must be a function');

console.log('PASS: AudioManager interface verified!');
