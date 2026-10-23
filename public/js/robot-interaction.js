const approach = (value, target, delta, rate) => value + (target - value) * (1 - Math.exp(-delta * rate));

export function holdHands(wallE, eve, duration = 4.5) {
  if (!wallE || !eve || wallE.emotion === 'sleep' || eve.stage === 6) return;
  wallE.travelController?.cancel();
  wallE.giftController?.cancel();
  const hold = { remaining: duration, active: true };
  wallE.handHold = eve.handHold = hold;
  wallE.isHoldingHands = eve.isHoldingHands = true;
  wallE.swimState = 'none';
  wallE.joyWiggleTime = 0;
  eve.isScanning = false;
  eve.scanBeam.visible = false;
  eve.spinTime = 0;
  eve.pendingSpin = false;
  wallE.setEmotion('blush');
  wallE.triggerHeartBounce(0.7);
  eve.setEmotion('heart');
}

export function releaseHands(wallE, eve) {
  if (wallE?.handHold) wallE.handHold.active = false;
  if (wallE) wallE.isHoldingHands = false;
  if (eve) eve.isHoldingHands = false;
}

export function updateHands(wallE, eve, delta, reduced = false) {
  const hold = wallE.handHold;
  if (!hold) return;
  hold.remaining = Math.max(0, hold.remaining - delta);
  if (!hold.remaining || wallE.emotion === 'sleep' || eve.stage === 6) hold.active = false;
  wallE.isHoldingHands = eve.isHoldingHands = hold.active;
  const progress = approach(wallE.handHoldProgress, hold.active ? 1 : 0, delta, hold.active ? 5 : 6);
  wallE.handHoldProgress = eve.handHoldProgress = reduced ? (hold.active ? 1 : 0) : progress < 0.0001 ? 0 : progress;
  wallE.holdHandsTimer = eve.holdHandsTimer = hold.remaining;
  if (!hold.active && wallE.handHoldProgress === 0) {
    wallE.handHold = eve.handHold = null;
    if (eve.stage !== 6 && !eve.isScanning && !eve.spinTime) eve.setEmotion('normal');
  }
}
