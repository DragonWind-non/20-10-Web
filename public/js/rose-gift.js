/* global THREE */
const ease = (start, end, time) => {
  const t = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const mix = (a, b, t) => a + (b - a) * t;
const pose = (a, b, t) => a.map((value, i) => mix(value, b[i], t));
export const giftAngle = (from, to, weight) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * weight;

export function sampleRoseGesture(time) {
  const weight = ease(0, 1.4, time) * (1 - ease(18.5, 21, time));
  const accept = ease(6, 7.6, time);
  const kiss = ease(9.8, 11.6, time) * (1 - ease(12.2, 13.8, time));
  return {
    weight, reach: ease(1.5, 3.1, time), offer: ease(3.4, 5.8, time), accept,
    receive: ease(8, 9.6, time), kiss,
    join: accept * (1 - ease(8, 9.6, time)),
    joy: ease(13.7, 14.5, time) * (1 - ease(18.2, 19.6, time)),
    wallBlush: Math.max(ease(0.4, 2.2, time) * 0.6, ease(11.2, 12.3, time)) * weight,
    eveBlush: Math.max(accept * 0.8, kiss) * weight,
    owner: time < 7.8 ? 'wall' : 'eve'
  };
}

export class RoseGift {
  constructor(scene, wallE, eve) {
    this.wallE = wallE;
    this.eve = eve;
    wallE.giftController = eve.giftController = this;
    this.active = false;
    this.wait = 8;
    this.time = 0;
    this.wallOffset = new THREE.Vector3();
    this.eveOffset = new THREE.Vector3();
    this.a = new THREE.Vector3();
    this.b = new THREE.Vector3();
    this.orientation = new THREE.Quaternion();
    this.targetOrientation = new THREE.Quaternion();
    this.rose = new THREE.Group();
    this.rose.name = 'gift-rose';
    this.materials = [];
    const material = color => {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.72, transparent: true });
      this.materials.push(mat);
      return mat;
    };
    const green = material(0x397747);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.95, 8), green);
    stem.position.y = 0.2;
    this.rose.add(stem);
    const leafGeometry = new THREE.SphereGeometry(1, 12, 8);
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(leafGeometry, green);
      leaf.position.set(side * 0.13, side < 0 ? 0.12 : 0.32, 0);
      leaf.scale.set(0.21, 0.055, 0.09);
      leaf.rotation.z = side * 0.55;
      this.rose.add(leaf);
    }
    const petalGeometry = new THREE.SphereGeometry(1, 14, 10);
    for (let ring = 0; ring < 3; ring++) {
      const red = material([0x951030, 0xc51f41, 0xdb3255][ring]);
      for (let i = 0; i < 5; i++) {
        const angle = i / 5 * Math.PI * 2 + ring * 0.7;
        const radius = 0.16 - ring * 0.055;
        const petal = new THREE.Mesh(petalGeometry, red);
        petal.position.set(Math.cos(angle) * radius, 0.69 + ring * 0.045, Math.sin(angle) * radius);
        petal.rotation.set(0.35 - ring * 0.15, -angle, 0.15);
        petal.scale.set(0.17 - ring * 0.035, 0.18 - ring * 0.025, 0.065);
        this.rose.add(petal);
      }
    }
    this.rose.visible = false;
    scene.add(this.rose);
  }

  start() {
    const w = this.wallE, e = this.eve;
    if (this.active || w.motionQuery.matches || w.isTravelling || e.isTravelling || e.stage === 6 || w.emotion === 'sleep'
      || w.handHoldProgress > 0.01 || w.swimState !== 'none' || e.isScanning || e.spinTime > 0
      || e.pendingSpin || w.motion.spinTime >= 0 || e.motion.spinTime >= 0) return false;
    this.active = true;
    this.cancelled = false;
    this.celebrated = false;
    this.time = 0;
    this.cue = null;
    this.wallEmotion = w.emotion;
    this.eveEmotion = e.emotion;
    this.wallOffset.set(0, 0, 0);
    this.eveOffset.set(0, 0, 0);
    w.group.getWorldQuaternion(this.orientation);
    e.reactionTime = 0;
    return true;
  }

  cancel(immediate = false) {
    if (!this.active) return;
    if (immediate) { this.finish(); return; }
    if (this.cancelled) return;
    this.cancelled = true;
    this.cancelTime = 0;
    this.cancelWeight = this.cue?.weight || 0;
    this.cancelWallOffset = this.wallOffset.clone();
    this.cancelEveOffset = this.eveOffset.clone();
    this.eve.setEmotion(this.eveEmotion);
  }

  finish() {
    this.active = false;
    this.wait = 38 + Math.random() * 14;
    this.rose.visible = false;
    this.wallE.giftPose = this.eve.giftPose = null;
    this.eve.blushOpacity = 0;
    if (!this.cancelled) {
      this.wallE.blushOpacity = 0;
      this.wallE.setEmotion(this.wallEmotion);
      this.eve.setEmotion(this.eveEmotion);
    }
    this.wallOffset.set(0, 0, 0);
    this.eveOffset.set(0, 0, 0);
  }

  prepare(delta) {
    if (!this.active) return;
    if (this.cancelled) {
      this.cancelTime += delta;
      const fade = 1 - ease(0, 1.2, this.cancelTime);
      for (const robot of [this.wallE, this.eve]) {
        if (robot.giftPose) robot.giftPose.weight = this.cancelWeight * fade;
      }
      this.eve.blushOpacity *= Math.exp(-delta * 5);
      if (this.cancelTime >= 1.2) this.finish();
      return;
    }
    this.time += delta;
    if (this.time >= 21) { this.finish(); return; }
    const c = this.cue = sampleRoseGesture(this.time);
    if (c.joy > 0 && !this.celebrated) {
      this.celebrated = true;
      this.wallE.winkTime = 0.75;
      this.wallE.triggerHeartBounce(0.85);
    }
    const flutter = Math.sin((this.time - 14) * 7) * c.joy;
    const arc = (this.time - 14) * 2.1;
    let right = pose([-0.2, 0.1, 0.12], [0.12, -2.55, 0.2], c.reach);
    right = pose(right, [-0.4, 0.85, -0.1], c.offer);
    right = pose(right, [-0.45, -0.35, 0.32], c.receive);
    this.wallE.giftPose = {
      weight: c.weight, heading: 0.3 + Math.sin(arc) * c.joy * 0.9,
      pitch: Math.cos(arc) * c.joy * 0.18, roll: Math.sin(arc) * c.joy * 0.22,
      head: [0.12 - c.kiss * 0.1 - c.joy * 0.2, 0.32 * (1 - c.joy), -0.2 + flutter * 0.09],
      arms: [pose([-0.4, 0.3, -0.25], [-1.05 + flutter * 0.18, 0.22, -0.3 - flutter * 0.2], c.joy),
        pose(right, [-1.1 - flutter * 0.18, -0.22, 0.3 - flutter * 0.2], c.joy)]
    };
    this.eve.giftPose = {
      weight: c.weight, heading: -0.25 - c.kiss * 0.4, pitch: c.kiss * 0.08, roll: c.kiss * 0.12,
      head: [0.15 * c.accept - c.kiss * 0.12, -0.35 - c.kiss * 0.35, 0.14 + c.kiss * 0.08],
      arms: [pose(pose([-0.1, 0, -0.08], [-1.15, 0.38, -0.22], c.accept), [-1.35, -0.15, -0.1], c.receive),
        [-0.22 - c.accept * 0.2, -0.2, 0.14]]
    };
    this.wallE.blushOpacity = c.wallBlush;
    this.eve.blushOpacity = c.eveBlush;
    const expression = c.kiss > 0.5 ? 'happy' : c.receive > 0.3 ? 'heart' : 'normal';
    if (this.eve.emotion !== expression) this.eve.setEmotion(expression);
  }

  apply(delta) {
    if (!this.active) return;
    const w = this.wallE, e = this.eve, c = this.cue;
    if (!c) return;
    if (this.cancelled) {
      const fade = 1 - ease(0, 1.2, this.cancelTime);
      this.wallOffset.copy(this.cancelWallOffset).multiplyScalar(fade);
      this.eveOffset.copy(this.cancelEveOffset).multiplyScalar(fade);
      w.group.position.add(this.wallOffset);
      e.group.position.add(this.eveOffset);
    } else {
      this.wallOffset.set(0, 0, 0);
      this.eveOffset.set(0, 0, 0);
      w.group.updateWorldMatrix(true, true);
      e.group.updateWorldMatrix(true, true);
      w.arms[1].localToWorld(this.a.copy(w.handTip));
      e.arms[0].localToWorld(this.b.copy(e.handTip));
      this.b.sub(this.a);
      this.wallOffset.addScaledVector(this.b, c.join * 0.5);
      this.eveOffset.addScaledVector(this.b, -c.join * 0.5);
      w.group.position.add(this.wallOffset);
      e.group.position.add(this.eveOffset);
      w.group.updateWorldMatrix(true, true);
      e.group.updateWorldMatrix(true, true);
      // Contact points are on the cheek and visor, so shells never have to share a centre.
      w.head.localToWorld(this.a.set(0.75, -0.07, 0.25));
      e.head.localToWorld(this.b.set(0, -0.05, 0.72)).sub(this.a);
      this.wallOffset.addScaledVector(this.b, c.kiss * 0.15);
      this.eveOffset.addScaledVector(this.b, -c.kiss * 0.85);
      w.group.position.addScaledVector(this.b, c.kiss * 0.15);
      e.group.position.addScaledVector(this.b, -c.kiss * 0.85);
      const arc = (this.time - 14) * 2.1;
      const units = w.group.scale.x * w.displayLayout.height / w.displayLayout.pixels;
      this.a.set(Math.sin(arc) * w.displayLayout.roamX * 0.7,
        Math.sin(arc * 2) * w.displayLayout.roamY * 0.65, 0).multiplyScalar(units * c.joy);
      this.wallOffset.add(this.a);
      w.group.position.add(this.a);
    }
    const owner = c.owner === 'wall' ? w : e;
    owner.group.updateWorldMatrix(true, true);
    const arm = owner.arms[c.owner === 'wall' ? 1 : 0];
    arm.localToWorld(this.rose.position.copy(owner.handTip));
    // Keep the stem upright in the grip, with a small wrist-following tilt.
    owner.group.getWorldQuaternion(this.targetOrientation);
    this.orientation.slerp(this.targetOrientation, 1 - Math.exp(-delta * 4));
    this.rose.quaternion.copy(this.orientation);
    this.rose.rotateX(-1.3 * (1 - c.offer));
    this.rose.rotateZ(-0.12 + Math.sin(this.time * 1.8) * 0.035);
    this.rose.scale.setScalar(w.group.scale.x);
    const opacity = ease(2.7, 3.1, this.time) * (1 - ease(18.5, 21, this.time))
      * (this.cancelled ? 1 - ease(0, 0.7, this.cancelTime) : 1);
    this.rose.visible = opacity > 0.001;
    for (const mat of this.materials) mat.opacity = opacity;
  }
}
