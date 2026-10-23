/* global THREE */
// Moonlit stargazing, a flowing heart river and the closing wishes.
import { CONFIG } from '../config.js';
import { LunarBloom } from './lunar-bloom.js';

export class FinaleManager {
  constructor(scene3d, wallE, vinylDock, eve = null) {
    this.scene3d = scene3d;
    this.wallE = wallE;
    this.vinylDock = vinylDock;
    this.eve = eve;

    this.finaleLayer = document.getElementById('finale-layer');
    this.streamContainer = document.getElementById('wishes-stream-container');
    this.narrativeBox = document.getElementById('narrative-box');
    this.stageIndicator = document.getElementById('stage-indicator');

    this.isActive = false;
    this.initWishesMarquee();
    this.createScenery();
    this.bloom = new LunarBloom(this);
  }

  // Khởi tạo nội dung dòng lời chúc cuộn vô tận
  initWishesMarquee() {
    if (!this.streamContainer) return;

    const wishes = CONFIG.wishesStream || [];
    // Nhân đôi danh sách lời chúc để tạo hiệu ứng cuộn mượt mà không bị ngắt quãng
    const seamlessList = [...wishes, ...wishes];

    const contentDiv = document.createElement('div');
    contentDiv.className = 'wishes-marquee-content';

    seamlessList.forEach((text, index) => {
      const p = document.createElement('div');
      p.className = 'wish-item';
      p.textContent = text;
      if (index >= wishes.length) p.setAttribute('aria-hidden', 'true');
      contentDiv.appendChild(p);
    });

    this.streamContainer.innerHTML = '';
    this.streamContainer.appendChild(contentDiv);
  }

  // Kích hoạt Màn Kết (Giai đoạn 6)
  activate() {
    if (this.isActive) return;
    this.isActive = true;
    this.previousEnvironment = this.scene3d.scene.environment;
    this.previousLights = [this.scene3d.ambientLight, this.scene3d.dirLight, this.scene3d.fillLight]
      .map(light => ({ light, visible: light.visible }));
    this.previousLights.forEach(({ light }) => { light.visible = false; });
    this.scene3d.scene.environment = this.nightEnvironment.texture;
    this.robotSurfaces.forEach(({ mesh, cinematic }) => { mesh.material = cinematic; });

    // 1. Ẩn hộp thoại cốt truyện trung tâm
    if (this.narrativeBox) {
      this.narrativeBox.style.opacity = '0';
      this.narrativeBox.style.pointerEvents = 'none';
      setTimeout(() => {
        if (this.isActive) this.narrativeBox.style.display = 'none';
      }, 500);
    }

    // 2. Cập nhật thanh chỉ báo trên cùng
    if (this.stageIndicator) {
      this.stageIndicator.textContent = '🌙 Màn Kết: Bên Nhau Ngắm Ngân Hà';
      this.stageIndicator.style.color = '#ffd166';
      this.stageIndicator.style.borderColor = 'rgba(255, 209, 102, 0.4)';
    }

    // 3. Hiển thị layer Màn Kết
    if (this.finaleLayer) {
      this.finaleLayer.style.display = 'flex';
    }

    // Pause the roaming gestures; the moon scene directs the seated poses below.
    if (this.wallE) {
      this.wallE.setEmotion('sleep');
      this.wallE.fitToViewport();
    }
    if (this.eve) {
      this.eve.setEmotion('sleep');
      this.eve.eyeState = 'normal';
      this.eve.fitToViewport();
    }
    this.time = this.elapsed = 0;
    this.bloom.reset();
    this.scenery3D.visible = true;
    this.scenery3D.add(this.backdrop3D);
    this.backgroundEntry = [this.galaxy.material.opacity, this.earth.material.uniforms.opacity.value,
      this.atmosphere.material.uniforms.opacity.value];
    this.exitTime = null;

    // Keep the existing finale starfield and meteor trails.
    if (this.scene3d) {
      this.scene3d.setSeason(6);
      this.scene3d.meteorTimer = this.scene3d.meteorInterval - 2.6;
    }

    // Keep the music controls beside the wishes and clear the foreground shot.
    if (this.vinylDock) {
      this.vinylDock.show();
      if (this.vinylDock.vinyl3DMesh) {
        this.vinylDock.vinyl3DMesh.visible = false;
      }
      if (this.vinylDock.dockContainer) {
        this.vinylDock.dockContainer.classList.add('finale-docked');
      }
      if (this.vinylDock.lyricContainer) {
        this.vinylDock.lyricContainer.classList.add('finale-docked-lyrics');
      }
    }

    console.log('[FinaleManager] Grand Finale Activated!');
  }

