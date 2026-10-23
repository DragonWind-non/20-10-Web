import assert from 'node:assert/strict';
import { getStageArea, fitRobotLayout, fitSleepingRobotLayout } from '../public/js/scene-layout.js';

for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
  globalThis.innerWidth = width;
  globalThis.innerHeight = height;
  globalThis.document = {
    body: { dataset: { stage: '2' } },
    getElementById: () => null,
    querySelector: () => null
  };
  const area = getStageArea();
  assert(area.width > 0 && area.height > 0);
  assert(area.left >= 0 && area.top >= 0);
  for (const eve of [false, true]) {
    const robot = { layout: {} };
    fitRobotLayout(robot, eve);
    for (const value of Object.values(robot.layout)) assert(Number.isFinite(value));
    assert(robot.layout.pixels > 0);
    assert(robot.layout.roamX >= 0 && robot.layout.roamY >= 0);
    fitSleepingRobotLayout(robot, eve);
    assert.equal(robot.layout.roamX, 0);
    assert.equal(robot.layout.roamY, 0);
  }
}
const robot = { layout: {}, finaleLayout: { x: 0.6, y: -0.5, pixels: 100 } };
fitSleepingRobotLayout(robot);
assert.deepEqual(robot.layout, robot.finaleLayout);
console.log('PASS: actual responsive layout stays finite and sleeping poses stop roaming');
