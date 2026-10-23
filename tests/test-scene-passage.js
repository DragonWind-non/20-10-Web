import assert from 'node:assert/strict';
import { PASSAGE, samplePassage } from '../public/js/scene-transition.js';

for (let t = -0.1; t <= PASSAGE.duration+0.1; t += 0.001) {
  for (const value of Object.values(samplePassage(t))) {
    assert(Number.isFinite(value) && value >= -1e-10 && value <= 1+1e-10);
  }
}
assert.equal(samplePassage(0).weight, 0);
assert.equal(samplePassage(PASSAGE.duration).weight, 0);
assert.equal(samplePassage(PASSAGE.duration).grip, 0);
assert.equal(samplePassage(1.6).grip, 1);
assert.equal(samplePassage(PASSAGE.clasp).grip, 1, 'Join hands before travelling');
assert.equal(samplePassage(PASSAGE.clasp).depart, 0, 'Do not leave before the clasp');
assert.equal(samplePassage(PASSAGE.exit).depart, 1, 'Both robots must leave before the liquid effect');
assert.equal(samplePassage(PASSAGE.exit).arrive, 0, 'Do not arrive before the scene changes');
assert.equal(samplePassage(PASSAGE.enter).arrive, 0);
assert.equal(samplePassage(PASSAGE.arrive).arrive, 1);
assert(samplePassage(PASSAGE.arrive).grip > 0.8, 'Keep holding hands on arrival');
const step = 0.0001;
assert(samplePassage(step).weight/step < 0.01, 'The takeoff must start without a velocity jump');
assert(samplePassage(PASSAGE.duration-step).weight/step < 0.01, 'The landing must settle without a velocity jump');
console.log('PASS: bounded curves, clasp before departure, exit before liquid, arrival and smooth endpoints');