  deactivate() {
    if (!this.isActive) return;
    this.isActive = false;
    this.scene3d.scene.environment = this.previousEnvironment;
    this.previousLights.forEach(({ light, visible }) => { light.visible = visible; });
    this.robotSurfaces.forEach(({ mesh, original }) => { mesh.material = original; });
    this.scenery3D.visible = false;
    this.exitTime = 0;
    this.backgroundExit = [this.galaxy.material.opacity, this.earth.material.uniforms.opacity.value,
      this.atmosphere.material.uniforms.opacity.value];
    this.scene3d.scene.add(this.backdrop3D);
    for (const robot of [this.wallE, this.eve]) {
      if (!robot) continue;
      robot.finaleLayout = null;
      robot.arms.forEach(arm => arm.scale.setScalar(1));
    }
    this.wallE.arms.forEach(arm => { arm.position.y = 1.58; });
    this.wallE.treads.forEach(tread => { tread.position.z = 0; });
    if (this.eve) {
      this.eve.body.rotation.set(0, 0, 0);
      this.eve.head.position.x = 0;
    }
    if (this.finaleLayer) {
      this.finaleLayer.style.display = 'none';
    }
    if (this.narrativeBox) {
      this.narrativeBox.style.display = 'flex';
      this.narrativeBox.style.opacity = '1';
      this.narrativeBox.style.pointerEvents = 'auto';
    }
    if (this.vinylDock) {
      if (this.vinylDock.dockContainer) {
        this.vinylDock.dockContainer.classList.remove('finale-docked');
      }
      if (this.vinylDock.lyricContainer) {
        this.vinylDock.lyricContainer.classList.remove('finale-docked-lyrics');
      }
    }
  }

