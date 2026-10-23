import assert from 'node:assert/strict';
import { WallERobot } from '../public/js/wall-e.js';

const robot = Object.assign(Object.create(WallERobot.prototype), {
  heartMesh: { visible: true },
  handHold: { active: true },
  partner: { isHoldingHands: true },
  isHoldingHands: true,
  swimState: 'moving',
  joyWiggleTime: 1,
  fitToViewport() {}
});
robot.setEmotion('blush');
assert.equal(robot.blushOpacity, 1);
robot.setEmotion('wink');
assert(robot.winkTime > 0);
robot.setEmotion('sleep');
assert.equal(robot.heartMesh.visible, false);
assert.equal(robot.handHold.active, false);
assert.equal(robot.isHoldingHands, false);
assert.equal(robot.partner.isHoldingHands, false);
assert.equal(robot.swimState, 'none');
assert.equal(robot.joyWiggleTime, 0);
robot.setEmotion('happy');
assert.equal(robot.heartMesh.visible, true);
assert.equal(robot.winkTime, 0);
console.log('PASS: actual WALL-E emotions, sleep interruption and wake-up state');
