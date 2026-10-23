/* global THREE */
// All foreground objects use the same reading and control boundaries.
export function getStageArea() {
  const rect = id => document.getElementById(id)?.getBoundingClientRect?.();
  const card = rect('narrative-box');
  const stepper = rect('season-stepper');
  const landscape = innerHeight < 600 && innerWidth > innerHeight * 1.5;
  const left = landscape ? (card?.right || innerWidth * 0.54) + 16 : 16;
  const right = (stepper?.height > stepper?.width ? stepper.left : innerWidth) - 16;
  let bottom = innerHeight - 24;
  for (const id of ['vinyl-dock', 'lyric-hud']) {
    const element = document.getElementById(id);
    const box = rect(id);
    if (box?.height && element.style.opacity !== '0') bottom = Math.min(bottom, box.top - 12);
  }
  const stage = Number(document.body?.dataset?.stage);
  const caption = document.querySelector('.pov-caption')?.getBoundingClientRect?.();
  if (stage >= 2 && stage <= 4 && caption?.height) {
    bottom = Math.min(bottom, innerHeight - (innerWidth <= 600 ? 76 : 0) - caption.height - 12);
  }
  const top = landscape ? 76 : (card?.bottom || 200) + 18;
  return { left, top, width: Math.max(80, right - left), height: Math.max(60, bottom - top), landscape };
}

export function fitRobotLayout(robot, eve = false) {
  const area = getStageArea();
  const stacked = area.width < 620;
  // The narrow side must stay readable when a robot rolls on a short screen.
  const pixels = Math.min(stacked ? 225 : 300, Math.max(96, area.height * (stacked ? 0.44 : 0.60)), area.width * (stacked ? 0.38 : 0.25));
  const height = eve ? 3.8 : 4.8;
  const size = pixels * (eve ? 0.86 : 1);
  const x = area.left + area.width * (eve ? 0.74 : stacked ? 0.26 : 0.43);
  const y = area.top + area.height * (stacked ? 0.35 : 0.50) + 1.65 * size / height;
  Object.assign(robot.layout, {
    x: x / innerWidth * 2 - 1, y: 1 - y / innerHeight * 2, pixels: size, height,
    // Reserve space for a full body roll as well as the wandering path.
    roamX: Math.min(stacked ? 26 : 78, Math.max(0, area.width * (stacked ? 0.26 : 0.22) - size * 0.5 - 10)),
    roamY: Math.min(42, area.height * (stacked ? 0.09 : 0.12))
  });
}

export function fitSleepingRobotLayout(robot, eve = false) {
  if (robot.finaleLayout) { Object.assign(robot.layout, robot.finaleLayout); return; }
  const mobile = innerWidth <= 768;
  const x = innerWidth * (eve ? 0.88 : 0.76);
  const pixels = eve ? (mobile ? 50 : 75) : (mobile ? 56 : 82);
  const y = innerHeight - 80 - pixels * (eve ? 0.08 : 0.18);
  Object.assign(robot.layout, {
    x: x / innerWidth * 2 - 1, y: 1 - y / innerHeight * 2,
    pixels, height: eve ? 3.6 : 3, roamX: 0, roamY: 0
  });
}

export function joinRobotHands(wallE, eve, delta, reduced) {
  const progress = wallE.emotion === 'sleep' || eve.stage === 6 ? 0 : Math.min(wallE.handHoldProgress, eve.handHoldProgress);
  const gap = new THREE.Vector3();
  if (progress > 0) {
    wallE.group.updateWorldMatrix(true, true);
    eve.group.updateWorldMatrix(true, true);
    const wallHand = wallE.arms[1].localToWorld(wallE.handTip.clone());
    const weight = progress * progress * (3 - 2 * progress);
    gap.copy(eve.arms[0].localToWorld(eve.handTip.clone())).sub(wallHand).multiplyScalar(weight * 0.5);
  }
  wallE.handOffset ??= new THREE.Vector3();
  wallE.handOffset.lerp(gap, reduced || progress > 0 ? 1 : 1 - Math.exp(-delta * 9));
  wallE.group.position.add(wallE.handOffset);
  eve.group.position.addScaledVector(wallE.handOffset, -1);
}
