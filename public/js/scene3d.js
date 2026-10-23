import { SeasonalWorld } from './seasonal-world.js';
import { SeasonalProps } from './seasonal-props.js';
// js/scene3d.js - Không gian vũ trụ 3D, Hạt 4 Mùa & Hiệu ứng Vệt Sáng (Đã vá lỗi Code Review)
/* global THREE */

export class Scene3D {
  constructor(canvasElement) {
    this.canvas = canvasElement || document.getElementById('webgl-canvas');
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Objects
    this.starfield = null;
    this.meteors = [];
    this.meteorTimer = 7.5; // Xuất hiện đợt đầu sau 2.5s, sau đó lặp lại mỗi 10s
    this.meteorInterval = 10.0; // Chu kỳ ~10s 1 lần
    this.ambientLight = null;
    this.dirLight = null;

    // State
    this.currentStage = 1;
    this.targetCameraPos = { x: 0, y: 0, z: 25 };
    this.cameraPos = { x: 0, y: 0, z: 25 };
    this.targetCameraLookAt = { x: 0, y: 0, z: 0 };
    this.cameraLookAt = { x: 0, y: 0, z: 0 };

    this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.isWarping = false;
    this.warpFactor = 0;
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.targetLightColor = new THREE.Color(0xbccff7);
    this.targetFogColor = new THREE.Color(0x060713);
    this.targetFogDensity = 0.015;

    // Seasonal Background 3D Objects
    this.winterDiamondDust = null;
    this.macroStarsGroup = null;
    this.stardustRiver = null;
    this.bgLanternsGroup = null;
    this.bgLanterns = [];

    this.particleTextures = {};
    this.init();
  }

  init() {
    if (typeof THREE === 'undefined') {
      console.error('[Scene3D] Three.js chưa được load!');
      return;
    }

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060713, 0.015);

