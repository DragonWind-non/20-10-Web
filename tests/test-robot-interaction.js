import assert from 'node:assert/strict';
import { holdHands, releaseHands, updateHands } from '../public/js/robot-interaction.js';

const pair = () => {
  const robot = () => ({ emotion: 'idle', handHoldProgress: 0, scanBeam: {}, setEmotion(value) { this.emotion = value; }, triggerHeartBounce() {} });
  const wall = robot(), eve = robot();
  eve.stage = 2;
  return [wall, eve];
};

for (const fps of [30, 60, 120]) {
  const [wall, eve] = pair();
  holdHands(wall, eve, 1.6);
  let previous = 0, maximumStep = 0, releaseStarted = false;
  for (let frame = 0; frame < fps * 5; frame++) {
    updateHands(wall, eve, 1 / fps);
    assert.equal(wall.handHoldProgress, eve.handHoldProgress, 'Both robots share one gesture phase');
    maximumStep = Math.max(maximumStep, Math.abs(previous - eve.handHoldProgress));
    if (frame > fps * 1.7 && eve.handHoldProgress > 0) releaseStarted = true;
    previous = eve.handHoldProgress;
  }
  assert(releaseStarted, 'Expiration must release gradually instead of resetting the pose');
  assert(maximumStep < 0.19, 'A frame must not jump from contact to rest');
  assert.equal(wall.handHoldProgress, 0);
  assert.equal(eve.emotion, 'normal');
}
const [wall, eve] = pair();
holdHands(wall, eve);
updateHands(wall, eve, 0.8);
const before = wall.handHoldProgress;
releaseHands(wall, eve);
assert.equal(wall.handHoldProgress, before, 'Interrupting a gesture must retain its current pose');
updateHands(wall, eve, 1 / 60);
assert(wall.handHoldProgress > 0 && wall.handHoldProgress < before);
holdHands(wall, eve);
eve.stage = 6;
updateHands(wall, eve, 0.1, true);
assert.equal(wall.handHoldProgress, 0);
assert(!eve.isHoldingHands);
console.log('PASS: shared gesture timing, continuous release, interruption and reduced motion');
