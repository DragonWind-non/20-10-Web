/* global THREE */
import { getStageArea } from './scene-layout.js';

export const PASSAGE = { duration: 5.2, clasp: 0.95, exit: 2.3, enter: 3.35, arrive: 4.55,
  sky: 1300, story: 1300, swap: 180 };
const ease = (a, b, time) => {
  const t = Math.max(0, Math.min(1, (time-a)/(b-a)));
  return t*t*t*(t*(t*6-15)+10);
};

export function samplePassage(time) {
  return {
    weight: ease(0, PASSAGE.clasp, time) * (1-ease(PASSAGE.arrive, PASSAGE.duration, time)),
    grip: ease(0.15, PASSAGE.clasp, time) * (1-ease(PASSAGE.arrive, 5.1, time)),
    depart: ease(PASSAGE.clasp, PASSAGE.exit, time),
    arrive: ease(PASSAGE.enter, PASSAGE.arrive, time)
  };
}

export class SceneTransition {
  constructor(camera, wallE, eve) {
    this.camera = camera;
    this.robots = [wallE, eve];
    for (const robot of this.robots) robot.travelController = this;
    this.active = false;
    this.time = this.grip = 0;
    this.right = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.center = new THREE.Vector3();
    this.a = new THREE.Vector3();
    this.b = new THREE.Vector3();
    this.axis = new THREE.Vector3();
    this.perpendicular = new THREE.Vector3();
    this.hand = new THREE.Vector3();
    this.local = new THREE.Vector3();
    this.orientation = new THREE.Quaternion();
    this.identity = new THREE.Quaternion();
    this.rotationDelta = new THREE.Quaternion();
    this.euler = new THREE.Euler();
    this.nodes = this.robots.flatMap(robot => [robot.group, robot.floatPivot, robot.body, robot.head,
      ...robot.arms, ...(robot.armsPivot || []), ...(robot.treads || []),
      ...[robot.neck, robot.neckBase].filter(Boolean)]);
  }

  capture() {
    this.originRotations = new Map();
    this.poseRotations = new Map();
    this.handRotations = new Map();
    const camera = this.camera;
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this.from = this.nodes.map(node => {
      const state = { node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() };
      if (this.robots.some(robot => robot.group === node)) {
        state.screen = node.position.clone().project(camera);
        state.depth = this.local.copy(node.position).sub(camera.position).dot(this.forward);
        state.viewQuaternion = camera.quaternion.clone().invert().multiply(node.quaternion);
      }
      return state;
    });
  }

  start(direction, onExit, onFinish) {
    if (this.robots[0].motionQuery.matches && !this.delivery) { this.finish(); return; }
    this.capture();
    this.prepare();
    this.direction = direction;
    this.onExit = onExit;
    this.onFinish = onFinish;
    this.swapped = false;
    this.time = this.grip = 0;
    this.cancelled = false;
    this.active = true;
    for (const robot of this.robots) robot.isTravelling = true;
  }

  cancel(immediate = false) {
    if (!this.active) return;
    if (this.delivery) { this.delivery.cancel(immediate); return; }
    if (!immediate && this.onExit) return;
    if (immediate) { this.finish(); return; }
    if (this.cancelled) return;
    this.capture();
    this.cancelled = true;
    this.cancelTime = 0;
    for (const robot of this.robots) robot.isTravelling = false;
  }

  finish() {
    this.prepare();
    this.delivery = null;
    if (!this.swapped) this.swap();
    this.active = false;
    this.grip = 0;
    for (const robot of this.robots) robot.isTravelling = false;
    const callback = this.onFinish;
    this.onExit = this.onFinish = null;
    callback?.();
  }

  swap() {
    this.swapped = true;
    this.onExit?.();
  }

  prepare() {
    if (!this.base) return;
    // Procedural smoothers must read their own last pose, not last frame's overlay.
    for (const { node, position, quaternion, scale } of this.base) {
      node.position.copy(position);
      node.quaternion.copy(quaternion);
      node.scale.copy(scale);
    }
    this.base = null;
  }

