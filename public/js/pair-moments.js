/* global THREE */
import { getStageArea } from './scene-layout.js';
import { releaseHands } from './robot-interaction.js';

export const momentEase = (a, b, time) => {
  const t = Math.max(0, Math.min(1, (time-a)/(b-a)));
  return t*t*t*(t*(t*6-15)+10);
};
export const PAIR_MOMENTS = {
  star: { duration: 11, label: '✧ EVE tặng sao' },
  petal: { duration: 10, label: '✿ Gỡ cánh hoa' },
  crane: { duration: 12, label: '✧ Đón cánh hạc' }
};
export function samplePairMoment(kind, time) {
  const duration = PAIR_MOMENTS[kind].duration;
  return {
    weight: momentEase(0, 1.2, time)*(1-momentEase(duration-1.6, duration, time)),
    look: momentEase(.3, 1.5, time), reach: momentEase(1.7, 3.4, time),
    touch: momentEase(3.5, 4.5, time)*(1-momentEase(5.6, 6.8, time)),
    receive: momentEase(4.8, 5.6, time), lift: momentEase(5.6, 7.4, time),
    catch: momentEase(6, 7.5, time)
  };
}

export class PairMoments {
  constructor(app) {
    this.app = app;
    this.transition = app.sceneTransition;
    this.camera = app.scene3d.camera;
    this.robots = [app.wallE, app.eve];
    this.active = false;
    this.wait = 9;
    this.round = 0;
    this.button = document.getElementById('pair-moment');
    this.button.addEventListener('click', event => {
      event.stopPropagation();
      this.start();
    });
    this.point = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.hand = new THREE.Vector3();
    this.other = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.rotation = new THREE.Quaternion();
    this.euler = new THREE.Euler();
    this.item = new THREE.Group();
    this.item.name = 'pair-keepsake';
    this.starMaterial = new THREE.MeshStandardMaterial({ color: 0xb5f6ff, emissive: 0x67cfff,
      emissiveIntensity: .8, roughness: .25, metalness: .15, transparent: true });
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI/2+i*Math.PI/5, radius = i%2 ? .14 : .32;
      if (i === 0) starShape.moveTo(Math.cos(angle)*radius, Math.sin(angle)*radius);
      else starShape.lineTo(Math.cos(angle)*radius, Math.sin(angle)*radius);
    }
    starShape.closePath();
    this.star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape,
      { depth: .07, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 2, steps: 1 }), this.starMaterial);
    this.star.position.y = .2;
    this.star.add(new THREE.PointLight(0x96eaff, .5, 3));
    this.petal = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8),
      new THREE.MeshStandardMaterial({ color: 0xffb5c9, roughness: .65, side: THREE.DoubleSide, transparent: true }));
    this.petal.scale.set(.23, .06, .14);
    this.crane = new THREE.Group();
    const source = app.scene3d.seasonalProps.propAutumn;
    source.group.children.forEach(node => {
      if (node === source.hitProxy || node === source.pine) return;
      const copy = node.clone(true);
      copy.traverse(mesh => { if (mesh.material) mesh.material = mesh.material.clone(); });
      this.crane.add(copy);
    });
    this.item.add(this.star, this.petal, this.crane);
    this.item.visible = false;
    app.scene3d.scene.add(this.item);
  }

  setStage(stage) {
    this.wait = 9;
    this.round = 0;
    this.kind = stage === 2 ? 'petal' : stage === 4 ? 'crane' : 'star';
    this.button.textContent = PAIR_MOMENTS[this.kind].label;
    this.button.hidden = stage === 6;
  }

  start(kind = this.kind) {
    const a = this.app;
    if (!PAIR_MOMENTS[kind] || this.active || this.transition.active || a.stage === 6 || a.roseGift.active) return false;
    this.active = true;
    this.kind = kind;
    this.time = 0;
    this.responded = false;
    this.returning = false;
    this.emotions = this.robots.map(robot => robot.emotion);
    if (a.eve.isScanning) this.emotions[1] = ['normal', 'happy', 'wink', 'heart', 'happy'][a.stage-1];
    this.transition.delivery = this;
    this.transition.start(0, null, () => this.finish());
    this.origins = this.transition.from.filter(state => this.robots.some(robot => robot.group === state.node));
    releaseHands(...this.robots);
    a.wallE.swimState = 'none';
    a.wallE.waveTime = 5;
    a.eve.pendingSpin = false;
    a.eve.spinTime = 0;
    a.eve.isScanning = false;
    a.eve.scanBeam.visible = false;
    a.eve.reactionTime = 0;
    a.wallE.setEmotion('happy');
    a.eve.setEmotion('happy');
    this.button.disabled = true;
    this.star.visible = kind === 'star';
    this.petal.visible = kind === 'petal';
    this.crane.visible = kind === 'crane';
    return true;
  }

  cancel(immediate = false) {
    if (!this.active) return;
    if (immediate) { this.transition.finish(); return; }
    if (this.returning) return;
    this.transition.capture();
    this.transition.prepare();
    this.transition.cancelled = true;
    this.returning = true;
    this.returnTime = 0;
    this.item.visible = false;
  }

  finish() {
    this.active = false;
    this.item.visible = false;
    this.button.disabled = false;
    this.wait = 35;
    this.round++;
    this.robots.forEach((robot, i) => robot.setEmotion(this.emotions[i]));
    this.app.ambientTimer = 7;
    const queued = this.app.queuedStage;
    this.app.queuedStage = null;
    if (queued != null) this.app.goToStage(queued);
  }

  place(x, y, depth, target) {
    target.set(x/innerWidth*2-1, 1-y/innerHeight*2, .5).unproject(this.camera).sub(this.camera.position).normalize();
    return target.multiplyScalar(depth/target.dot(this.forward)).add(this.camera.position);
  }

  apply(delta) {
    const t = this.transition, a = this.app, [w, e] = this.robots;
    if (this.returning) {
      this.returnTime += delta;
      t.blendFromOrigin(1-momentEase(0, 1.1, this.returnTime));
      if (this.returnTime >= 1.1) t.finish();
      return;
    }
    this.time += delta;
    const reduced = a.motionQuery.matches;
    const time = reduced ? 7.6 : this.time;
    const c = samplePairMoment(this.kind, time);
    t.time = time;
    t.cancelled = true;
    t.blendFromOrigin(1-momentEase(0, 1.2, time));
    this.forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    t.forward.copy(this.forward);
    const area = getStageArea();
    const pixels = Math.min(240, area.height*.58, area.width*.30);
    const centerX = area.left+area.width*.53;
    const centerY = area.top+area.height*.53;
    const depth = (this.origins[0].depth+this.origins[1].depth)/2;
    const units = 2*Math.tan(this.camera.fov*Math.PI/360)*depth/innerHeight;
    const spacing = pixels*(this.kind === 'petal' ? .72 : .95);
    for (const [i, robot] of this.robots.entries()) {
      const sway = reduced ? 0 : Math.sin(time*1.6+i*.7)*.018;
      const chase = this.kind === 'crane' ? Math.sin(time*.9)*pixels*.10*(1-c.catch) : 0;
      const lift = i && this.kind === 'crane' && !reduced ? Math.sin(Math.min(1, time/7.5)*Math.PI)*pixels*.16 : 0;
      this.place(centerX+(i ? 1 : -1)*spacing*.5+chase,
        centerY+pixels*.36+(i ? -pixels*.05 : 0)-lift, depth, this.target);
      robot.group.position.lerp(this.target, c.weight);
      const size = pixels*units/(i ? 3.8 : 3.4);
      robot.group.scale.lerp(this.point.set(size, size, size), c.weight);
      this.rotation.copy(this.camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(
        this.euler.set(sway, (i ? -.38 : .38)*c.look, (i ? .05 : -.05)*c.look)));
      t.mixRotation(robot.group, this.rotation, c.weight);
      t.mixRotation(robot.floatPivot, this.rotation.identity(), c.weight);
      t.mixRotation(robot.body, this.rotation, c.weight);
      const watch = this.kind === 'crane' ? (1-c.catch) : 0;
      this.rotation.setFromEuler(this.euler.set(.10-c.lift*.13-watch*.26, (i ? -.24 : .24)*c.look+watch*Math.sin(time*1.2)*.15,
        (i ? .12 : -.12)*(c.look-c.lift*.5)+sway));
      t.mixRotation(robot.head, this.rotation, c.weight);
      robot.arms.forEach((arm, j) => {
        this.rotation.setFromEuler(this.euler.set(-.18, 0, (j ? 1 : -1)*.12));
        t.mixRotation(arm, this.rotation, c.weight);
        arm.scale.lerp(this.point.set(1, 1, 1), c.weight);
      });
      robot.group.updateWorldMatrix(true, true);
    }
    if (this.kind === 'star') {
      e.group.localToWorld(this.target.set(-.65, 1.1, -.35));
      t.aimHand(e.arms[0], e.handTip, this.target, c.weight*(1-c.touch)*(1-c.receive));
      t.joinHands(c.touch*c.weight);
      for (const [robot, armIndex, sign] of [[w, 1, -1], [e, 0, 1]]) {
        robot.group.localToWorld(this.target.set(sign*.65, 1.35+c.lift*.25, 1.1));
        t.aimHand(robot.arms[armIndex], robot.handTip, this.target, c.lift*c.weight);
        robot.group.updateWorldMatrix(true, true);
      }
      e.arms[0].localToWorld(this.hand.copy(e.handTip));
      w.arms[1].localToWorld(this.other.copy(w.handTip));
      this.item.position.copy(this.hand).lerp(this.other, c.receive);
      this.starMaterial.color.setRGB(.12+c.receive*.80, .55+c.receive*.10, 1-c.receive*.77);
      this.starMaterial.emissive.setRGB(.02+c.receive*.3, .18, .45-c.receive*.4);
    } else if (this.kind === 'petal') {
      e.head.localToWorld(this.hand.set(-.65, .35, .5));
      t.aimHand(w.arms[1], w.handTip, this.hand, c.reach*c.weight);
      w.group.updateWorldMatrix(true, true);
      w.arms[1].localToWorld(this.other.copy(w.handTip));
      w.group.position.addScaledVector(this.target.copy(this.hand).sub(this.other), c.touch*c.weight);
      w.group.updateWorldMatrix(true, true);
      w.arms[1].localToWorld(this.other.copy(w.handTip));
      this.item.position.copy(this.hand).lerp(this.other, c.receive);
      if (c.lift > 0) {
        w.group.localToWorld(this.target.set(.75, 1.25, .3));
        t.aimHand(w.arms[1], w.handTip, this.target, c.lift*c.weight);
        w.group.updateWorldMatrix(true, true);
        w.arms[1].localToWorld(this.item.position.copy(w.handTip));
      }
    } else {
      const flutter = reduced ? 0 : Math.sin(time*4)*.15*(1-c.catch);
      this.place(centerX+Math.sin(time*1.2)*pixels*.32*(1-c.catch),
        centerY-pixels*.18-Math.sin(time*1.5)*pixels*.14*(1-c.catch), depth-.4, this.hand);
      w.group.localToWorld(this.target.set(.7, 1.55, .95));
      this.hand.lerp(this.target, c.catch);
      t.aimHand(w.arms[1], w.handTip, this.hand, c.reach*c.weight);
      t.aimHand(e.arms[0], e.handTip, this.hand, c.touch*c.weight);
      w.group.updateWorldMatrix(true, true);
      w.arms[1].localToWorld(this.other.copy(w.handTip));
      this.item.position.copy(this.hand).lerp(this.other, c.catch);
      this.crane.rotation.set(.12, -.4, flutter);
      this.crane.children.filter(node => node.isGroup).forEach((wing, i) => {
        wing.rotation.z = (i ? -1 : 1)*flutter;
      });
      this.crane.scale.setScalar(.32);
    }
    this.item.quaternion.copy(this.camera.quaternion);
    this.item.rotateY(reduced ? .15 : Math.sin(time*.65)*.23);
    this.item.scale.setScalar(w.group.scale.x);
    this.item.visible = c.weight > .001;
    this.item.traverse(mesh => { if (mesh.material) { mesh.material.transparent = true; mesh.material.opacity = c.weight; } });
    if (!this.responded && (this.kind === 'crane' ? c.catch : c.receive) > .9) {
      this.responded = true; e.setEmotion('heart'); w.triggerHeartBounce(.6);
    }
    if ((!reduced && this.time >= PAIR_MOMENTS[this.kind].duration) || (reduced && this.time > 2.5)) {
      this.responded = false;
      t.finish();
    }
  }
}
