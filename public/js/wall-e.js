/* global THREE */
import { SpaceMotion } from './space-motion.js';
import { fitRobotLayout, fitSleepingRobotLayout } from './scene-layout.js';
import { holdHands, releaseHands } from './robot-interaction.js';
import { giftAngle } from './rose-gift.js';

// RoundedBoxGeometry normal construction, adapted from Three.js r128 (MIT).
// https://github.com/mrdoob/three.js/blob/r128/examples/jsm/geometries/RoundedBoxGeometry.js
export function roundedBox(width, height, depth, radius = 0.08) {
  radius = Math.min(radius, width / 2, height / 2, depth / 2);
  const segments = radius > 0.07 ? 7 : 3;
  const geometry = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments);
  const position = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const half = new THREE.Vector3(width / 2 - radius, height / 2 - radius, depth / 2 - radius);
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    normal.copy(point);
    for (const axis of ['x','y','z']) normal[axis] -= Math.sign(normal[axis]) * 0.5 / segments;
    normal.normalize();
    position.setXYZ(i, Math.sign(point.x) * half.x + normal.x * radius,
      Math.sign(point.y) * half.y + normal.y * radius, Math.sign(point.z) * half.z + normal.z * radius);
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return geometry;
}

function paintTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c9a75f';
  ctx.fillRect(0, 0, 512, 512);
  let seed = 41;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 1300; i++) {
    const x = random() * 512, y = random() * 512;
    ctx.fillStyle = i % 3 ? 'rgba(75,49,21,.13)' : 'rgba(255,233,172,.28)';
    ctx.fillRect(x, y, random() * 11 + 1, random() * 2 + 0.5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

export class WallERobot {
  constructor(scene, camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'Wall-E';
    this.floatPivot = new THREE.Group();
    this.floatPivot.position.y = 1.65;
    this.model = new THREE.Group();
    this.model.position.y = -1.65;
    this.floatPivot.add(this.model);
    this.group.add(this.floatPivot);
    this.motion = new SpaceMotion();
    this.head = new THREE.Group();
    this.arms = [];
    this.lenses = [];
    this.eyes = [];
    this.lids = [];
    this.pointer = new THREE.Vector2();
    this.pointerAge = Infinity;
    this.raycaster = new THREE.Raycaster();
    this.screenPoint = new THREE.Vector2();
    this.worldPoint = new THREE.Vector3();
    this.rayDirection = new THREE.Vector3();
    this.lookPoint = new THREE.Vector3();
    this.layout = { x: 0, y: 0, pixels: 220, height: 4.2 };
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.waveTime = 0;
    this.greetingWait = 6;
    this.winkTime = 0;
    this.beat = 0;
    this.heartTime = 9;
    this.heartIntensity = 0;
    this.attention = 'rest';
    this.time = 0;
    this.emotion = 'idle';

    // Các thành phần động lực học cho toàn thân Wall-E
    this.treads = [];
    this.wheels = [];
    this.trackShoes = [];
    this.chestLights = [];
    this.treadProgress = 0;
    this.bodyYaw = 0;
    this.bodyPitch = 0;
    this.bodyRoll = 0;
    this.neckExtension = 0;
    this.joyWiggleTime = 0;

    // Tương tác chạm liên tục & Đỏ mặt /// / Bơi trốn
    this.clickStreak = 0;
    this.lastClickTime = 0;
    this.blushOpacity = 0;
    this.blushMeshes = [];
    this.swimState = 'none'; // 'shoo' | 'swimming' | 'arriving' | 'none'
    this.swimTimer = 0;
    this.swimHeadingYaw = 0;
    this.swimVelocity = new THREE.Vector3();
    this.swimTargetOffset = new THREE.Vector3();
    this.currentHeadingYaw = 0;
    this.flightPitch = this.flightRoll = 0;
    this.partner = null; // Robot EVE
    this.isHoldingHands = false;
    this.holdHandsTimer = 0;
    this.handHoldProgress = 0;
    this.handTip = new THREE.Vector3(0.06, -0.1, 0.96);

    const paint = new THREE.MeshPhysicalMaterial({ map: paintTexture(), roughness: 0.47, metalness: 0.36, clearcoat: 0.18, clearcoatRoughness: 0.4, envMapIntensity: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3f4b58, roughness: 0.65, metalness: 0.3 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xa9acaa, roughness: 0.35, metalness: 0.68, envMapIntensity: 0.65 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x323b48, roughness: 0.9, metalness: 0.05 });
    const eyeMetal = new THREE.MeshStandardMaterial({ color: 0xd1d0bd, roughness: 0.3, metalness: 0.55, envMapIntensity: 0.75 });
    const lens = new THREE.MeshPhysicalMaterial({ color: 0x152c36, metalness: 0.6, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 });
    for (const material of [dark, metal, rubber, eyeMetal, lens]) material.color.convertSRGBToLinear();
    const add = (geometry, material, parent, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    this.body = new THREE.Group();
    this.body.position.y = 1.16;
    this.model.add(this.body);
    add(roundedBox(1.58, 1.24, 1.28, 0.18), paint, this.body);
    add(roundedBox(1.45, 0.22, 1.36, 0.08), metal, this.body, 0, 0.61, 0);
    add(roundedBox(1.35, 0.78, 0.07, 0.025), paint, this.body, 0, -0.08, 0.67);
    add(roundedBox(0.55, 0.2, 0.08, 0.02), dark, this.body, -0.35, 0.35, 0.71);
    for (let i = 0; i < 3; i++) {
      const light = add(new THREE.BoxGeometry(0.08, 0.04, 0.015), new THREE.MeshStandardMaterial({ color: i === 2 ? 0x95c4ab : 0x444b48, emissive: i === 2 ? 0x52735b : 0, emissiveIntensity: 0.5 }), this.body, -0.47 + i * 0.12, 0.35, 0.76);
      light.castShadow = false;
      this.chestLights.push(light);
    }
    for (const x of [-0.6, 0.6]) for (const y of [-0.39, 0.2]) {
      const bolt = add(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 8), metal, this.body, x, y, 0.72);
      bolt.rotation.x = Math.PI / 2;
    }
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 512; badgeCanvas.height = 128;
    const badgeCtx = badgeCanvas.getContext('2d');
    badgeCtx.fillStyle = '#302b25'; badgeCtx.font = 'bold 66px sans-serif';
    badgeCtx.textAlign = 'center'; badgeCtx.fillText('WALL·E', 256, 93);
    const badge = new THREE.CanvasTexture(badgeCanvas);
    add(new THREE.PlaneGeometry(0.78, 0.19), new THREE.MeshBasicMaterial({ map: badge, transparent: true, depthWrite: false }), this.body, 0.2, -0.29, 0.715);

    // Treads follow an oval in the YZ plane, with real wheels and separate shoes.
    for (const side of [-1, 1]) {
      const tread = new THREE.Group();
      tread.position.set(side * 0.91, 0.43, 0);
      this.model.add(tread);
      this.treads.push(tread);
      add(roundedBox(0.38, 0.75, 1.68, 0.14), rubber, tread);
      for (const z of [-0.54, 0, 0.54]) {
        const wheel = add(new THREE.CylinderGeometry(z === 0 ? 0.21 : 0.31, z === 0 ? 0.21 : 0.31, 0.43, 18), dark, tread, 0, -0.03, z);
        wheel.rotation.z = Math.PI / 2;
        this.wheels.push({ mesh: wheel, side });
        const hub = add(new THREE.CylinderGeometry(0.11, 0.11, 0.45, 12), metal, tread, 0, -0.03, z);
        hub.rotation.z = Math.PI / 2;
        this.wheels.push({ mesh: hub, side });
      }
      const shoeGeometry = roundedBox(0.49, 0.105, 0.19, 0.045);
      for (let i = 0; i < 30; i++) {
        const angle = i / 30 * Math.PI * 2;
        const shoe = add(shoeGeometry, rubber, tread, 0, Math.cos(angle) * 0.4, Math.sin(angle) * 0.84);
        shoe.rotation.x = Math.atan2(-0.4 * Math.sin(angle), 0.84 * Math.cos(angle));
        this.trackShoes.push({ mesh: shoe, side, baseAngle: angle });
      }
    }
    this.neck = add(roundedBox(0.18, 0.79, 0.2, 0.05), metal, this.model, 0, 2.04, -0.12);
    this.neck.rotation.x = -0.19;
    this.neckBase = add(new THREE.CylinderGeometry(0.14, 0.14, 0.45, 24), dark, this.model, 0, 1.79, 0);
    this.head.position.set(0, 2.47, 0.06);
    this.model.add(this.head);
    add(roundedBox(1.3, 0.19, 0.31, 0.05), metal, this.head, 0, -0.04, -0.12);
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.49, 0.07, 0.04);
      eye.rotation.z = side * -0.16;
      this.head.add(eye);
      this.eyes.push(eye);
      add(roundedBox(0.91, 0.66, 0.51, 0.19), eyeMetal, eye);
      add(new THREE.TorusGeometry(0.25, 0.042, 12, 40), dark, eye, 0, 0, 0.3);
      const glass = add(new THREE.CylinderGeometry(0.237, 0.237, 0.012, 32), lens, eye, 0, 0, 0.36);
      glass.rotation.x = Math.PI / 2;
      const irisMat = new THREE.MeshStandardMaterial({ color: 0x6c9da9, emissive: 0x2a6b8c, emissiveIntensity: 0.25, metalness: 0.65, roughness: 0.18 });
      const iris = add(new THREE.TorusGeometry(0.15, 0.014, 8, 32), irisMat, eye, 0, 0, 0.376);
      this.lenses.push(iris);
      add(new THREE.CircleGeometry(0.092, 24), new THREE.MeshBasicMaterial({ color: 0x060e16 }), eye, 0, 0, 0.377);
      const glint = add(new THREE.SphereGeometry(0.034, 10, 8), new THREE.MeshBasicMaterial({ color: 0xe6f8ff }), eye, -0.07, 0.082, 0.385);
      glint.scale.set(1.5, 0.65, 0.3);
      for (const sign of [-1, 1]) {
        const lid = add(roundedBox(0.54, 0.3, 0.025, 0.01), eyeMetal, eye, 0, sign * 0.28, 0.4);
        lid.visible = false;
        this.lids.push({ mesh: lid, eye: side, sign });
      }

      // 3 vạch đỏ /// má hồng anime đáng yêu khi Wall-E ngại ngùng
      for (let b = 0; b < 3; b++) {
        const slashMat = new THREE.MeshBasicMaterial({
          color: 0xff3b6f,
          transparent: true,
          opacity: 0,
          depthWrite: false
        });
        const slash = add(new THREE.PlaneGeometry(0.024, 0.14), slashMat, eye, -0.09 + b * 0.08, -0.22, 0.38);
        slash.rotation.z = -0.38; // Vạch chéo ///
        slash.visible = false;
        this.blushMeshes.push(slash);
      }
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.85, 1.58, 0.03);
      arm.rotation.z = side * 0.1;
      this.model.add(arm);
      add(roundedBox(0.16, 0.2, 0.8, 0.03), metal, arm, side * 0.06, -0.11, 0.28);
      add(roundedBox(0.19, 0.16, 0.39, 0.03), paint, arm, side * 0.06, -0.1, 0.73);
      for (const finger of [-1, 1]) add(roundedBox(0.095, 0.24, 0.18, 0.025), metal, arm, side * 0.06 + finger * 0.09, -0.1, 0.96);
      this.arms.push(arm);
    }
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, -0.36);
    heartShape.bezierCurveTo(-0.7, 0.08, -0.5, 0.7, 0, 0.35);
    heartShape.bezierCurveTo(0.5, 0.7, 0.7, 0.08, 0, -0.36);
    const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, steps: 1 });
    heartGeo.center();
    this.heartMesh = add(heartGeo, new THREE.MeshStandardMaterial({ color: 0xffa1c0, emissive: 0xb5496d, emissiveIntensity: 0.28, roughness: 0.4 }), this.model, 0, 3.65, 0.12);
    this.heartMesh.scale.setScalar(0.52);
    scene.add(this.group);
    this.fitToViewport();
    window.addEventListener('resize', () => this.fitToViewport());
  }

  setPartner(eve) {
    this.partner = eve;
  }

  triggerHoldHands(duration = 4.5) {
    holdHands(this, this.partner, duration);
    this.showToast('WALL-E & EVE', 'Mình cùng nắm tay đi qua bốn mùa nhé.', '♡');
  }

  setEmotion(emotion) {
    this.emotion = emotion;
    if (emotion === 'sleep') {
      this.isHoldingHands = false;
      releaseHands(this, this.partner);
      this.swimState = 'none';
      this.swimTimer = this.joyWiggleTime = this.blushOpacity = 0;
    }
    this.waveTime = emotion === 'sleep' ? 3 : 0;
    this.winkTime = emotion === 'wink' ? 1.1 : 0;
    if (emotion === 'blush') {
      this.blushOpacity = 1.0;
    }
    this.heartMesh.visible = emotion !== 'sleep';
    this.fitToViewport();
  }

  showToast(title, message, icon = '🤖') {
    const toast = document.getElementById('prop-toast');
    if (!toast) return;
    const titleEl = toast.querySelector('.prop-toast-title');
    const msgEl = toast.querySelector('.prop-toast-text');
    const iconEl = toast.querySelector('.prop-toast-icon');

    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    toast.style.display = 'flex';
    toast.classList.remove('hiding');
    toast.classList.add('visible');

    clearTimeout(toast.hideTimer);
    clearTimeout(toast.dismissTimer);
    toast.hideTimer = setTimeout(() => {
      toast.classList.remove('visible');
      toast.classList.add('hiding');
      toast.dismissTimer = setTimeout(() => {
        if (toast.classList.contains('hiding')) toast.style.display = 'none';
      }, 500);
    }, 3800);
  }

  triggerBlush() {
    this.setEmotion('blush');
    this.blushOpacity = 1.0;
    this.joyWiggleTime = 1.6;
    this.waveTime = 3.0; // 2 tay né e lệ trước ngực
    this.motion.kick((Math.random() - 0.5) * 0.14, 0.08);
    this.showToast('✦ WALL-E NGẠI NGÙNG ✦', '/// (>///<) Các bạn nữ chạm liên tục làm mình ngại đỏ mặt rồi nè...', '😳');
  }

  startSwimAway() {
    this.travelController?.cancel();
    this.giftController?.cancel();
    releaseHands(this, this.partner);
    this.swimState = 'shoo';
    this.swimTimer = 0.85; // 0.85s xua tay
    this.blushOpacity = 1.0;
    this.setEmotion('blush');

    // Chọn điểm đến đối diện góc màn hình để bơi sang
    const currentX = this.motion.position.x;
    const destX = currentX > 0 ? -(0.55 + Math.random() * 0.35) : (0.55 + Math.random() * 0.35);
    const destY = (Math.random() - 0.5) * 0.85;
    const destZ = (Math.random() - 0.5) * 0.75;

    this.swimTargetOffset.set(destX, destY, destZ);
    this.swimVelocity.set(destX - currentX, destY - this.motion.position.y, destZ - this.motion.position.z).normalize();
    this.swimHeadingYaw = Math.atan2(this.swimVelocity.x, this.swimVelocity.z);

    this.showToast('✦ WALL-E BƠI TRỐN ✦', '💨 Nhột quá nhột quá! Wall-E bơi tạm ra chỗ khác né đây nha! (≧◡≦)', '💨');
  }

  setPointer(x, y) {
    this.pointer.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
    this.pointerAge = 0;
  }

  triggerHeartBounce(intensity = 1) {
    this.heartTime = 0;
    this.heartIntensity = THREE.MathUtils.clamp(intensity, 0, 1);
    this.beat = this.heartIntensity;
  }

  interactAt(x, y) {
    if (this.emotion === 'sleep') return false;
    this.screenPoint.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.group.updateWorldMatrix(true, true);
    this.raycaster.setFromCamera(this.screenPoint, this.camera);
    if (!this.raycaster.intersectObject(this.model, true).some(hit => hit.object?.visible !== false)) return false;
    this.travelController?.cancel();
    this.giftController?.cancel();

    if (this.isHoldingHands) {
      this.winkTime = 0.75;
      this.triggerHeartBounce(0.85);
      this.blushOpacity = 0.85;
      return true;
    }

    const now = performance.now();
    if (now - this.lastClickTime < 1400) {
      this.clickStreak++;
    } else {
      this.clickStreak = 1;
    }
    this.lastClickTime = now;

    this.winkTime = 0.65;
    this.triggerHeartBounce(0.85);
    this.waveTime = 0;

    if (this.clickStreak >= 4 && this.swimState === 'none') {
      // Cấp độ 2: Bị ấn liên tục dồn dập -> Xua tay bối rối và bơi tít ra chỗ khác!
      this.startSwimAway();
      if (this.partner && typeof this.partner.setEmotion === 'function') {
        this.partner.setEmotion('wink');
      }
    } else if (this.clickStreak >= 2) {
      // Cấp độ 1: Bị ấn liên tục dồn dập -> Đỏ mặt ngại ngùng ///
      this.triggerBlush();
    } else {
      // Ấn lần 1: Nảy vui mừng, nhún nhảy hữu cơ
      this.joyWiggleTime = 1.2;
      this.motion.kick((this.pointer.x || 0.5) * 0.16, 0.18);
    }
    return true;
  }

  fitToViewport() {
    const sleeping = this.emotion === 'sleep';
    if (sleeping) {
      fitSleepingRobotLayout(this);
    } else {
      fitRobotLayout(this);
    }
    if (!this.displayLayout) this.displayLayout = { ...this.layout };
  }

  update(delta, interest) {
    delta = Math.max(0, delta || 0);
    if (!this.motionQuery.matches) this.time += delta;
    this.pointerAge += delta;
    this.waveTime += delta;
    this.heartTime += delta;
    this.winkTime = Math.max(0, this.winkTime - delta);
    this.beat *= Math.exp(-delta * 5);
    const reduced = this.motionQuery.matches;
    const sleeping = this.emotion === 'sleep';
    const smooth = reduced ? 1 : 1 - Math.exp(-delta * 5);
    const gift = this.giftPose;
    if (!sleeping && !reduced && !gift && !this.isTravelling && this.swimState === 'none' && !this.handHoldProgress) {
      this.greetingWait -= delta;
      if (this.greetingWait <= 0) {
        this.waveTime = 0;
        this.greetingWait = 12 + Math.random() * 7;
      }
    }
    const armPose = this.arms.map(arm => ({ x: arm.rotation.x, y: arm.rotation.y, z: arm.rotation.z }));
    if (reduced) this.joyWiggleTime = 0;

    // Cập nhật trạng thái Nắm tay (Hold Hands)
    if (this.swimState === 'shoo') {
      this.swimTimer -= delta;
      if (this.swimTimer <= 0) {
        this.swimState = 'swimming';
        this.swimTimer = 2.4;
      }
    } else if (this.swimState === 'swimming') {
      this.swimTimer -= delta;
      const swimLerp = 1.6 * delta;
      this.motion.position.x += (this.swimTargetOffset.x - this.motion.position.x) * swimLerp;
      this.motion.position.y += (this.swimTargetOffset.y - this.motion.position.y) * swimLerp;
      this.motion.position.z += (this.swimTargetOffset.z - this.motion.position.z) * swimLerp;
      this.motion.velocity.x = this.swimVelocity.x * 0.9;
      this.motion.velocity.y = this.swimVelocity.y * 0.5;
      this.motion.velocity.z = this.swimVelocity.z * 0.9;
      if (this.swimTimer <= 0) {
        this.swimState = 'arriving';
        this.swimTimer = 0.9;
      }
    } else if (this.swimState === 'arriving') {
      this.swimTimer -= delta;
      this.blushOpacity = Math.max(0, this.blushOpacity - delta * 0.6);
      if (this.swimTimer <= 0) {
        this.swimState = 'none';
        this.setEmotion('idle');
      }
    } else {
      this.blushOpacity = Math.max(0, this.blushOpacity - delta * 0.2);
      if (this.blushOpacity === 0 && this.emotion === 'blush') {
        this.setEmotion('idle');
      }
    }

    this.motion.update(delta, reduced, sleeping || this.handHoldProgress > 0 || !!gift || !!this.isTravelling);
    for (const key of ['x','y','pixels','height','roamX','roamY']) {
      this.displayLayout[key] += (this.layout[key] - this.displayLayout[key]) * (reduced ? 1 : 1 - Math.exp(-delta * 4));
    }
    const layout = this.displayLayout;
    const offsetX = this.motion.position.x * layout.roamX;
    const offsetY = this.motion.position.y * layout.roamY;
    const camera = this.camera;
    const depth = 8 + (sleeping || reduced ? 0 : this.motion.position.z * 0.8);
    this.worldPoint.set(layout.x + offsetX / innerWidth * 2, layout.y + offsetY / innerHeight * 2, 0.5).unproject(camera);
    this.rayDirection.copy(this.worldPoint).sub(camera.position).normalize();
    const distance = (depth - camera.position.z) / this.rayDirection.z;
    this.group.position.copy(camera.position).addScaledVector(this.rayDirection, distance);
    const scale = layout.pixels * (2 * Math.tan(camera.fov * Math.PI / 360) * Math.abs(camera.position.z - depth)) / innerHeight / layout.height;
    this.group.scale.setScalar(scale);

    // Wall-E có thể xoay các hướng linh hoạt thay vì chỉ nhìn đối diện màn hình
    const facing = Math.atan2(camera.position.x - this.group.position.x, camera.position.z - depth);
    let targetHeading = facing;

    if (!sleeping && !reduced) {
      if (this.handHoldProgress > 0) {
        targetHeading = facing;
      } else if (this.swimState === 'swimming') {
        targetHeading = this.swimHeadingYaw;
      } else if (this.pointerAge < 2.5) {
        targetHeading = facing + this.pointer.x * 0.5;
      } else {
        targetHeading = facing + this.motion.yaw;
      }
    }

    if (gift) targetHeading = giftAngle(targetHeading, facing + gift.heading, gift.weight);
    const headingSmooth = reduced ? 1 : 1 - Math.exp(-delta * (this.swimState === 'swimming' ? 5.2 : 2.6));
    this.currentHeadingYaw += Math.atan2(Math.sin(targetHeading - this.currentHeadingYaw), Math.cos(targetHeading - this.currentHeadingYaw)) * headingSmooth;

    const driftPitch = reduced || sleeping ? 0 : (-this.motion.velocity.y * 0.32 + Math.sin(this.time * 0.5) * 0.08
      - (this.pointerAge < 2.5 && !this.handHoldProgress ? this.pointer.y * 0.1 : 0));
    const driftRoll = reduced || sleeping ? 0 : (this.motion.velocity.x * 0.25);

    this.flightPitch += (driftPitch - this.flightPitch) * smooth;
    this.flightRoll += (driftRoll - this.flightRoll) * smooth;
    this.group.rotation.set(gift ? giftAngle(this.flightPitch, gift.pitch, gift.weight) : this.flightPitch,
      this.currentHeadingYaw, gift ? giftAngle(this.flightRoll, gift.roll, gift.weight) : this.flightRoll);

    this.floatPivot.rotation.set(
      this.motion.pitch + (reduced || sleeping ? 0 : this.motion.position.z * 0.08),
      reduced || sleeping ? 0 : this.motion.velocity.x * 0.35,
      this.motion.roll + (reduced || sleeping ? 0 : this.motion.velocity.x * 0.12)
    );

    let yaw = 0, pitch = sleeping ? 0.48 : -0.04;
    this.attention = sleeping ? 'sleep' : 'rest';
    if (!sleeping && !reduced) {
      if (this.isHoldingHands && this.partner) {
        this.partner.head.getWorldPosition(this.lookPoint);
        this.attention = 'eve';
      } else if (this.pointerAge < 2.5) {
        this.lookPoint.set(this.pointer.x, this.pointer.y, 0.5).unproject(camera);
        this.rayDirection.copy(this.lookPoint).sub(camera.position).normalize();
        this.lookPoint.copy(camera.position).addScaledVector(this.rayDirection, (13 - camera.position.z) / this.rayDirection.z);
        this.attention = 'pointer';
      } else if (interest?.visible) {
        interest.getWorldPosition(this.lookPoint);
        this.attention = interest.name === 'guide-butterfly' ? 'butterfly' : interest.name.startsWith('prop-') ? 'prop' : 'meteor';
      } else if (this.partner && this.pointerAge > 3.0 && Math.sin(this.time * 0.45) > -0.2) {
        this.partner.head.getWorldPosition(this.lookPoint);
        this.attention = 'eve';
      }
      if (this.attention !== 'rest') {
        this.model.worldToLocal(this.lookPoint).sub(this.head.position);
        yaw = THREE.MathUtils.clamp(Math.atan2(this.lookPoint.x, Math.max(0.8, this.lookPoint.z)), -0.65, 0.65);
        pitch = THREE.MathUtils.clamp(-Math.atan2(this.lookPoint.y, Math.hypot(this.lookPoint.x, this.lookPoint.z)), -0.35, 0.35);
      }
    }

    // 1. Thân mình (Torso): Nhịp thở hữu cơ, chuyển trọng tâm, uốn theo góc nhìn và nảy mừng
    const breatheFreq = sleeping ? 1.0 : 1.8;
    const breathPhase = Math.sin(this.time * breatheFreq);
    const breathY = sleeping ? 0 : breathPhase * 0.032;
    const breathPitch = sleeping ? 0.03 : Math.sin(this.time * breatheFreq - 0.5) * 0.024;
    const breathRoll = sleeping ? 0 : Math.cos(this.time * 0.9) * 0.016;

    const joyWiggle = this.joyWiggleTime > 0 ? Math.sin((1.2 - this.joyWiggleTime) * 16) * this.joyWiggleTime * 0.08 : 0;
    const joyBounce = this.joyWiggleTime > 0 ? Math.abs(Math.sin((1.2 - this.joyWiggleTime) * 20)) * 0.07 : 0;
    this.joyWiggleTime = Math.max(0, this.joyWiggleTime - delta);

    const targetBodyYaw = sleeping ? 0 : yaw * 0.32;
    const targetBodyPitch = sleeping ? 0.05 : breathPitch + pitch * 0.22;
    const targetBodyRoll = breathRoll + (reduced ? 0 : this.motion.velocity.x * 0.16);

    this.bodyYaw += (targetBodyYaw - this.bodyYaw) * smooth;
    this.bodyPitch += (targetBodyPitch - this.bodyPitch) * smooth;
    this.bodyRoll += (targetBodyRoll - this.bodyRoll) * smooth;

    if (reduced) {
      this.body.position.set(0, 1.16, 0);
      this.body.rotation.set(0, 0, 0);
    } else {
      this.body.position.set(0, 1.16 + breathY + joyBounce, 0);
      this.body.rotation.set(this.bodyPitch, this.bodyYaw + joyWiggle, this.bodyRoll);
    }

    // 2. Khớp cổ co giãn (Telescoping Neck) & Đầu vươn tò mò
    let targetExtend = 0;
    if (sleeping) {
      targetExtend = -0.38; // Co cổ rụt vào thân khi ngủ
    } else if (this.attention === 'pointer' || this.attention === 'butterfly') {
      targetExtend = 0.08 + Math.sin(this.time * 1.5) * 0.04; // Vươn cổ ngắm nhìn tò mò
    } else if (this.emotion === 'happy') {
      targetExtend = 0.12;
    }
    if (this.joyWiggleTime > 0) {
      targetExtend += Math.sin((1.2 - this.joyWiggleTime) * 12) * 0.07;
    }

    this.neckExtension += (targetExtend - this.neckExtension) * smooth;

    this.head.position.y = 2.47 + this.neckExtension;
    this.head.position.z = 0.06 + (sleeping ? -0.08 : this.neckExtension * 0.2);

    if (this.neck) {
      this.neck.position.y = 2.04 + this.neckExtension * 0.55;
      this.neck.scale.set(1, Math.max(0.2, 1 + this.neckExtension * 0.9), 1);
      this.neck.rotation.x = sleeping ? 0.06 : -0.19 + (pitch * 0.22);
    }
    if (this.neckBase) {
      this.neckBase.position.y = 1.79 + this.neckExtension * 0.2;
    }

    // 3. Hoạt ảnh đầu nghiêng ngộ nghĩnh (Curiosity Head Tilt)
    const curiosityTilt = (!sleeping && !reduced && (this.attention === 'pointer' || this.attention === 'eve' || this.emotion === 'happy'))
      ? Math.sin(this.time * 1.6) * 0.09
      : 0;
    let targetTilt = (this.isHoldingHands ? -0.18 : this.emotion === 'blush' ? -0.22 : sleeping ? -0.12 : -0.06) + curiosityTilt;
    if (gift) {
      pitch = giftAngle(pitch, gift.head[0], gift.weight);
      yaw = giftAngle(yaw, gift.head[1], gift.weight);
      targetTilt = giftAngle(targetTilt, gift.head[2], gift.weight);
    }

    if (reduced) {
      this.head.rotation.set(pitch, 0, sleeping ? -0.12 : -0.04);
    } else {
      this.head.rotation.y += (yaw - this.head.rotation.y) * smooth;
      this.head.rotation.x += (pitch - this.head.rotation.x) * smooth;
      this.head.rotation.z += (targetTilt - this.head.rotation.z) * smooth;
    }

    // 4. Mắt & Mí mắt nháy sống động với biểu cảm bất đối xứng
    const blinkPhase = this.time % 4.6;
    this.eyes.forEach((eye, i) => {
      const expression = this.emotion === 'happy' ? 0.24 : (sleeping ? -0.08 : 0.14);
      const asymmetric = (!sleeping && !reduced) ? Math.sin(this.time * 2.1 + i * 1.5) * 0.035 : 0;
      eye.rotation.z = (i ? -1 : 1) * expression + asymmetric;
    });

    const blink = sleeping ? 1 : reduced ? 0 : blinkPhase > 4.32 ? Math.sin((blinkPhase - 4.32) / 0.28 * Math.PI) : 0;
    this.lids.forEach(({ mesh, eye, sign }) => {
      const closure = Math.max(blink, !reduced && eye === 1 && this.winkTime > 0 ? 0.92 : 0);
      mesh.visible = closure > 0.01;
      mesh.scale.y = Math.max(0.01, closure);
      mesh.position.y = sign * (0.28 - closure * 0.14);
    });

    // 4.1 Cập nhật độ hiển thị má đỏ anime /// khi ngại ngùng
    this.blushMeshes.forEach(mesh => {
      mesh.material.opacity = this.blushOpacity;
      mesh.visible = this.blushOpacity > 0.01;
    });

    // 5. Bánh xích xe lăn bánh (Treads & Wheels Animation) & Giảm xóc bồng bềnh / Đạp chân bơi
    const speedX = this.motion.velocity.x;
    const speedZ = this.motion.velocity.z;
    const driftVelocity = Math.hypot(speedX, speedZ);
    const isSwimming = (this.swimState === 'swimming');
    const idleRollSpeed = sleeping || reduced ? 0 : (isSwimming ? 5.2 : (0.16 + driftVelocity * 3.6));
    this.treadProgress += delta * idleRollSpeed;

    this.wheels.forEach(({ mesh, side }) => {
      const turnMod = isSwimming ? 0 : (side * yaw * 0.45);
      // The cylinder axle lies on X; spin in the YZ plane of the track shoes.
      mesh.rotation.x += delta * (idleRollSpeed + turnMod) * (isSwimming ? 5.0 : 3.0);
    });

    this.trackShoes.forEach(({ mesh, side, baseAngle }) => {
      const turnMod = isSwimming ? 0 : (side * yaw * 0.45);
      const angle = baseAngle + this.treadProgress * (1 + turnMod);
      mesh.position.y = Math.cos(angle) * 0.4;
      mesh.position.z = Math.sin(angle) * 0.84;
      mesh.rotation.x = Math.atan2(-0.4 * Math.sin(angle), 0.84 * Math.cos(angle));
    });

    if (isSwimming) {
      // Vẫy chân: hai cụm xích đạp nhấp nhô như bơi sải trong không gian
      const stroke = (2.4 - this.swimTimer) * 5.2;
      const kick = Math.sin(stroke * 2.2);
      this.treads[0].position.y = 0.43 + kick * 0.18;
      this.treads[1].position.y = 0.43 - kick * 0.18;
      this.treads[0].rotation.x = kick * 0.38;
      this.treads[1].rotation.x = -kick * 0.38;
    } else {
      this.treads.forEach((tread, i) => {
        const side = (i === 0 ? -1 : 1);
        tread.position.y += (0.43 - tread.position.y) * smooth;
        const suspensionPitch = sleeping ? 0 : Math.sin(this.time * 1.5 + i * 1.2) * 0.025 - (speedZ * 0.22);
        const suspensionRoll = sleeping ? 0 : (speedX * 0.18 * side);
        tread.rotation.x = suspensionPitch;
        tread.rotation.z = suspensionRoll;
      });
    }

    // 6. Cánh tay uyển chuyển 2 bên (Dual Arms Natural Kinematics & Zero-G Balancing)
    const wave = !sleeping && !reduced && this.waveTime < 2.4 ? Math.sin((this.waveTime / 2.4) * Math.PI) : 0;

    if (sleeping) {
      this.arms[0].rotation.set(0.38, 0.15, -0.05);
      this.arms[1].rotation.set(0.38, -0.15, 0.05);
    } else if (this.handHoldProgress > 0) {
      // Tư thế Nắm tay EVE: Tay phải vươn dài chìa về phía EVE, tay trái e ấp
      const reachX = -0.40 * this.handHoldProgress;
      const reachY = 0.85 * this.handHoldProgress;
      const reachZ = -0.10 * this.handHoldProgress;
      this.arms[1].rotation.set(reachX, reachY, reachZ);
      this.arms[0].rotation.set(-0.38 * this.handHoldProgress, 0.22, -0.2);
    } else if (reduced) {
      this.arms[0].rotation.set(-0.12, 0, -0.1);
      this.arms[1].rotation.set(-0.12, 0, 0.1);
    } else if (this.swimState !== 'none') {
      // Keep both hands waving through take-off, flight and the soft landing.
      const amplitude = this.swimState === 'arriving' ? Math.max(0, this.swimTimer / 0.9) : 1;
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        const flutter = Math.sin(this.time * 10 + i * 0.7);
        this.arms[i].rotation.set(-0.2 - amplitude * (0.95 + flutter * 0.15),
          -side * (0.2 + amplitude * flutter * 0.18), side * (0.12 + amplitude * (0.32 + flutter * 0.2)));
      }
    } else if (this.emotion === 'blush' && this.blushOpacity > 0.4) {
      // Ngại ngùng đỏ mặt: hai tay e lệ ôm má/ngực
      const blushTremble = Math.sin(this.time * 16) * 0.03;
      this.arms[0].rotation.set(-0.48 + blushTremble, 0.35, -0.32);
      this.arms[1].rotation.set(-0.48 + blushTremble, -0.35, 0.32);
    } else {
      // Tay trái: bồng bềnh bơi trong không trọng lực & vươn tay với bướm
      const leftReach = (this.attention === 'butterfly') ? 0.36 : 0;
      const leftJoy = (this.emotion === 'happy' || this.joyWiggleTime > 0) ? 0.25 + Math.sin(this.time * 14) * 0.06 : 0;
      const leftIdleX = Math.sin(this.time * 1.5) * 0.08;
      const leftIdleZ = Math.cos(this.time * 1.2) * 0.06;
      const leftIdleY = Math.sin(this.time * 0.9) * 0.05;

      this.arms[0].rotation.x = -0.14 - leftReach - leftJoy + leftIdleX;
      this.arms[0].rotation.y = leftIdleY - (this.bodyYaw * 0.45);
      this.arms[0].rotation.z = -0.12 - leftIdleZ - leftJoy * 0.4;

      // Hai tay chào lệch nhịp nhẹ, rồi trở lại bồng bềnh đối trọng.
      if (wave > 0.01) {
        this.arms[0].rotation.set(-0.14 - wave * 1.1,
          Math.sin(this.waveTime * 12 + 0.65) * wave * 0.18,
          -wave * (0.25 + Math.sin(this.waveTime * 14 + 0.65) * 0.2));
        this.arms[1].rotation.x = -0.15 - wave * 1.25;
        this.arms[1].rotation.y = Math.sin(this.waveTime * 12) * 0.22;
        this.arms[1].rotation.z = wave * (0.28 + Math.sin(this.waveTime * 14) * 0.25);
      } else {
        const rightJoy = (this.emotion === 'happy' || this.joyWiggleTime > 0) ? 0.25 + Math.cos(this.time * 14) * 0.06 : 0;
        const rightIdleX = Math.cos(this.time * 1.5) * 0.08;
        const rightIdleZ = Math.sin(this.time * 1.2) * 0.06;
        const rightIdleY = -Math.sin(this.time * 0.9) * 0.05;

        this.arms[1].rotation.x = -0.14 - rightJoy + rightIdleX;
        this.arms[1].rotation.y = rightIdleY - (this.bodyYaw * 0.45);
        this.arms[1].rotation.z = 0.12 + rightIdleZ + rightJoy * 0.4;
      }
    }

    // 7. Đèn sạc năng lượng mặt trời trước ngực (Solar Meter Lights Pulse)
    for (let i = 0; i < this.arms.length; i++) {
      for (const [index, axis] of ['x', 'y', 'z'].entries()) {
        if (gift) this.arms[i].rotation[axis] = giftAngle(this.arms[i].rotation[axis], gift.arms[i][index], gift.weight);
        const previous = armPose[i][axis];
        const change = this.arms[i].rotation[axis] - previous;
        this.arms[i].rotation[axis] = previous + Math.atan2(Math.sin(change), Math.cos(change)) * (reduced ? 1 : 1 - Math.exp(-delta * 10));
      }
    }

    const chargePhase = (this.time * 2.2) % 3;
    this.chestLights.forEach((light, i) => {
      if (sleeping) {
        light.material.emissiveIntensity = 0.05;
      } else if (this.isHoldingHands) {
        // Khi nắm tay EVE: sạc đầy 100% năng lượng ánh sáng tình yêu!
        light.material.emissiveIntensity = 1.0 + Math.sin(this.time * 8 + i * 2) * 0.35;
      } else {
        const active = (Math.floor(chargePhase) >= i);
        const pulse = active ? 0.75 + Math.sin(this.time * 4 + i) * 0.25 : 0.12;
        light.material.emissiveIntensity = pulse + this.beat * 0.45;
      }
    });

    // 8. Tròng mắt phát quang theo nhịp điệu
    this.lenses.forEach(lens => {
      lens.material.emissiveIntensity = sleeping ? 0.05 : 0.3 + this.beat * 0.2 + (this.joyWiggleTime > 0 ? 0.25 : 0);
    });

    // 9. Trái tim trên đầu nảy đồng bộ
    if (this.heartMesh.visible) {
      const bounce = reduced ? 0 : Math.max(0, Math.sin(this.heartTime * 12) * Math.exp(-this.heartTime * 4)) * this.heartIntensity;
      this.heartMesh.position.y = 3.65 + bounce * 0.5 + this.neckExtension * 0.5;
      this.heartMesh.scale.setScalar(0.52 + bounce * 0.15);
      this.heartMesh.rotation.y = reduced ? 0 : Math.sin(this.time * 0.8) * 0.25;
    }
  }
}