    // 2. Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 25);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, innerWidth < 768 ? 1.5 : 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lights
    this.ambientLight = new THREE.HemisphereLight(0xdce9ff, 0x493d5e, 0.5);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffedcb, 1.05);
    this.dirLight.position.set(10, 20, 15);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.dirLight.shadow.camera, { left: -26, right: 26, top: 24, bottom: -24, near: 1, far: 85 });
    this.dirLight.shadow.normalBias = 0.025;
    this.dirLight.shadow.bias = -0.0002;
    this.scene.add(this.dirLight);
    this.fillLight = new THREE.DirectionalLight(0xbccff7, 0.45);
    this.fillLight.position.set(-10, 4, 9);
    this.scene.add(this.fillLight);
    this.createEnvironment();

    // 5. Generate Procedural Textures
    this.generateProceduralTextures();

    // 6. Build Starfield, 4-Seasons Particles & Interactive Seasonal 3D Props
    this.createStarfield();
    this.createSeasonParticles();
    this.createMeteorsPool();
    this.seasonalProps = new SeasonalProps(this.scene, this.camera);
    this.createWinterDiamondDust();
    this.createMacroStars();
    this.createStardustRiver();
    this.createBackgroundSkyLanterns();

    // 7. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));

    // 8. Start Render Loop
    this.renderer.render(this.scene, this.camera);
    console.log('[Scene3D] Three.js Scene initialized with optimized particle budget!');
  }

  createEnvironment() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#b9cbea'); sky.addColorStop(0.45, '#646c8a');
    sky.addColorStop(0.65, '#38364a'); sky.addColorStop(1, '#766654');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 256);
    const light = ctx.createRadialGradient(145, 72, 5, 145, 72, 100);
    light.addColorStop(0, '#fff4df'); light.addColorStop(0.3, '#d6d3d2'); light.addColorStop(1, 'rgba(190,195,212,0)');
    ctx.fillStyle = light; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#b8c8e4'; ctx.fillRect(350, 45, 22, 95);
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.encoding = THREE.sRGBEncoding;
    const generator = new THREE.PMREMGenerator(this.renderer);
    this.environment = generator.fromEquirectangular(texture);
    this.scene.environment = this.environment.texture;
    texture.dispose(); generator.dispose();
  }

  generateProceduralTextures() {
    // Texture 1: Star Dot / Tuyết sao
    const canvasStar = document.createElement('canvas');
    canvasStar.width = 64; canvasStar.height = 64;
    const ctxStar = canvasStar.getContext('2d');
    const gradStar = ctxStar.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradStar.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradStar.addColorStop(0.3, 'rgba(190, 255, 255, 0.8)');
    gradStar.addColorStop(0.7, 'rgba(100, 200, 255, 0.2)');
    gradStar.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctxStar.fillStyle = gradStar;
    ctxStar.fillRect(0, 0, 64, 64);
    this.particleTextures.star = new THREE.CanvasTexture(canvasStar);

    // Texture 2: Sao Kim Cương 4 Cánh Lấp Lánh (Diffraction Cross Flare Star)
    const canvasCross = document.createElement('canvas');
    canvasCross.width = 128;
    canvasCross.height = 128;
    const ctxCross = canvasCross.getContext('2d');
    const gradCoreC = ctxCross.createRadialGradient(64, 64, 0, 64, 64, 48);
    gradCoreC.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradCoreC.addColorStop(0.18, 'rgba(255, 240, 255, 0.95)');
    gradCoreC.addColorStop(0.45, 'rgba(180, 220, 255, 0.45)');
    gradCoreC.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctxCross.fillStyle = gradCoreC;
    ctxCross.fillRect(0, 0, 128, 128);

    const gradH = ctxCross.createLinearGradient(0, 64, 128, 64);
    gradH.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradH.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    gradH.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctxCross.fillStyle = gradH;
    ctxCross.fillRect(0, 62, 128, 4);

    const gradV = ctxCross.createLinearGradient(64, 0, 64, 128);
    gradV.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradV.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    gradV.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctxCross.fillStyle = gradV;
    ctxCross.fillRect(62, 0, 4, 128);
    this.particleTextures.starCross = new THREE.CanvasTexture(canvasCross);

    // Texture 5: Đầu Sao Băng Lóe Sáng Rực Rỡ (Meteor Head Flare)
    const canvasHead = document.createElement('canvas');
    canvasHead.width = 128;
    canvasHead.height = 128;
    const ctxHead = canvasHead.getContext('2d');
    const gradHead = ctxHead.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradHead.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradHead.addColorStop(0.12, 'rgba(255, 255, 255, 0.95)');
    gradHead.addColorStop(0.32, 'rgba(210, 245, 255, 0.7)');
    gradHead.addColorStop(0.65, 'rgba(120, 210, 255, 0.25)');
    gradHead.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctxHead.fillStyle = gradHead;
    ctxHead.fillRect(0, 0, 128, 128);

    // Tia lóe sáng chữ thập (Cross Flare Spikes)
    const gradRayH = ctxHead.createLinearGradient(0, 64, 128, 64);
    gradRayH.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradRayH.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
    gradRayH.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctxHead.fillStyle = gradRayH;
    ctxHead.fillRect(0, 62, 128, 4);

    const gradRayV = ctxHead.createLinearGradient(64, 0, 64, 128);
    gradRayV.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradRayV.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
    gradRayV.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctxHead.fillStyle = gradRayV;
    ctxHead.fillRect(62, 0, 4, 128);
    this.particleTextures.meteorHead = new THREE.CanvasTexture(canvasHead);

    // Texture 6: Thân Vệt Sao Băng Dài Phát Sáng (Long Glowing Trail)
    const canvasTrail = document.createElement('canvas');
    canvasTrail.width = 512;
    canvasTrail.height = 64;
    const ctxTrail = canvasTrail.getContext('2d');

    // Gradient ngang: Đuôi mờ dần về 0 -> Đầu rực sáng 1.0
    const gradTrail = ctxTrail.createLinearGradient(0, 0, 512, 0);
    gradTrail.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradTrail.addColorStop(0.15, 'rgba(120, 210, 255, 0.08)');
    gradTrail.addColorStop(0.5, 'rgba(160, 230, 255, 0.45)');
    gradTrail.addColorStop(0.85, 'rgba(230, 250, 255, 0.85)');
    gradTrail.addColorStop(1.0, 'rgba(255, 255, 255, 1.0)');
    ctxTrail.fillStyle = gradTrail;
    ctxTrail.fillRect(0, 0, 512, 64);

    // Lõi sáng trắng ở trung tâm dải vệt
    const gradCore = ctxTrail.createLinearGradient(0, 0, 0, 64);
    gradCore.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradCore.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');
    gradCore.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctxTrail.globalCompositeOperation = 'destination-in';
    ctxTrail.fillStyle = gradCore;
    ctxTrail.fillRect(0, 0, 512, 64);
    ctxTrail.globalCompositeOperation = 'source-over';
    this.particleTextures.meteorTrail = new THREE.CanvasTexture(canvasTrail);
  }

  // 1. Dải Ngân Hà Sao Vô Cực (Vá lỗi Issue 5: Giới hạn ngân sách hạt <= 1200)
  createStarfield() {
    const isMobile = window.innerWidth < 768;
    const starCount = isMobile ? 550 : 750;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const baseColor1 = new THREE.Color(0xffb8dd);
    const baseColor2 = new THREE.Color(0xbeffff);
    const baseColor3 = new THREE.Color(0xffd166);

    for (let i = 0; i < starCount; i++) {
      const radius = 60 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const colorPick = Math.random();
      const col = colorPick < 0.4 ? baseColor1 : colorPick < 0.7 ? baseColor2 : baseColor3;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.52,
      vertexColors: true,
      map: this.particleTextures.star,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  // 2. Hệ Thống Hạt Môi Trường 4 Mùa (Vá lỗi Issue 5: Giới hạn hạt tối ưu)
  createSeasonParticles() {
    this.seasonWorld = new SeasonalWorld(this.scene);
  }

  createMeteorRibbonGeometry(length, headWidth, tailWidth) {
    // 2 mặt phẳng chéo vuông góc hình chữ thập (+) để vệt sao băng luôn dày đẹp ở mọi góc nhìn
    const positions = new Float32Array([
      // Mặt 1: Mặt phẳng XY
      0, headWidth / 2, 0,        // 0: Đầu trên
      0, -headWidth / 2, 0,       // 1: Đầu dưới
      -length, -tailWidth / 2, 0, // 2: Đuôi dưới
      -length, tailWidth / 2, 0,  // 3: Đuôi trên

      // Mặt 2: Mặt phẳng XZ
      0, 0, headWidth / 2,        // 4: Đầu trước
      0, 0, -headWidth / 2,       // 5: Đầu sau
      -length, 0, -tailWidth / 2, // 6: Đuôi sau
      -length, 0, tailWidth / 2   // 7: Đuôi trước
    ]);

    const uvs = new Float32Array([
      // Mặt 1
      1, 0,
      1, 1,
      0, 1,
      0, 0,
      // Mặt 2
      1, 0,
      1, 1,
      0, 1,
      0, 0
    ]);

    const indices = [
      0, 1, 2,  0, 2, 3, // Mặt 1
      4, 5, 6,  4, 6, 7  // Mặt 2
    ];

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    return geom;
  }

  // 3. Sao Băng Lóe Sáng Vụt Qua (Meteors Pool - Dài, Rực Rỡ & Đôi Tiamat Your Name)
  createMeteorsPool() {
    this.meteorCount = 3;
    const meteorConfigs = [
      // Meteor 0: Sao băng chủ đạo (Alpha) - Trắng lam rực rỡ, dài 38 unit
      { length: 19, headWidth: 0.07, tailWidth: 0.008, flareSize: 0.65, trailColor: 0xffffff, headColor: 0xffffff, sparkColor: 0xbeffff },
      // Meteor 1: Sao băng chẻ nhánh Your Name (Tiamat Rose Companion) - Hồng đào / Ánh vàng, dài 28 unit
      { length: 15, headWidth: 0.055, tailWidth: 0.006, flareSize: 0.50, trailColor: 0xffb8dd, headColor: 0xffe6f2, sparkColor: 0xff70a6 },
      // Meteor 2: Sao băng phụ (Stardust Echo) - Vàng stardust, dài 22 unit
      { length: 11, headWidth: 0.04, tailWidth: 0.005, flareSize: 0.40, trailColor: 0xffd166, headColor: 0xfff0b3, sparkColor: 0xffd166 }
    ];

    for (let i = 0; i < this.meteorCount; i++) {
      const cfg = meteorConfigs[i];
      const geom = this.createMeteorRibbonGeometry(cfg.length, cfg.headWidth, cfg.tailWidth);

      // Thân vệt sao băng dài phát sáng
      const trailMat = new THREE.MeshBasicMaterial({
        map: this.particleTextures.meteorTrail,
        color: cfg.trailColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const trailMesh = new THREE.Mesh(geom, trailMat);

      // Đầu sao băng lóe sáng bừng nở (Lens flare head)
      const headMat = new THREE.SpriteMaterial({
        map: this.particleTextures.meteorHead,
        color: cfg.headColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const headSprite = new THREE.Sprite(headMat);
      headSprite.scale.set(cfg.flareSize, cfg.flareSize, 1);
      headSprite.position.set(0, 0, 0);

      // Bụi sao lấp lánh rơi rụng dọc thân
      const sparkCount = 10;
      const sparkPositions = new Float32Array(sparkCount * 3);
      for (let s = 0; s < sparkCount; s++) {
        sparkPositions[s * 3] = -Math.random() * cfg.length * 0.85;
        sparkPositions[s * 3 + 1] = (Math.random() - 0.5) * (cfg.headWidth * 1.5);
        sparkPositions[s * 3 + 2] = (Math.random() - 0.5) * (cfg.headWidth * 1.5);
      }
      const sparkGeom = new THREE.BufferGeometry();
      sparkGeom.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
      const sparkMat = new THREE.PointsMaterial({
        map: this.particleTextures.star,
        size: 1.8,
        color: cfg.sparkColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sparkPoints = new THREE.Points(sparkGeom, sparkMat);

      const meteorGroup = new THREE.Group();
      meteorGroup.add(trailMesh);
      meteorGroup.add(headSprite);
      meteorGroup.add(sparkPoints);
      meteorGroup.visible = false;

      meteorGroup.userData = {
        id: i,
        trailMesh,
        headSprite,
        sparkPoints,
        trailMat,
        headMat,
        sparkMat,
        flareSize: cfg.flareSize,
        active: false,
        progress: 0,
        duration: 1.25,
        delay: 0,
        startPos: new THREE.Vector3(),
        endPos: new THREE.Vector3(),
        dir: new THREE.Vector3()
      };

      this.scene.add(meteorGroup);
      this.meteors.push(meteorGroup);
    }
  }

  // 4. Bụi Kim Cương Băng Giá 3D Mùa Đông (Winter Diamond Dust - GĐ 5)
  createWinterDiamondDust() {
    const count = window.innerWidth < 768 ? 160 : 300;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);

    const c1 = new THREE.Color(0xdcf5ff);
    const c2 = new THREE.Color(0xebd4ff);
    const c3 = new THREE.Color(0xffffff);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 28;
      positions[i * 3 + 2] = -6 + Math.random() * 22;

      const p = Math.random();
      const col = p < 0.45 ? c1 : p < 0.75 ? c2 : c3;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 1.0 + Math.random() * 2.0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      map: this.particleTextures.star,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.winterDiamondDust = new THREE.Points(geom, mat);
    this.winterDiamondDust.visible = false;
    this.winterDiamondDust.userData = {
      phases,
      speeds,
      count,
      opacity: 0
    };
    this.scene.add(this.winterDiamondDust);
  }

  // 5. Sao Lớn 3D Lấp Lánh 4 Cánh (Macro Twinkling Stars - GĐ 6 Grand Finale)
  createMacroStars() {
    this.macroStarsGroup = new THREE.Group();
    const count = 42;
    const colors = [0xffffff, 0xdcf2ff, 0xffd9ec, 0xffe9ad, 0xc2f5ff];

    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.particleTextures.starCross,
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);

      // Phân bổ trên vòm bán cầu phía sau
      const theta = (Math.random() - 0.5) * Math.PI * 1.5;
      const phi = 0.25 + Math.random() * 1.1;
      const radius = 50 + Math.random() * 40;

      const x = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi) + 3;
      const z = -Math.abs(radius * Math.sin(phi) * Math.cos(theta)) - 8;
      sprite.position.set(x, y, z);

      const baseScale = 2.6 + Math.random() * 3.4;
      sprite.scale.set(baseScale, baseScale, 1);

      sprite.userData = {
        baseScale,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 1.5 + Math.random() * 2.5,
        baseOpacity: 0.75 + Math.random() * 0.25,
        mat
      };

      this.macroStarsGroup.add(sprite);
    }
    this.macroStarsGroup.visible = false;
    this.macroStarsGroup.userData = { opacity: 0 };
    this.scene.add(this.macroStarsGroup);
  }

  // 6. Dải Ngân Hà Bụi Sao 3D (Stardust River - GĐ 6 Grand Finale)
  createStardustRiver() {
    const count = window.innerWidth < 768 ? 400 : 700;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const cCyan = new THREE.Color(0x38bdf8);
    const cViolet = new THREE.Color(0xc084fc);
    const cRose = new THREE.Color(0xf472b6);
    const cGold = new THREE.Color(0xfde047);
    const cWhite = new THREE.Color(0xffffff);

    const angle = 0.59; // ~34 độ khớp với Dải Ngân Hà CSS
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let i = 0; i < count; i++) {
      // Chiều dài dải
      const t = (Math.random() - 0.5) * 80;
      // Bề ngang dải (thắt ở 2 đầu, phình ở giữa)
      const widthFactor = 1.0 - Math.pow(Math.abs(t) / 40, 2) * 0.4;
      const spread = (Math.random() - 0.5) * 14 * widthFactor;
      const depthSpread = (Math.random() - 0.5) * 16;

      positions[i * 3] = t * cosA - spread * sinA;
      positions[i * 3 + 1] = t * sinA + spread * cosA + 6;
      positions[i * 3 + 2] = -42 + depthSpread;

      const p = Math.random();
      const col = p < 0.35 ? cCyan : p < 0.65 ? cViolet : p < 0.82 ? cRose : p < 0.94 ? cWhite : cGold;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.9,
      vertexColors: true,
      map: this.particleTextures.star,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.stardustRiver = new THREE.Points(geom, mat);
    this.stardustRiver.visible = false;
    this.stardustRiver.userData = { opacity: 0 };
    this.scene.add(this.stardustRiver);
  }

  // 7. Đèn Trời 3D Bay Lên Vũ Trụ (Floating Background Sky Lanterns - GĐ 6 Grand Finale)
  createBackgroundSkyLanterns() {
    this.bgLanternsGroup = new THREE.Group();
    const count = 14;
    const lanternGeom = new THREE.CylinderGeometry(0.32, 0.45, 0.82, 6, 1, true);

    this.bgLanterns = [];

    for (let i = 0; i < count; i++) {
      const lanternMat = new THREE.MeshBasicMaterial({
        color: 0xffaa44,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(lanternGeom, lanternMat);

      // Tim đèn phát sáng màu vàng cam
      const flameMat = new THREE.SpriteMaterial({
        map: this.particleTextures.star,
        color: 0xffd670,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const flame = new THREE.Sprite(flameMat);
      flame.scale.set(1.2, 1.2, 1);
      flame.position.set(0, -0.15, 0);
      mesh.add(flame);

      const x = (Math.random() - 0.5) * 36;
      const y = -14 + Math.random() * 32;
      const z = -12 - Math.random() * 20;
      mesh.position.set(x, y, z);

      const scale = 0.7 + Math.random() * 0.6;
      mesh.scale.setScalar(scale);

      mesh.userData = {
        baseX: x,
        speedY: 0.35 + Math.random() * 0.45,
        wobbleSpeed: 0.9 + Math.random() * 1.2,
        wobblePhase: Math.random() * Math.PI * 2,
        lanternMat,
        flameMat
      };

      this.bgLanternsGroup.add(mesh);
      this.bgLanterns.push(mesh);
    }

    this.bgLanternsGroup.visible = false;
    this.bgLanternsGroup.userData = { opacity: 0 };
    this.scene.add(this.bgLanternsGroup);
  }

  // Kích hoạt đợt sao băng bay vụt qua bầu trời (Chu kỳ ~10s 1 lần)
  triggerMeteorShower() {
    if (!this.meteors || this.meteors.length < 3) return;

    // Góc quét chéo từ trên cao xuống bao quát bầu trời
    const startX0 = 26 + Math.random() * 8;
    const startY0 = 18 + Math.random() * 6;
    const startZ0 = -5 + Math.random() * 4;

    const endX0 = -32 - Math.random() * 8;
    const endY0 = -16 - Math.random() * 6;
    const endZ0 = 10 + Math.random() * 4;

    // 1. Sao băng chủ đạo (Alpha) - Tốc độ vừa vặn ~2.4s, đủ ngắm rõ vệt sáng rực rỡ
    const m0 = this.meteors[0];
    m0.userData.active = true;
    m0.userData.progress = 0;
    m0.userData.duration = 2.4;
    m0.userData.delay = 0;
    m0.userData.startPos.set(startX0, startY0, startZ0);
    m0.userData.endPos.set(endX0, endY0, endZ0);
    m0.visible = false;

    // 2. Sao băng chẻ nhánh Your Name (Tiamat Pink Split Fragment) lướt êm 2.5s
    const m1 = this.meteors[1];
    m1.userData.active = true;
    m1.userData.progress = 0;
    m1.userData.duration = 2.5;
    m1.userData.delay = 0.22;
    m1.userData.startPos.set(startX0 + 3.2, startY0 + 2.4, startZ0 - 2.0);
    m1.userData.endPos.set(endX0 + 3.2, endY0 + 2.4, endZ0 - 2.0);
    m1.visible = false;

    // 3. Sao băng phụ (Stardust Echo) lướt nhẹ 2.2s
    const m2 = this.meteors[2];
    m2.userData.active = true;
    m2.userData.progress = 0;
    m2.userData.duration = 2.2;
    m2.userData.delay = 0.55;
    m2.userData.startPos.set(startX0 - 8, startY0 + 4, startZ0 + 3);
    m2.userData.endPos.set(endX0 - 8, endY0 + 4, endZ0 + 3);
    m2.visible = false;

    console.log('[Scene3D] 🌠 Đợt sao băng dài lóe sáng vừa quét qua bầu trời!');
  }

  // Giữ phương thức spawnMeteor để tương thích ngược
  spawnMeteor() {
    this.triggerMeteorShower();
  }

  setSeason(stageIndex) {
    this.currentStage = stageIndex;
    this.seasonWorld.setStage(stageIndex);
    if (this.seasonalProps) {
      this.seasonalProps.setStage(stageIndex);
    }
    const positions = [[0,0,25],[0,1.5,22],[-1.5,0.5,21],[1.5,0.8,22],[0,-0.5,22],[4,3,26]];
    const [x,y,z] = positions[stageIndex - 1];
    this.targetCameraPos = { x, y, z };
    this.targetCameraLookAt = { x: 0, y: stageIndex === 6 ? 6 : 0, z: 0 };
    this.targetLightColor.setHex([0xbccff7,0xf6c8d5,0xffe5be,0xffc095,0xb6dcf5,0xd2ccff][stageIndex - 1]);

    // Fog thích ứng theo từng mùa - Đặc biệt Stage 5 Cực Quang & Stage 6 Bầu Trời Sao Lấp Lánh
    const fogColors = [0x060713, 0x18152e, 0x0e223d, 0x241220, 0x06152b, 0x090a28];
    const fogDensities = [0.012, 0.010, 0.008, 0.009, 0.0065, 0.0018];
    this.targetFogColor.setHex(fogColors[stageIndex - 1]);
    this.targetFogDensity = fogDensities[stageIndex - 1];
  }

  setWarpSpeed(isWarping) {
    this.isWarping = isWarping;
  }

  onPointerMove(e) {
    this.pointer.targetX = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, innerWidth < 768 ? 1.5 : 2));
  }

  update(delta) {
    const reduced = this.motionQuery.matches;
    const smooth = 1 - Math.exp(-delta * 2.8);
    this.pointer.x += (this.pointer.targetX - this.pointer.x) * smooth;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * smooth;
    this.cameraPos.x += (this.targetCameraPos.x + (reduced ? 0 : this.pointer.x * 0.8) - this.cameraPos.x) * smooth;
    this.cameraPos.y += (this.targetCameraPos.y + (reduced ? 0 : this.pointer.y * 0.6) - this.cameraPos.y) * smooth;
    this.cameraPos.z += (this.targetCameraPos.z - this.cameraPos.z) * smooth;
    for (const axis of ['x','y','z']) this.cameraLookAt[axis] += (this.targetCameraLookAt[axis] - this.cameraLookAt[axis]) * smooth;
    if (reduced) {
      Object.assign(this.cameraPos, { x: 0, y: 0, z: 25 });
      Object.assign(this.cameraLookAt, { x: 0, y: 0, z: 0 });
    }
    this.camera.position.set(this.cameraPos.x, this.cameraPos.y, this.cameraPos.z);
    this.camera.lookAt(this.cameraLookAt.x, this.cameraLookAt.y, this.cameraLookAt.z);
    this.camera.updateMatrixWorld();
    this.fillLight.color.lerp(this.targetLightColor, smooth);
    if (this.scene.fog) {
      this.scene.fog.color.lerp(this.targetFogColor, smooth);
      this.scene.fog.density += (this.targetFogDensity - this.scene.fog.density) * smooth;
    }
    this.seasonWorld.update(delta, reduced);
    if (this.seasonalProps) {
      this.seasonalProps.update(delta, reduced);
    }

    // 1. Cập nhật Bụi Kim Cương Mùa Đông 3D (Winter Diamond Dust - Stage 5)
    if (this.winterDiamondDust) {
      const targetOp = this.currentStage === 5 ? 0.45 : 0;
      const u = this.winterDiamondDust.userData;
      u.opacity += (targetOp - u.opacity) * (1 - Math.exp(-delta * 3.0));
      this.winterDiamondDust.material.opacity = u.opacity;
      this.winterDiamondDust.visible = u.opacity > 0.005;

      if (this.winterDiamondDust.visible && !reduced) {
        const posAttr = this.winterDiamondDust.geometry.attributes.position;
        const positions = posAttr.array;
        for (let i = 0; i < u.count; i++) {
          positions[i * 3 + 1] -= delta * 0.4;
          positions[i * 3] += Math.sin(this.meteorTimer + u.phases[i]) * delta * 0.18;
          if (positions[i * 3 + 1] < -15) positions[i * 3 + 1] = 15;
          if (positions[i * 3] > 24) positions[i * 3] = -24;
          if (positions[i * 3] < -24) positions[i * 3] = 24;
        }
        posAttr.needsUpdate = true;
      }
    }

    // 2. Cập nhật Sao Lớn 3D Lấp Lánh 4 Cánh (Macro Twinkling Stars - Stage 6 & 1)
    if (this.macroStarsGroup) {
      const targetOp = this.currentStage === 6 ? 0.40 : this.currentStage === 1 ? 0.20 : 0;
      const u = this.macroStarsGroup.userData;
      u.opacity += (targetOp - u.opacity) * (1 - Math.exp(-delta * 2.8));
      this.macroStarsGroup.visible = u.opacity > 0.005;

      if (this.macroStarsGroup.visible) {
        const time = this.meteorTimer;
        this.macroStarsGroup.children.forEach(sprite => {
          const su = sprite.userData;
          const twinkle = Math.sin(time * su.twinkleSpeed + su.phase);
          const currentScale = su.baseScale * (0.8 + twinkle * 0.4);
          sprite.scale.set(currentScale, currentScale, 1);
          if (su.mat) {
            su.mat.opacity = u.opacity * su.baseOpacity * (0.7 + twinkle * 0.3);
          }
        });
        if (!reduced) {
          this.macroStarsGroup.rotation.y += delta * 0.008;
        }
      }
    }

    // 3. Cập nhật Dải Ngân Hà Bụi Sao 3D (Stardust River - Stage 6)
    if (this.stardustRiver) {
      const targetOp = this.currentStage === 6 ? 0.25 : 0;
      const u = this.stardustRiver.userData;
      u.opacity += (targetOp - u.opacity) * (1 - Math.exp(-delta * 3.0));
      this.stardustRiver.material.opacity = u.opacity;
      this.stardustRiver.visible = u.opacity > 0.005;

      if (this.stardustRiver.visible && !reduced) {
        this.stardustRiver.rotation.z = Math.sin(this.meteorTimer * 0.05) * 0.02;
      }
    }

    // 4. Cập nhật Đèn Trời 3D Bay Lên Vũ Trụ (Sky Lanterns Field - Stage 6)
    if (this.bgLanternsGroup) {
      const targetOp = this.currentStage === 6 ? 0.45 : 0;
      const u = this.bgLanternsGroup.userData;
      u.opacity += (targetOp - u.opacity) * (1 - Math.exp(-delta * 2.5));
      this.bgLanternsGroup.visible = u.opacity > 0.005;

      if (this.bgLanternsGroup.visible) {
        const time = this.meteorTimer;
        this.bgLanterns.forEach(lantern => {
          const lu = lantern.userData;
          if (!reduced) {
            lantern.position.y += lu.speedY * delta;
            lantern.position.x = lu.baseX + Math.sin(time * lu.wobbleSpeed + lu.wobblePhase) * 0.6;
            lantern.rotation.z = Math.sin(time * 1.2 + lu.wobblePhase) * 0.08;
            lantern.rotation.x = Math.cos(time * 0.9 + lu.wobblePhase) * 0.06;

            if (lantern.position.y > 22) {
              lantern.position.y = -15;
            }
          }
          if (lu.lanternMat) {
            lu.lanternMat.opacity = u.opacity * 0.85;
          }
          if (lu.flameMat) {
            const flicker = Math.sin(time * 7 + lu.wobblePhase) * 0.2;
            lu.flameMat.opacity = u.opacity * (0.8 + flicker);
          }
        });
      }
    }

    if (this.isWarping) {
      this.warpFactor = Math.min(1.0, this.warpFactor + delta * 2.5);
    } else {
      this.warpFactor = Math.max(0.0, this.warpFactor - delta * 2.0);
    }

    if (this.starfield) {
      const opacity = [0.65, 0.16, 0.035, 0.15, 0.40, 0.65][this.currentStage - 1];
      this.starfield.material.opacity += (opacity - this.starfield.material.opacity) * smooth;
      if (!reduced) {
        this.starfield.rotation.y += delta * (0.012 + this.warpFactor * 0.03);
        this.starfield.rotation.x += delta * 0.004;
      }
    }

    // 9. Cập nhật chu kỳ sao băng lặp lại ~10s 1 lần
    this.meteorTimer += reduced ? 0 : delta;
    if (this.meteorTimer >= this.meteorInterval) {
      this.meteorTimer -= this.meteorInterval;
      this.triggerMeteorShower();
    }

    // Cập nhật hoạt ảnh vệt sao băng dài lóe sáng chạy vụt qua
    const forwardX = new THREE.Vector3(1, 0, 0);
    this.meteors.forEach((meteor) => {
      const u = meteor.userData;
      if (!u.active) return;

      if (u.delay > 0) {
        u.delay -= delta;
        return;
      }

      meteor.visible = !reduced;
      u.progress += delta / u.duration;

      if (u.progress >= 1.0) {
        u.active = false;
        meteor.visible = false;
        if (u.headMat) u.headMat.opacity = 0;
        if (u.trailMat) u.trailMat.opacity = 0;
        if (u.sparkMat) u.sparkMat.opacity = 0;
        return;
      }

      const p = u.progress;

      // Di chuyển đầu sao băng dọc theo quỹ đạo quét qua bầu trời
      meteor.position.lerpVectors(u.startPos, u.endPos, p);

      // Định hướng góc xoay vệt sao băng trùng khít hướng bay
      u.dir.subVectors(u.endPos, u.startPos).normalize();
      meteor.quaternion.setFromUnitVectors(forwardX, u.dir);

      // Hiệu ứng lóe sáng (Flash Intensity):
      // - 0 -> 0.15: Lóe sáng cực nhanh bừng nở (Flash flare)
      // - 0.15 -> 0.65: Duy trì độ sáng đỉnh cao khi bay vụt qua
      // - 0.65 -> 1.0: Mờ dần mềm mại rồi tan biến
      let intensity = 0;
      let flareMultiplier = 1.0;

      if (p < 0.15) {
        const t = p / 0.15;
        intensity = t;
        flareMultiplier = 0.5 + t * 0.9;
      } else if (p < 0.65) {
        intensity = 1.0;
        flareMultiplier = 1.4 - (p - 0.15) * 0.4;
      } else {
        const t = (p - 0.65) / 0.35;
        intensity = Math.max(0, 1.0 - t * t);
        flareMultiplier = 1.0 * (1.0 - t);
      }

      if (u.headMat) u.headMat.opacity = intensity * 0.65;
      if (u.trailMat) u.trailMat.opacity = intensity * (this.currentStage === 6 ? 0.65 : 0.32);
      if (u.sparkMat) u.sparkMat.opacity = intensity * 0.35;

      if (u.headSprite) {
        const currentFlare = u.flareSize * flareMultiplier;
        u.headSprite.scale.set(currentFlare, currentFlare, 1);
      }
    });

  }

  interactAt(clientX, clientY) {
    return this.seasonalProps ? this.seasonalProps.interactAt(clientX, clientY) : false;
  }

  checkHover(clientX, clientY) {
    return this.seasonalProps ? this.seasonalProps.checkHover(clientX, clientY) : false;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