  mixRotation(node, target, weight, rotations = this.poseRotations) {
    if (weight <= 0) return;
    const q = this.rotationDelta.copy(node.quaternion).invert().multiply(target).normalize();
    const previous = rotations.get(node);
    // Keep the same arc when a moving target passes 180 degrees.
    if (previous ? q.dot(previous) < 0 : q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
    rotations.set(node, previous ? previous.copy(q) : q.clone());
    const length = Math.hypot(q.x, q.y, q.z);
    if (length < 1e-8) return;
    const angle = Math.atan2(length, q.w)*weight;
    const sine = Math.sin(angle)/length;
    q.set(q.x*sine, q.y*sine, q.z*sine, Math.cos(angle));
    node.quaternion.multiply(q).normalize();
  }

  blendFromOrigin(weight) {
    if (weight <= 0) return;
    const camera = this.camera;
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const reading = !this.cancelled && this.robots[1].stage !== 6;
    const fitWeight = reading ? 1-ease(0, 1.1, this.time) : weight;
    for (const { node, position, quaternion, scale, screen, depth, viewQuaternion } of this.from) {
      if (screen) {
        // Anchor the displayed pose to the new camera, so its first pan cannot pop the robots.
        this.local.set(screen.x, screen.y, 0.5).unproject(camera).sub(camera.position).normalize();
        this.local.multiplyScalar(depth/this.local.dot(this.forward)).add(camera.position);
        const targetY = this.a.copy(node.position).project(camera).y;
        node.position.lerp(this.local, weight);
        // Fit below the new reading card before it fades in; keep lateral travel soft.
        if (reading) {
          const projectedY = this.a.copy(node.position).project(camera).y;
          const currentDepth = this.a.copy(node.position).sub(camera.position).dot(this.forward);
          const desiredY = targetY+(screen.y-targetY)*fitWeight;
          node.position.addScaledVector(this.up, (desiredY-projectedY)*Math.tan(camera.fov*Math.PI/360)*currentDepth);
        }
        this.orientation.copy(camera.quaternion).multiply(viewQuaternion);
        this.mixRotation(node, this.orientation, weight, this.originRotations);
      } else {
        node.position.lerp(position, weight);
        this.mixRotation(node, quaternion, weight, this.originRotations);
      }
      node.scale.lerp(scale, screen && reading ? 1-ease(0, 1.3, this.time) : weight);
    }
  }

  apply(delta) {
    if (!this.active) return;
    if (this.robots[0].motionQuery.matches && !this.delivery) { this.finish(); return; }
    this.base = this.nodes.map(node => ({ node, position: node.position.clone(),
      quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
    if (this.delivery) { this.delivery.apply(delta); return; }
    if (this.cancelled) {
      this.cancelTime += delta;
      this.blendFromOrigin(1-ease(0, 0.32, this.cancelTime));
      if (this.cancelTime >= 0.32) this.finish();
      return;
    }
    this.time = Math.min(PASSAGE.duration, this.time+delta);
    const c = samplePassage(this.time), [w, e] = this.robots, camera = this.camera;
    this.grip = c.grip;
    this.blendFromOrigin(1-ease(0, PASSAGE.clasp, this.time));
    this.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this.center.copy(w.group.position).lerp(e.group.position, 0.5);
    const depth = this.local.copy(this.center).sub(camera.position).dot(this.forward);
    const units = 2*Math.tan(camera.fov*Math.PI/360)*depth/innerHeight;
    const area = getStageArea();
    const distance = w.group.scale.x*0.85 + e.group.scale.x*0.96
      + (w.handTip.length()*w.group.scale.x + e.handTip.length()*e.group.scale.x)*0.65;
    const centerX = (this.a.copy(this.center).project(camera).x+1)*innerWidth/2;
    const margin = distance/units + Math.max(w.layout.pixels, e.layout.pixels)*1.5;
    const edge = this.direction > 0 ? innerWidth-centerX : centerX;
    // Move the entire joined pair beyond the viewport before changing the scene.
    const travel = this.swapped ? -(innerWidth-edge+margin)*(1-c.arrive) : (edge+margin)*c.depart;
    const drive = this.swapped ? 1-c.arrive : c.depart;
    for (const [i, robot] of this.robots.entries()) {
      const oldDepth = this.local.copy(robot.group.position).sub(camera.position).dot(this.forward);
      const x = (i ? 0.5 : -0.5)*distance
        + this.direction*travel*units;
      const lift = Math.sin(drive*Math.PI)*Math.min(i ? 10 : 6, area.height*0.04)*units;
      this.local.copy(this.center).addScaledVector(this.right, x).addScaledVector(this.up, lift);
      robot.group.position.lerp(this.local, c.weight);
      robot.group.scale.multiplyScalar(1+(depth/oldDepth-1)*c.weight);
      this.orientation.copy(camera.quaternion).multiply(this.identity.setFromEuler(
        this.euler.set(-drive*0.06, this.direction*drive*0.48, this.direction*drive*(i ? -0.09 : 0.07))));
      this.mixRotation(robot.group, this.orientation, c.weight);
      this.mixRotation(robot.floatPivot, this.identity.identity(), c.weight);
      this.mixRotation(robot.body, this.identity, c.weight);
      const glance = i ? -0.4*(1-drive) + this.direction*drive*0.25 : 0.3*(1-drive);
      this.orientation.setFromEuler(this.euler.set(-drive*0.08, glance, i ? 0.1 : -0.08));
      this.mixRotation(robot.head, this.orientation, c.weight);
      const freeArm = robot.arms[i ? 1 : 0];
      this.orientation.setFromEuler(this.euler.set(-0.18-drive*0.4, 0.08, (i ? 1 : -1)*(0.12+drive*0.22)));
      this.mixRotation(freeArm, this.orientation, c.weight);
      robot.arms.forEach(arm => arm.scale.lerp(this.local.set(1, 1, 1), c.weight));
    }
    if (c.grip > 0) this.joinHands(c.grip);
    if (!this.swapped && this.time >= PASSAGE.exit) {
      this.swap();
      return this.apply(0);
    }
    if (this.time === PASSAGE.duration) this.finish();
  }

  joinHands(weight) {
    const [w, e] = this.robots, wa = w.arms[1], ea = e.arms[0];
    w.group.updateWorldMatrix(true, true); e.group.updateWorldMatrix(true, true);
    wa.getWorldPosition(this.a); ea.getWorldPosition(this.b);
    const wr = w.handTip.length()*wa.getWorldScale(this.local).x;
    const er = e.handTip.length()*ea.getWorldScale(this.local).x;
    let distance = this.axis.copy(this.b).sub(this.a).length();
    this.axis.normalize();
    const bend = Math.min(wr, er)*0.15;
    const minimum = Math.abs(wr-er)+bend, maximum = wr+er-bend;
    const reachable = THREE.MathUtils.clamp(distance, minimum, maximum);
    const correction = (distance-reachable)*0.5*weight;
    w.group.position.addScaledVector(this.axis, correction);
    e.group.position.addScaledVector(this.axis, -correction);
    w.group.updateWorldMatrix(true, true); e.group.updateWorldMatrix(true, true);
    wa.getWorldPosition(this.a); ea.getWorldPosition(this.b);
    distance = Math.max(0.0001, this.axis.copy(this.b).sub(this.a).length());
    this.axis.normalize();
    // A virtual, bent reach avoids the straight-arm singularity before contact.
    const solveDistance = THREE.MathUtils.clamp(distance, minimum, maximum);
    const along = (wr*wr-er*er+solveDistance*solveDistance)/(2*solveDistance);
    const height = Math.sqrt(Math.max(0, wr*wr-along*along));
    // The two fixed arm lengths meet on a circle; choose the point toward the camera.
    this.perpendicular.copy(this.forward).negate().addScaledVector(this.axis, this.forward.dot(this.axis)).normalize();
    this.hand.copy(this.a).addScaledVector(this.axis, along).addScaledVector(this.perpendicular, height);
    for (const [arm, tip] of [[wa, w.handTip], [ea, e.handTip]]) {
      this.aimHand(arm, tip, this.hand, weight);
    }
  }

  aimHand(arm, tip, target, weight) {
    if (weight <= 0) return;
    arm.parent.worldToLocal(this.local.copy(target)).sub(arm.position).normalize();
    const reference = this.handRotations.get(arm) || arm.quaternion.clone();
    this.handRotations.set(arm, reference);
    // Aim from a fixed wrist pose; feeding earlier aim commands back adds twist each frame.
    this.perpendicular.copy(tip).normalize().applyQuaternion(reference);
    this.orientation.setFromUnitVectors(this.perpendicular, this.local).multiply(reference);
    // Each aim is a shortest local reach, independent of the other commands' rotation arcs.
    arm.quaternion.slerp(this.orientation, weight).normalize();
  }
}
