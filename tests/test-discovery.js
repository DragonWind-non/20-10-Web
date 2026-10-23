import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window: { addEventListener() {} }, holdHands() {}, releaseHands() {} };
const source = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '');
vm.runInNewContext(`${source}\nglobalThis.App = App;`, context);
const makeApp = () => {
  const app = Object.create(context.App.prototype);
  Object.assign(app, {
    stage: 1, ambientTimer: 12, ambientAction: 0, motionQuery: { matches: false },
    touchNavigation: { isActive: () => false }, sceneTransition: { active: false },
    wallE: { pointerAge: 0, handHoldProgress: 0, swimState: 'none', motion: { spinTime: -1 } },
    eve: { pointerAge: 0, motion: { spinTime: -1 } },
    roseGift: { wait: 8, active: false, start() { this.active = true; return true; } },
    pairMoments: { wait: 9, round: 0, start() { this.active = true; return true; } }
  });
  return app;
};

const app = makeApp();
for (let i = 0; i < 79; i++) app.updateAmbientInteraction(.1);
assert.equal(app.roseGift.active, false, 'Do not interrupt the opening immediately');
app.updateAmbientInteraction(.1);
app.updateAmbientInteraction(.1);
assert.equal(app.roseGift.active, true, 'Show the flower after eight seconds despite pointer movement');
assert.equal(app.pairMoments.active, undefined, 'The flower precedes other automatic scenes');

const requested = makeApp();
requested.roseRequested = true;
requested.roseGift.wait = 0;
requested.wallE.handHoldProgress = .5;
requested.updateAmbientInteraction(.1);
assert.equal(requested.roseGift.active, false, 'Wait for the existing pose to release smoothly');
requested.wallE.handHoldProgress = 0;
requested.updateAmbientInteraction(.1);
assert.equal(requested.roseGift.active, true);
assert.equal(requested.roseRequested, false);

for (const blocker of ['motion', 'transition', 'touch', 'finale']) {
  const blocked = makeApp();
  if (blocker === 'motion') blocked.motionQuery.matches = true;
  if (blocker === 'transition') blocked.sceneTransition.active = true;
  if (blocker === 'touch') blocked.touchNavigation.isActive = () => true;
  if (blocker === 'finale') blocked.stage = 6;
  blocked.updateAmbientInteraction(30);
  assert.equal(blocked.roseGift.wait, 8, `Keep the flower paused during ${blocker}`);
  assert.equal(blocked.roseGift.active, false);
}
console.log('PASS: early flower priority, pointer independence, queued replay and motion/navigation guards');
