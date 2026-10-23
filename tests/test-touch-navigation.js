import assert from 'node:assert/strict';
import { bindTouchNavigation, swipeDirection } from '../public/js/touch-navigation.js';

for (const [dx, dy, expected] of [[-90,8,1],[90,-8,-1],[8,-90,1],[-8,90,-1],[-47,0,0],[-70,65,0],[0,0,0]]) {
  assert.equal(swipeDirection(dx, dy), expected);
}
const handlers = {}, taps = [], swipes = [];
const target = (control = false, reading = false) => ({ closest: selector =>
  selector.startsWith('.narrative-card') ? reading : control });
const background = target(), card = target(false, true), button = target(true);
const touch = bindTouchNavigation({ addEventListener: (type, callback) => handlers[type] = callback }, {
  onTap: (x, y) => taps.push([x, y]), onSwipe: d => swipes.push(d),
  isControlTarget: el => el !== background
});
function event(type, x, y, el = background, extras = {}) {
  handlers[type]({ clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true, target: el, ...extras });
}
event('pointerdown', 100, 100);
event('pointerup', 104, 108);
assert.deepEqual(taps, [[104,108]], 'A tap works without a compatibility click');
assert(touch.shouldIgnoreClick({ clientX:104,clientY:108,pointerType:'touch',detail:1 }));
assert(!touch.shouldIgnoreClick({ clientX:104,clientY:108,pointerType:'mouse',detail:1 }));
assert(!touch.shouldIgnoreClick({ clientX:104,clientY:108,detail:0 }), 'Keyboard activation survives');
event('pointerdown', 200, 200, card);
event('pointerup', 100, 205, card);
assert.deepEqual(swipes, [1], 'Horizontal card gestures navigate');
event('pointerdown', 100, 200, card);
event('pointerup', 100, 100, card);
assert.deepEqual(swipes, [1], 'Vertical reading gestures never navigate');
event('pointerdown', 100, 100);
event('pointermove', 200, 100);
event('pointerup', 100, 100);
assert.equal(taps.length, 1, 'Dragging out and back is not a tap');
event('pointerdown', 100, 100);
event('pointercancel', 100, 100);
event('pointerup', 100, 200);
event('pointerdown', 100, 100);
event('pointerdown', 120, 100, background, { pointerId:2,isPrimary:false });
event('pointerup', 100, 200);
assert(touch.shouldIgnoreClick({ clientX:100,clientY:200,pointerType:'touch',detail:1 }), 'Pinch compatibility click must not navigate');
event('pointerdown', 100, 100, button);
event('pointerup', 100, 200, button);
assert.deepEqual(swipes, [1], 'Cancelled gestures, pinch and controls never navigate');
assert(!touch.isActive());
console.log('PASS: touch taps, reading, swipe direction, cancellation and click deduplication');
