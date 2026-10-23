import assert from 'node:assert/strict';
import { sampleRoseGesture } from '../public/js/rose-gift.js';

for (const fps of [30, 60, 120]) {
  let previous = sampleRoseGesture(0);
  for (let frame = 1; frame <= 22 * fps; frame++) {
    const pose = sampleRoseGesture(frame / fps);
    for (const key of ['weight', 'reach', 'offer', 'accept', 'receive', 'kiss', 'joy', 'join', 'wallBlush', 'eveBlush']) {
      assert.ok(pose[key] >= 0 && pose[key] <= 1, `${key} must stay bounded`);
      assert.ok(Math.abs(pose[key] - previous[key]) * fps < 3, `${key} has a discontinuous cue`);
    }
    previous = pose;
  }
}
assert.equal(sampleRoseGesture(0).weight, 0);
assert.equal(sampleRoseGesture(7.8).join, 1, 'Hands must meet at the flower handoff');
assert.equal(sampleRoseGesture(7.79).owner, 'wall');
assert.equal(sampleRoseGesture(7.8).owner, 'eve');
assert.equal(sampleRoseGesture(11.9).kiss, 1);
assert.equal(sampleRoseGesture(11.9).joy, 0, 'Joy must follow the kiss');
assert.equal(sampleRoseGesture(16).joy, 1);
assert.equal(sampleRoseGesture(21).weight, 0);
console.log('PASS rose cue order, bounded envelopes and continuity at 30/60/120 fps');
