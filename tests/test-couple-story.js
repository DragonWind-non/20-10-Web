import assert from 'node:assert/strict';
import { PAIR_MOMENTS, samplePairMoment } from '../public/js/pair-moments.js';
import { LunarBloom, sampleLunarBloom } from '../public/js/lunar-bloom.js';

for (const [kind, { duration }] of Object.entries(PAIR_MOMENTS)) {
  let previous;
  for (let time = -.1; time < duration+.1; time += 1/120) {
    const cue = samplePairMoment(kind, time);
    for (const [key, value] of Object.entries(cue)) {
      assert(Number.isFinite(value) && value >= -1e-10 && value <= 1+1e-10);
      if (previous) assert(Math.abs(value-previous[key]) < .025, `${kind} ${key} jumps`);
    }
    previous = cue;
  }
  assert.equal(samplePairMoment(kind, 0).weight, 0);
  assert.equal(samplePairMoment(kind, duration).weight, 0);
  for (let time = 4.8; time <= 5.6; time += .01) {
    assert.equal(samplePairMoment(kind, time).touch, 1, 'Keep contact throughout the handoff');
  }
}
assert.equal(sampleLunarBloom(5.2).sprout, 0, 'Plant before sprouting');
assert.equal(sampleLunarBloom(7.1).flower, 0, 'Grow a stem before opening petals');
assert.equal(sampleLunarBloom(14).lean, 0, 'Let the bloom finish before resting');
assert.equal(sampleLunarBloom(18).wave, 0, 'The climax must settle rather than loop');
const state = {
  finale: { wallE: { isTravelling: true }, eve: { isTravelling: false } },
  phase: 'arrival', age: 0, time: 0, button: {}, story: {}, showWishes() { this.revealed = true; }
};
LunarBloom.prototype.advance.call(state, 20, false);
assert.equal(state.age, 0, 'The arrival passage owns the opening');
state.finale.wallE.isTravelling = false;
LunarBloom.prototype.advance.call(state, 6, false);
assert.equal(state.phase, 'ready');
LunarBloom.prototype.advance.call(state, 60, false);
assert.equal(state.time, 0, 'Wait for the viewer instead of sending their wish automatically');
state.phase = 'growing';
state.time = 8;
state.finale.wallE.isTravelling = true;
assert.equal(LunarBloom.prototype.advance.call(state, 20, false).flower, sampleLunarBloom(8).flower);
assert.equal(state.time, 8, 'Keep the visible bloom when a departure interrupts the story');
state.finale.wallE.isTravelling = false;
LunarBloom.prototype.advance.call(state, 18, false);
assert.equal(state.phase, 'settled');
assert(state.revealed);
LunarBloom.prototype.advance.call(state, 60, false);
assert.equal(state.time, 18, 'Never loop the finale without a new visit');
console.log('PASS: continuous paired poses, contact before handoff, causal bloom, arrival guard and one-shot finale');