  createScenery() {
    let seed = 20102026;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const sky = document.createElement('canvas');
    sky.width = 2048; sky.height = 1024;
    const ctx = sky.getContext('2d');
    ctx.fillStyle = '#050819'; ctx.fillRect(0, 0, sky.width, sky.height);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 150; i++) {
      const t = random(), x = t * 2400 - 180;
      const y = 930 - t * 850 + Math.sin(t * 9) * 70 + (random() - 0.5) * 160;
      const r = 50 + random() * 190;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, i % 3 ? 'rgba(86,100,170,.14)' : 'rgba(176,114,164,.13)');
      glow.addColorStop(1, 'rgba(15,23,55,0)');
      ctx.fillStyle = glow; ctx.fillRect(x-r, y-r, r*2, r*2);
    }
    for (let i = 0; i < 15000; i++) {
      const t = random();
      const x = t * 2400 - 180;
      const spread = (random() + random() + random() - 1.5) * 140;
      const y = 930 - t * 850 + Math.sin(t * 9) * 70 + spread;
      ctx.fillStyle = `rgba(196,207,242,${0.04 + random() * 0.15})`;
      ctx.beginPath(); ctx.arc(x, y, random() * 0.6 + 0.2, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 1900; i++) {
      const x = random() * sky.width, y = random() * sky.height, r = 0.3 + random() ** 5 * 1.7;
      ctx.fillStyle = `rgba(222,231,255,${0.15 + random() * 0.7})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const skyMap = new THREE.CanvasTexture(sky);
    skyMap.encoding = THREE.sRGBEncoding;
    this.scenery3D = new THREE.Group();
    this.scenery3D.name = 'moon-finale';
    this.scenery3D.visible = false;
    this.backdrop3D = new THREE.Group();
    this.backdrop3D.name = 'finale-celestial-backdrop';
    this.scenery3D.add(this.backdrop3D);
    // Fade through the alpha canvas while staying ahead of opaque robot surfaces in the draw queue.
    this.galaxy = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: skyMap, premultipliedAlpha: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
    this.galaxy.renderOrder = -100;
    this.backdrop3D.add(this.galaxy);
    const loader = new THREE.TextureLoader();
    loader.load('assets/backgrounds/milky-way-eso.jpg', texture => {
      texture.encoding = THREE.sRGBEncoding;
      this.galaxy.material.map = texture;
      this.galaxy.material.needsUpdate = true;
      skyMap.dispose();
    }, undefined, () => {}); // Keep the painted sky if the local photograph is unavailable.

    const earthFallback = new THREE.DataTexture(new Uint8Array([18, 55, 84, 255]), 1, 1);
    earthFallback.needsUpdate = true;
    const cloudFallback = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    cloudFallback.needsUpdate = true;
    const planetVertex = `varying vec2 vUv; varying vec3 vNormal;
      void main(){vUv=uv;vNormal=normalize(normalMatrix*normal);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 80, 64), new THREE.ShaderMaterial({
      uniforms: { surface: { value: earthFallback }, clouds: { value: cloudFallback },
        cloudTime: { value: 0 }, opacity: { value: 0 } },
      vertexShader: planetVertex,
      fragmentShader: `uniform sampler2D surface;uniform sampler2D clouds;uniform float cloudTime;
        uniform float opacity;varying vec2 vUv;varying vec3 vNormal;
        void main(){
          vec3 n=normalize(vNormal);float day=smoothstep(-0.20,0.75,dot(n,normalize(vec3(0.55,0.35,0.85))));
          vec3 photo=texture2D(surface,vUv).rgb;
          vec3 land=pow(photo,vec3(2.2));
          float ocean=smoothstep(0.01,0.07,photo.b-photo.r);
          land=mix(land,vec3(0.006,0.035,0.085),ocean*0.38);
          vec2 cloudUv=vec2(fract(vUv.x+cloudTime*0.0003),vUv.y);
          float cloud=smoothstep(0.12,0.92,texture2D(clouds,cloudUv).r);
          float shade=texture2D(clouds,cloudUv+vec2(0.002,0.001)).r;
          vec3 color=mix(land*(1.0-shade*0.22),vec3(0.82,0.86,0.88),cloud*0.93)*(0.055+day*1.05);
          color+=vec3(0.04,0.25,0.60)*pow(1.0-abs(n.z),6.0)*(0.10+day*0.65);
          gl_FragColor=vec4(color,opacity);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`, transparent: true, depthWrite: true
    }));
    this.earth.name = 'earth-blue-marble';
    this.earth.renderOrder = 1;
    this.atmosphere = new THREE.Mesh(this.earth.geometry, new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 0 } }, vertexShader: planetVertex,
      fragmentShader: `uniform float opacity;varying vec3 vNormal;
        void main(){vec3 n=normalize(vNormal);float rim=pow(1.0-abs(n.z),3.0);
        float sun=0.2+0.8*smoothstep(-0.5,0.8,n.x+n.y*0.35);
        gl_FragColor=vec4(0.10,0.42,0.80,rim*sun*opacity*0.48);}`,
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false
    }));
    this.atmosphere.name = 'earth-atmosphere';
    this.backdrop3D.add(this.earth, this.atmosphere);
    loader.load('assets/backgrounds/earth-blue-marble.jpg', texture => {
      this.earth.material.uniforms.surface.value = texture;
      earthFallback.dispose();
    }, undefined, () => {});
    loader.load('assets/backgrounds/earth-clouds.jpg', texture => {
      texture.wrapS = THREE.RepeatWrapping;
      this.earth.material.uniforms.clouds.value = texture;
      cloudFallback.dispose();
    }, undefined, () => {});

    const surface = document.createElement('canvas');
    surface.width = 1024; surface.height = 512;
    const moonCtx = surface.getContext('2d');
    const grain = moonCtx.createImageData(1024, 512);
    for (let i = 0; i < grain.data.length; i += 4) {
      const value = 140 + random() * 25;
      grain.data[i] = value; grain.data[i+1] = value + 2; grain.data[i+2] = value + 5; grain.data[i+3] = 255;
    }
    moonCtx.putImageData(grain, 0, 0);
    for (let i = 0; i < 45; i++) {
      const x = random() * 1024, y = random() * 512, r = 35 + random() * 95;
      const mare = moonCtx.createRadialGradient(x, y, 0, x, y, r);
      mare.addColorStop(0, 'rgba(39,45,57,.23)'); mare.addColorStop(1, 'rgba(39,45,57,0)');
      moonCtx.fillStyle = mare; moonCtx.fillRect(x-r, y-r, r*2, r*2);
    }
    const moonMap = new THREE.CanvasTexture(surface);
    moonMap.encoding = THREE.sRGBEncoding;
    moonMap.wrapS = moonMap.wrapT = THREE.RepeatWrapping;
    moonMap.repeat.set(12, 6);
    this.craters = Array.from({ length: 65 }, () => ({
      x: (random() - 0.5) * 72, z: random() * 24 - 20, radius: 0.3 + random() ** 2 * 2.2
    }));
    const terrain = new THREE.PlaneGeometry(72, 28, 160, 96);
    terrain.rotateX(-Math.PI / 2); terrain.translate(0, 0, -6);
    const vertices = terrain.attributes.position;
    for (let i = 0; i < vertices.count; i++) vertices.setY(i, this.groundHeight(vertices.getX(i), vertices.getZ(i)));
    terrain.computeVertexNormals();
    this.moon = new THREE.Mesh(terrain,
      new THREE.MeshStandardMaterial({ color: new THREE.Color(0xc5cbd4).convertSRGBToLinear(), map: moonMap, bumpMap: moonMap,
        bumpScale: 0.025, roughness: 1, metalness: 0, transparent: true, opacity: 0 }));
    this.moon.name = 'moon-surface';
    this.moon.receiveShadow = true;
    this.moon.renderOrder = 2;
    this.scenery3D.add(this.moon);
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), this.moon.material, 90);
    const rock = new THREE.Object3D();
    for (let i = 0; i < rocks.count; i++) {
      let x, z;
      do { x = (random()-0.5)*22; z = random()*14-9; }
      while (x > -3 && x < 6 && Math.abs(z) < 2.5);
      const size = 0.025 + random()**3*0.13;
      rock.position.set(x, this.surfaceHeight(x, z) + size*0.25, z);
      rock.rotation.set(random()*2, random()*6, random()*2);
      rock.scale.set(size*(0.7+random()), size*0.6, size*(0.7+random()));
      rock.updateMatrix(); rocks.setMatrixAt(i, rock.matrix);
      rocks.setColorAt(i, new THREE.Color().setScalar(0.65+random()*0.3));
    }
    rocks.name = 'lunar-stones';
    rocks.castShadow = rocks.receiveShadow = true;
    rocks.renderOrder = 3;
    this.moon.add(rocks);
    for (const [slot, file] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']]) {
      loader.load(`assets/backgrounds/moon-regolith-${file}.jpg`, texture => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(12, 6);
        texture.anisotropy = Math.min(8, this.scene3d.renderer.capabilities.getMaxAnisotropy());
        if (slot === 'map') texture.encoding = THREE.sRGBEncoding;
        this.moon.material[slot] = texture;
        if (slot === 'normalMap') this.moon.material.normalScale.set(0.55, 0.55);
        this.moon.material.needsUpdate = true;
        if (slot === 'map') { this.moon.material.bumpMap = null; moonMap.dispose(); }
      }, undefined, () => {});
    }
    this.lightTarget = new THREE.Object3D();
    this.moonLight = new THREE.DirectionalLight(0xffecd1, 1.65);
    this.moonLight.target = this.lightTarget;
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.setScalar(innerWidth <= 768 ? 1024 : 2048);
    Object.assign(this.moonLight.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 55 });
    this.moonLight.shadow.normalBias = 0.015;
    this.moonLight.shadow.bias = -0.0001;
    this.earthLight = new THREE.DirectionalLight(0x8cbcff, 0.75);
    this.earthLight.target = this.lightTarget;
    this.scenery3D.add(this.lightTarget, this.moonLight, this.earthLight,
      new THREE.HemisphereLight(0x9dbae0, 0x434751, 0.3));
    this.createRobotSurfaces(random);
    this.hearts = Array.from({ length: 36 }, (_, i) => {
      const material = new THREE.MeshBasicMaterial({ color: [0xff4d98, 0xffcf7a, 0xce9eff][i % 3],
        transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false });
      const heart = new THREE.Mesh(this.wallE.heartMesh.geometry, material);
      heart.name = `river-heart-${i}`;
      heart.renderOrder = 2;
      this.scenery3D.add(heart);
      return heart;
    });
    this.scene3d.scene.add(this.scenery3D);
    this.point = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.inverseMoon = new THREE.Matrix4();
    this.time = this.elapsed = 0;
  }

  groundHeight(x, z) {
    let height = (this.noise(x * 0.6, z * 0.6) - 0.5) * 0.22
      + (this.noise(x * 2.1, z * 2.1) - 0.5) * 0.065;
    for (const crater of this.craters) {
      const d = Math.hypot(x - crater.x, z - crater.z) / crater.radius;
      if (d < 1.5) height += crater.radius * (0.09 * Math.exp(-(((d - 1) / 0.15) ** 2)) - 0.14 * Math.exp(-d*d*3));
    }
    return height;
  }

  noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let sx = x - ix, sy = y - iy;
    sx = sx*sx*(3-2*sx); sy = sy*sy*(3-2*sy);
    const hash = (a, b) => {
      let n = Math.imul(a, 374761393) + Math.imul(b, 668265263);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const a = hash(ix, iy), b = hash(ix+1, iy), c = hash(ix, iy+1), d = hash(ix+1, iy+1);
    return (a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy;
  }

  createRobotSurfaces(random) {
    const paint = document.createElement('canvas'), grain = document.createElement('canvas');
    paint.width = paint.height = grain.width = grain.height = 512;
    const paintCtx = paint.getContext('2d'), grainCtx = grain.getContext('2d');
    const color = paintCtx.createImageData(512, 512), micro = grainCtx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = (y*512+x)*4;
      const wear = this.noise(x/34, y/34), fine = random();
      const edge = Math.min(x, y, 511-x, 511-y) / 512;
      const chipped = (edge < 0.025 && wear > 0.55)
        || (this.noise(x/8, y/8) > 0.85 && fine > 0.75);
      const variation = (wear-0.5)*25 + (fine-0.5)*8;
      const base = chipped ? [115, 96, 61] : [180, 146, 75];
      for (let c = 0; c < 3; c++) {
        color.data[i+c] = base[c] + variation;
        micro.data[i+c] = 180 + fine*60;
      }
      color.data[i+3] = micro.data[i+3] = 255;
    }
    paintCtx.putImageData(color, 0, 0); grainCtx.putImageData(micro, 0, 0);
    const paintMap = new THREE.CanvasTexture(paint), grainMap = new THREE.CanvasTexture(grain);
    paintMap.encoding = THREE.sRGBEncoding;
    const variants = new Map();
    this.robotSurfaces = [];
    for (const robot of [this.wallE, this.eve]) robot?.model.traverse(mesh => {
      const original = mesh.material;
      if (!original?.isMeshStandardMaterial || original.transparent || original.roughness < 0.2) return;
      let cinematic = variants.get(original);
      if (!cinematic) {
        cinematic = original.clone();
        cinematic.envMapIntensity = 0.4;
        cinematic.bumpMap = grainMap; cinematic.bumpScale = 0.004;
        if (original === this.eve?.hullMat) {
          cinematic.color.set(0xe0e5e2).convertSRGBToLinear();
          cinematic.roughness = 0.55; cinematic.roughnessMap = grainMap;
          cinematic.clearcoat = 0.12; cinematic.clearcoatRoughness = 0.55;
          cinematic.bumpMap = null;
        } else if (original === this.wallE.body.children[0].material) {
          cinematic.map = paintMap; cinematic.roughness = 0.84;
          cinematic.metalness = 0.18; cinematic.clearcoat = 0.03;
          cinematic.bumpScale = 0.0007;
        } else cinematic.roughness = Math.max(0.5, original.roughness);
        variants.set(original, cinematic);
      }
      this.robotSurfaces.push({ mesh, original, cinematic });
    });
    const env = document.createElement('canvas');
    env.width = 512; env.height = 256;
    const ctx = env.getContext('2d');
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, 512, 256);
    for (const [x, y, radius, tint] of [[100, 70, 110, 'rgba(240,214,170,.5)'], [370, 110, 130, 'rgba(105,162,232,.4)']]) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, tint); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(x-radius, y-radius, radius*2, radius*2);
    }
    const texture = new THREE.CanvasTexture(env);
    texture.encoding = THREE.sRGBEncoding;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const generator = new THREE.PMREMGenerator(this.scene3d.renderer);
    this.nightEnvironment = generator.fromEquirectangular(texture);
    generator.dispose(); texture.dispose();
  }

  surfaceHeight(x, z) {
    // Sample the rendered terrain triangles without per-frame raycasts.
    const vertices = this.moon.geometry.attributes.position;
    const gx = THREE.MathUtils.clamp((x + 36) / 0.45, 0, 159.9999);
    const gz = THREE.MathUtils.clamp((z + 20) / (28/96), 0, 95.9999);
    const col = Math.floor(gx), row = Math.floor(gz), sx = gx-col, sz = gz-row;
    const a = vertices.getY(row*161+col), b = vertices.getY((row+1)*161+col);
    const c = vertices.getY((row+1)*161+col+1), d = vertices.getY(row*161+col+1);
    return sx+sz<=1 ? a+(d-a)*sx+(b-a)*sz : c+(b-c)*(1-sx)+(d-c)*(1-sz);
  }

  screenToWorld(x, y, distance, target) {
    const camera = this.scene3d.camera;
    target.set(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2, 0.5).unproject(camera);
    target.sub(camera.position).normalize();
    return target.multiplyScalar(distance / target.dot(this.forward)).add(camera.position);
  }

  seatOnMoon(robot, supports) {
    robot.group.updateWorldMatrix(true, true);
    let lift = -Infinity;
    for (const support of supports) support.traverse(mesh => {
      const vertices = mesh.geometry?.attributes.position;
      if (!vertices) return;
      for (let i = 0; i < vertices.count; i++) {
        this.point.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(this.inverseMoon);
        lift = Math.max(lift, this.surfaceHeight(this.point.x, this.point.z) - this.point.y);
      }
    });
    if (Number.isFinite(lift)) robot.group.position.addScaledVector(this.up, (lift + 0.004) * this.moon.scale.x);
  }

  joinSeatedHands(lift = 0) {
    const w = this.wallE, e = this.eve;
    w.group.updateWorldMatrix(true, true); e.group.updateWorldMatrix(true, true);
    const wallArm = w.arms[0], eveArm = e.arms[1];
    const a = wallArm.getWorldPosition(new THREE.Vector3());
    const b = eveArm.getWorldPosition(new THREE.Vector3());
    const wallReach = w.handTip.length() * w.group.scale.x;
    const eveReach = e.handTip.length() * e.group.scale.x;
    const grip = a.lerp(b, wallReach / (wallReach + eveReach));
    grip.addScaledVector(this.up, lift*w.group.scale.x*.28);
    for (const [arm, tip] of [[wallArm, w.handTip], [eveArm, e.handTip]]) {
      const local = arm.parent.worldToLocal(grip.clone()).sub(arm.position);
      arm.quaternion.setFromUnitVectors(tip.clone().normalize(), local.clone().normalize());
      arm.scale.setScalar(local.length() / tip.length());
    }
  }

  alignGalaxy() {
    const camera = this.scene3d.camera;
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this.screenToWorld(innerWidth / 2, innerHeight / 2, 80, this.galaxy.position);
    this.galaxy.quaternion.copy(camera.quaternion);
    this.galaxy.rotateZ(0.24);
    const skyHeight = 2 * Math.tan(camera.fov * Math.PI / 360) * 80;
    // Cover the viewport after tilting the galactic plane.
    const skyWidth = Math.max(skyHeight * (camera.aspect * 0.972 + 0.238), skyHeight * 2 * (camera.aspect * 0.238 + 0.972)) * 1.03;
    this.galaxy.scale.set(skyWidth, skyWidth / 2, 1);
  }

  update(delta) {
    if (!this.isActive) {
      if (this.exitTime == null) return;
      this.exitTime += delta;
      const fade = this.wallE.motionQuery.matches ? 0 : 1-THREE.MathUtils.smoothstep(this.exitTime, 0, 0.9);
      this.galaxy.material.opacity = this.backgroundExit[0]*fade;
      this.earth.material.uniforms.opacity.value = this.backgroundExit[1]*fade;
      this.atmosphere.material.uniforms.opacity.value = this.backgroundExit[2]*fade;
      this.alignGalaxy();
      if (!fade) { this.scenery3D.add(this.backdrop3D); this.exitTime = null; }
      return;
    }
    if (!this.eve) return;
    const camera = this.scene3d.camera, reduced = this.wallE.motionQuery.matches;
    const story = this.bloom.advance(delta, reduced);
    this.elapsed += delta;
    if (!reduced) this.time += delta;
    const t = Math.min(1, this.elapsed / 1.25);
    const blend = reduced ? 1 : t*t*t*(t*(t*6-15)+10);
    const area = document.querySelector('.finale-scenery').getBoundingClientRect();
    const portrait = innerWidth < innerHeight && innerWidth <= 768;
    const reveal = reduced ? 1 : THREE.MathUtils.smoothstep(this.elapsed, 0, 7);
    const pixels = Math.min(area.height * 0.86, area.width * 0.55, 365) * (0.94 + reveal * 0.06)*(1-story.wish*.035);
    const centerX = area.left + area.width * 0.58;
    const units = 2 * Math.tan(camera.fov * Math.PI / 360) * 18 / innerHeight;
    const scale = pixels * units / 3.4;
    this.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    this.screenToWorld(innerWidth / 2, area.bottom, 18, this.moon.position);
    this.moon.quaternion.copy(camera.quaternion);
    const groundScale = innerWidth * units / 12;
    this.moon.scale.set(groundScale, groundScale, Math.min(groundScale, 1.8));
    this.moon.material.opacity = blend;
    this.moon.updateWorldMatrix(true, false);
    this.inverseMoon.compose(this.moon.position, camera.quaternion, this.moon.scale).invert();
    this.screenToWorld(centerX, area.bottom - pixels*0.45, 18, this.lightTarget.position);
    this.moonLight.position.copy(this.lightTarget.position).add(this.point.set(-8, 12, 6).applyQuaternion(camera.quaternion));
    this.earthLight.position.copy(this.lightTarget.position).add(this.point.set(8, 9, -8).applyQuaternion(camera.quaternion));
    const earthRadius = Math.min(innerHeight * (portrait ? 0.24 : 0.34), innerWidth * (portrait ? 0.34 : 0.23));
    this.screenToWorld(innerWidth * (portrait ? 0.79 : 0.77), innerHeight * (portrait ? 0.36 : 0.19) + (1-reveal)*18, 64, this.earth.position);
    this.earth.scale.setScalar(earthRadius * units * 64 / 18 * (0.96 + reveal * 0.04));
    this.earth.rotation.set(0.12, -1.45 + this.time * 0.004, -0.23);
    this.earth.material.uniforms.cloudTime.value = this.time;
    const earthReveal = reduced ? 1 : THREE.MathUtils.smoothstep(this.elapsed, 0.2, 2.8);
    this.galaxy.material.opacity = this.backgroundEntry[0] + (1-this.backgroundEntry[0])*blend;
    this.earth.material.uniforms.opacity.value = this.backgroundEntry[1] + (1-this.backgroundEntry[1])*blend*earthReveal;
    this.atmosphere.position.copy(this.earth.position);
    this.atmosphere.scale.copy(this.earth.scale).multiplyScalar(1.025);
    this.atmosphere.material.uniforms.opacity.value = this.backgroundEntry[2] + (1-this.backgroundEntry[2])*blend*earthReveal;
    this.alignGalaxy();
    this.scene3d.bgLanternsGroup.userData.opacity = 0;
    this.scene3d.bgLanternsGroup.visible = false;
    this.scene3d.seasonalProps.props[5].opacity = 0;
    this.scene3d.seasonalProps.props[5].group.visible = false;
    this.scene3d.stardustRiver.visible = false;
    this.scene3d.stardustRiver.userData.opacity = 0;

    const w = this.wallE, e = this.eve;
    const attention = (reduced ? 1 : THREE.MathUtils.smootherstep(this.bloom.age, .8, 4))*(1-story.lean)*(1-story.wish*.5);
    const previous = [w, e].map(robot => ({ position: robot.group.position.clone(), scale: robot.group.scale.x,
      rotation: robot.group.rotation.clone() }));
    w.body.position.y = 0.96;
    w.body.rotation.x = -0.12;
    w.head.position.y = 2.25 + (reduced ? 0 : Math.sin(this.time * 0.8) * 0.018);
    w.head.rotation.set(-0.24 + attention*.28 + story.lean*.09,
      -0.10-attention*.3 + (reduced ? 0 : Math.sin(this.time * 0.35) * 0.035), -0.04-story.lean*.10);
    w.neck.position.y = 1.86; w.neck.scale.y = 0.9;
    w.neckBase.position.y = 1.64;
    w.lids.forEach(({mesh}) => { mesh.visible = false; });
    w.lenses.forEach(lens => { lens.material.emissiveIntensity = 0.4; });
    w.arms.forEach(arm => { arm.position.y = 1.48; });
    w.arms[1].rotation.set(0.22, -0.2, 0.16);
    w.treads.forEach(tread => { tread.position.z = 0.18; tread.rotation.x = -0.16; });
    e.head.rotation.set(-0.22+attention*.32, -0.08+attention*.4 + (reduced ? 0 : Math.sin(this.time * 0.35 + 0.8) * 0.035), .06-story.lean*.24);
    e.head.position.x = story.lean*.12;
    e.body.rotation.x = -0.22;
    e.arms[0].rotation.set(0.1, 0, -0.1);
    for (const [i, robot] of [w, e].entries()) {
      robot.group.scale.setScalar(scale * (i ? 0.9 : 1));
      this.screenToWorld(centerX + (i ? 0.31 : -0.31) * pixels, area.bottom, 18, robot.group.position);
      robot.group.quaternion.copy(camera.quaternion);
      robot.group.rotateY(Math.PI - 0.18);
      robot.group.rotateX(-0.03);
      robot.group.rotateZ(i ? .035-story.lean*.14 : -.035);
    }
    this.seatOnMoon(w, w.treads);
    this.seatOnMoon(e, [e.body]);
    this.joinSeatedHands(attention*.6+story.charge*(1-story.plant)*.4);
    this.bloom.update(story, reduced);
    for (const [i, robot] of [w, e].entries()) {
      const old = previous[i];
      // The passage owns the arrival pose; a second blend can flip its rotation path.
      const arrival = robot.isTravelling ? 1 : blend;
      robot.group.position.lerp(old.position, 1 - arrival);
      robot.group.scale.setScalar(old.scale + (robot.group.scale.x - old.scale) * arrival);
      for (const axis of ['x', 'y', 'z']) {
        const change = robot.group.rotation[axis] - old.rotation[axis];
        robot.group.rotation[axis] = old.rotation[axis] + Math.atan2(Math.sin(change), Math.cos(change)) * arrival;
      }
      if (i) robot.headingYaw = robot.group.rotation.y;
      else robot.currentHeadingYaw = robot.group.rotation.y;
      this.point.copy(robot.group.position).project(camera);
      const depth = -robot.group.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
      robot.finaleLayout = { x: this.point.x, y: this.point.y, pixels: robot.group.scale.x * innerHeight * robot.layout.height
        / (2 * Math.tan(camera.fov * Math.PI / 360) * depth), height: robot.layout.height, roamX: 0, roamY: 0 };
      Object.assign(robot.displayLayout, robot.finaleLayout);
    }
    w.group.updateWorldMatrix(true, true); e.group.updateWorldMatrix(true, true);
    const wh = w.head.getWorldPosition(new THREE.Vector3()).project(camera);
    const eh = e.head.getWorldPosition(new THREE.Vector3()).project(camera);
    const startX = (wh.x + eh.x + 2) * innerWidth / 4;
    const startY = (1 - Math.max(wh.y, eh.y)) * innerHeight / 2 - Math.max(12, pixels * 0.06);
    const endX = innerWidth - 24, endY = innerWidth <= 768 ? 118 : 56;
    const bend = Math.min(58, (endX - startX) * 0.12);
    const heartSize = Math.min(innerWidth < 600 ? 8 : 11, Math.hypot(endX - startX, endY - startY) / this.hearts.length * 0.9);
    this.hearts.forEach((heart, i) => {
      const progress = (i / this.hearts.length + this.time / 18) % 1;
      const curve = Math.sin(progress * Math.PI);
      const x = startX + (endX - startX) * progress + Math.sin(progress * Math.PI * 2) * curve * bend
        + Math.sin(i * 2.4) * curve * 6;
      const y = startY + (endY - startY) * progress - curve * 14;
      this.screenToWorld(x, y, 10, heart.position);
      heart.quaternion.copy(camera.quaternion);
      heart.rotateZ(Math.sin(this.time * 0.7 + i) * 0.18);
      heart.scale.setScalar(heartSize * (0.8 + Math.sin(i * 1.9) * 0.18) * units * 10 / 18);
      heart.material.opacity = blend * Math.min(1, progress / 0.07, (1 - progress) / 0.18) * 0.65;
    });
  }
}
