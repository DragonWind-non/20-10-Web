/* global THREE */
import { momentEase as ease } from './pair-moments.js';

export function sampleLunarBloom(time) {
  return {
    charge: ease(0, 2.8, time), plant: ease(2.8, 5.2, time),
    sprout: ease(5.3, 7.5, time), flower: ease(7.1, 10, time),
    wave: ease(8.5, 9.8, time)*(1-ease(12.5, 15, time)),
    wish: ease(11.5, 13.5, time), lean: ease(14, 18, time)
  };
}

export class LunarBloom {
  constructor(finale) {
    this.finale = finale;
    this.panel = document.getElementById('finale-ritual');
    this.button = document.getElementById('finale-wish');
    this.story = document.getElementById('finale-story');
    this.wishes = document.querySelector('.wishes-stream-column');
    this.button.addEventListener('click', event => { event.stopPropagation(); this.sendWish(); });
    document.getElementById('finale-read').addEventListener('click', event => {
      event.stopPropagation();
      this.time = 18;
      this.phase = 'settled';
      this.showWishes();
    });
    this.point = new THREE.Vector3();
    this.hand = new THREE.Vector3();
    this.ground = new THREE.Vector3();
    this.localGround = new THREE.Vector3();
    this.root = new THREE.Group();
    this.root.name = 'lunar-wish-bloom';
    const gold = new THREE.MeshStandardMaterial({ color: 0xe9cd95, emissive: 0xc0a567, emissiveIntensity: .8, roughness: .48 });
    this.seed = new THREE.Mesh(new THREE.IcosahedronGeometry(.13, 2), gold);
    this.seed.scale.set(.7, 1, .7);
    this.root.add(this.seed);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(.025, .08, 1, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xb9eafa, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.root.add(this.beam);
    this.flower = new THREE.Group();
    this.flower.name = 'moon-flower';
    const green = new THREE.MeshStandardMaterial({ color: 0x679d86, emissive: 0x20483a, roughness: .7 });
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(), new THREE.Vector3(-.06, .25, .01),
      new THREE.Vector3(.045, .55, -.02), new THREE.Vector3(0, .85, 0)
    ]);
    this.flower.add(new THREE.Mesh(new THREE.TubeGeometry(path, 20, .023, 7, false), green));
    const leafGeo = new THREE.SphereGeometry(1, 14, 8);
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(leafGeo, green);
      leaf.position.set(side*.13, side < 0 ? .3 : .46, 0);
      leaf.scale.set(.21, .035, .09); leaf.rotation.z = side*.5;
      this.flower.add(leaf);
    }
    this.petals = [];
    const satin = new THREE.MeshStandardMaterial({ color: 0xf2b6b3, emissive: 0xab4f64,
      emissiveIntensity: .25, roughness: .42, metalness: .08, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const pivot = new THREE.Group();
      pivot.position.y = .85; pivot.rotation.y = i/9*Math.PI*2;
      const petal = new THREE.Mesh(leafGeo, satin);
      petal.position.set(0, .1, .13); petal.scale.set(.12, .21, .045);
      pivot.add(petal); this.flower.add(pivot); this.petals.push(pivot);
    }
    const heart = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 8), gold);
    heart.position.y = .87; this.flower.add(heart);
    this.flower.visible = false;
    this.root.add(this.flower);
    this.light = new THREE.PointLight(0xffd6a5, 0, 8, 2);
    this.root.add(this.light);
    this.wave = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 80),
      new THREE.MeshBasicMaterial({ color: 0xf5d3a5, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.wave.rotation.x = -Math.PI/2;
    this.root.add(this.wave);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, '#fffaf0'); gradient.addColorStop(.2, '#ffe4b6'); gradient.addColorStop(1, '#ffe4b600');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32);
    const positions = new Float32Array(72*3);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.sparks = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffe5ba,
      size: .085, map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparks.frustumCulled = false;
    this.root.add(this.sparks);
    finale.scenery3D.add(this.root);
  }

  reset() {
    this.age = this.time = 0;
    this.phase = 'arrival';
    this.panel.hidden = false;
    this.button.disabled = true;
    this.button.hidden = false;
    this.button.textContent = 'Hai bạn đang ươm một điều nhỏ bé…';
    this.story.textContent = 'Đi hết bốn mùa, hai bạn vẫn giữ lại một hạt mầm.';
    this.finale.finaleLayer.classList.add('is-unfolding');
    this.wishes.inert = true;
    this.wishes.setAttribute('aria-hidden', 'true');
    const marquee = this.wishes.querySelector('.wishes-marquee-content');
    // Reset the existing marquee only when starting a new visit.
    marquee.getAnimations().forEach(animation => { animation.currentTime = 0; });
    this.root.visible = true;
  }

  sendWish() {
    if (this.phase !== 'ready' || this.finale.wallE.isTravelling || this.finale.eve.isTravelling) return;
    this.phase = 'growing';
    this.time = 0;
    this.button.disabled = true;
    this.story.textContent = 'Một chút ánh sáng của EVE. Một chút nâng niu của WALL-E.';
    this.button.textContent = 'Điều ước của các bạn nữ đang nở hoa…';
    this.story.focus({ preventScroll: true });
    if (this.finale.wallE.motionQuery.matches) {
      this.time = 18;
      this.phase = 'settled';
      this.showWishes();
    }
  }

  showWishes() {
    this.finale.finaleLayer.classList.remove('is-unfolding');
    this.wishes.inert = false;
    this.wishes.removeAttribute('aria-hidden');
    if (this.panel.contains(document.activeElement)) this.finale.streamContainer.focus({ preventScroll: true });
    this.panel.hidden = true;
  }

  advance(delta, reduced) {
    if (this.finale.wallE.isTravelling || this.finale.eve.isTravelling) {
      return sampleLunarBloom(this.phase === 'growing' || this.phase === 'settled' ? this.time : -1);
    }
    this.age += delta;
    if (this.phase === 'arrival' && (this.age >= 5.5 || reduced)) {
      this.phase = 'ready';
      this.button.disabled = false;
      this.button.textContent = '✧ Chạm để gửi một điều ước';
      this.story.textContent = 'Cùng hai bạn đánh thức một mầm xanh nhé.';
    }
    if (this.phase === 'growing') {
      this.time = reduced ? 18 : Math.min(18, this.time+delta);
      if (this.time >= 11.5 && !this.button.hidden) {
        this.button.hidden = true;
        this.story.textContent = 'Mình mong những điều dịu dàng luôn nở hoa trong cuộc đời các bạn nữ.';
      }
      if (this.time >= 18) { this.phase = 'settled'; this.showWishes(); }
    }
    return sampleLunarBloom(this.phase === 'growing' || this.phase === 'settled' ? this.time : -1);
  }

  update(c, reduced) {
    const f = this.finale, w = f.wallE, e = f.eve, camera = f.scene3d.camera;
    w.group.updateWorldMatrix(true, true); e.group.updateWorldMatrix(true, true);
    w.arms[0].localToWorld(this.hand.copy(w.handTip));
    this.hand.addScaledVector(f.up, w.group.scale.x*.14);
    this.hand.addScaledVector(f.forward, -w.group.scale.x*.12);
    this.localGround.copy(w.group.position).lerp(e.group.position, .5).applyMatrix4(f.inverseMoon);
    this.localGround.z += 1.1;
    this.localGround.y = f.surfaceHeight(this.localGround.x, this.localGround.z)+.008;
    this.ground.copy(this.localGround).applyMatrix4(f.moon.matrixWorld);
    this.seed.position.copy(this.hand).lerp(this.ground, c.plant);
    const size = w.group.scale.x;
    const reveal = reduced ? 1 : ease(.8, 3.2, this.age);
    this.seed.visible = c.sprout < .99 && reveal > .01;
    this.seed.scale.setScalar(size*(.65+c.charge*.35)*reveal*(1-c.sprout));
    this.seed.quaternion.copy(camera.quaternion);
    this.beam.position.copy(this.hand).lerp(this.seed.position, .5);
    this.point.copy(this.seed.position).sub(this.hand);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.point.clone().normalize());
    this.beam.scale.set(size, this.point.length(), size);
    this.beam.material.opacity = c.plant*(1-c.sprout)*.12;
    this.beam.visible = this.beam.material.opacity > .001;
    this.flower.position.copy(this.ground);
    this.flower.quaternion.copy(camera.quaternion);
    this.flower.scale.setScalar(size*c.sprout*1.3);
    this.flower.visible = c.sprout > .001;
    this.petals.forEach((petal, i) => { petal.rotation.x = .1+c.flower*(1+Math.sin(i*1.7)*.12); });
    this.wave.position.copy(this.ground).addScaledVector(f.up, .012);
    this.wave.quaternion.copy(camera.quaternion); this.wave.rotateX(-Math.PI/2);
    this.wave.scale.setScalar(size*(.3+ease(8.5, 15, this.time)*5));
    this.wave.material.opacity = reduced ? 0 : c.wave*.26;
    this.light.position.copy(this.seed.visible ? this.seed.position : this.ground).addScaledVector(f.up, size*.45);
    this.light.intensity = reveal*(.15+c.charge*.6+c.flower*.45);
    this.light.distance = size*8;
    this.sparks.position.copy(this.ground);
    this.sparks.quaternion.copy(camera.quaternion);
    this.sparks.scale.setScalar(size);
    const positions = this.sparks.geometry.attributes.position;
    const flight = ease(8.8, 16.5, this.time);
    for (let i = 0; i < positions.count; i++) {
      const angle = i*2.39996+flight*.8;
      const radius = (.2+(i%13)/13*3.4)*flight;
      positions.setXYZ(i, Math.cos(angle)*radius,
        .8+flight*(2+(i%17)/17*6), Math.sin(angle)*radius*(i%2 ? 1 : -1));
    }
    positions.needsUpdate = true;
    this.sparks.material.opacity = reduced ? 0 : ease(8.8, 10, this.time)*(1-ease(15, 18, this.time))*.75;
    this.sparks.visible = this.sparks.material.opacity > .001;
  }
}
