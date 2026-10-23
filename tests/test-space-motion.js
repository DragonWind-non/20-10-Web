import assert from 'node:assert/strict';
import { SpaceMotion } from '../public/js/space-motion.js';

function seeded() {
  let seed = 38;
  return () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
}

(async () => {
  const run = fps => {
    const motion = new SpaceMotion(seeded());
    let maxRoll = 0, distance = 0, minYaw = Infinity, maxYaw = -Infinity;
    for (let i = 0; i < fps * 60; i++) {
      motion.update(1 / fps, false, false);
      for (const value of Object.values(motion.position)) assert(Number.isFinite(value) && Math.abs(value) <= 1);
      maxRoll = Math.max(maxRoll, Math.abs(motion.roll));
      distance += Math.abs(motion.velocity.x) / fps;
      assert(Number.isFinite(motion.yaw), 'Free drift must carry a finite whole-body heading');
      minYaw = Math.min(minYaw, motion.yaw);
      maxYaw = Math.max(maxYaw, motion.yaw);
    }
    assert(maxRoll > 6.1, 'Occasional roll must finish a full turn');
    assert(distance > 1, 'Inertia must carry the robot through different positions');
    assert(maxYaw - minYaw > 1, 'Free drift must turn sideways and away from the camera');
    return motion;
  };
  const slow = run(30), fast = run(120);
  assert(Math.abs(slow.position.x - fast.position.x) < 0.02, 'Drift must be frame-rate independent');
  assert(Math.abs(slow.roll - fast.roll) < 0.05, 'Roll must be frame-rate independent');
  assert(Math.abs(slow.yaw - fast.yaw) < 0.05, 'Heading must be frame-rate independent');
  slow.update(900, false, false);
  assert(Number.isFinite(slow.position.x) && Math.abs(slow.position.x) <= 1);
  slow.kick(0.3, -0.2);
  assert(slow.velocity.x > 0);
  slow.update(0.1, true, false);
  assert.deepEqual(slow.position, { x: 0, y: 0, z: 0 });
  assert.equal(slow.roll, 0);
  assert.equal(slow.yaw, 0);
  fast.kick(0.2, 0.2);
  for (let i = 0; i < 360; i++) fast.update(1 / 60, false, true);
  assert(Math.hypot(fast.position.x, fast.position.y, fast.position.z) < 0.01, 'Sleep must settle');
  assert(Math.abs(fast.roll) < 0.01);
  assert(Math.abs(fast.yaw) < 0.01, 'Sleep must settle the whole-body heading');
  console.log('PASS: bounded inertia, full rolls, frame rates, long delta, reduced motion and sleep');
})().catch(error => { console.error(error); process.exitCode = 1; });
