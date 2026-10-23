// js/seasonal-props.js - Sự Vật 3D Tương Tác 4 Mùa & Đêm Sao 20/10
/* global THREE */
import { getStageArea } from './scene-layout.js';

export class SeasonalProps {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.currentStage = 1;
    this.props = [];
    this.bursts = [];
    this.time = 0;
    this.audioCtx = null;

    // Toast UI
    this.toastEl = document.getElementById('prop-toast');

    // Raycasting
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredProp = null;
    this.worldPoint = new THREE.Vector3();

    this.initProps();
  }

  initProps() {
    // 1. Giai đoạn 1: Lõi Tinh Thể Vũ Trụ (Cosmic Crystal)
    this.propCosmic = this.createCosmicCrystal();
    // 2. Giai đoạn 2: Chuông Gió Hoa Anh Đào (Sakura Wind Chime)
    this.propSpring = this.createSakuraChime();
    // 3. Giai đoạn 3: Đèn Lồng Đom Đóm & Hoa Sen (Summer Lantern)
    this.propSummer = this.createSummerLantern();
    // 4. Giai đoạn 4: Hạc Giấy Ước Nguyện Hoàng Hôn (Autumn Origami Crane)
    this.propAutumn = this.createAutumnCrane();
    // 5. Giai đoạn 5: Quả Cầu Tuyết Pha Lê (Winter Snow Globe)
    this.propWinter = this.createSnowGlobe();
    // 6. Giai đoạn 6: Đèn Trời Nguyện Ước Khom Loi (Grand Finale Sky Lanterns)
    this.propFinale = this.createSkyLanterns();

    this.props = [
      this.propCosmic,
      this.propSpring,
      this.propSummer,
      this.propAutumn,
      this.propWinter,
      this.propFinale
    ];

    // Gắn vào scene và thiết lập ban đầu
    this.props.forEach((prop, idx) => {
      this.scene.add(prop.group);
      prop.group.visible = (idx === 0);
      prop.opacity = (idx === 0) ? 1 : 0;
      const materials = new Set();
      prop.group.traverse(mesh => {
        if (mesh.material && mesh !== prop.hitProxy) materials.add(mesh.material);
      });
      prop.materials = [...materials].map(material => {
        material.transparent = true;
        return { material, opacity: material.opacity };
      });
    });
  }

  // Helper tạo vật liệu chuẩn có hỗ trợ phát quang
  createStandardMat(params) {
    return new THREE.MeshStandardMaterial({
      roughness: 0.35,
      metalness: 0.2,
      ...params
    });
  }

  // Helper tạo Hit Proxy ẩn giúp tương tác click/tap cực nhạy trên mọi thiết bị
  createHitProxy(radius = 2.2) {
    const geo = new THREE.SphereGeometry(radius, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ visible: false, wireframe: true });
    const proxy = new THREE.Mesh(geo, mat);
    proxy.name = 'hit-proxy';
    return proxy;
  }

  // =========================================================================
  // 1. VŨ TRỤ: Lõi Tinh Thể Vũ Trụ & Vòng Hào Quang Tinh Vân
  // =========================================================================
  createCosmicCrystal() {
    const group = new THREE.Group();
    group.name = 'prop-cosmic';
    group.position.set(5.2, 1.2, 7.5);

    // Lõi tinh thể bát diện chính
    const coreGeo = new THREE.OctahedronGeometry(1.25, 0);
    const coreMat = this.createStandardMat({
      color: 0x93c5fd,
      emissive: 0x2563eb,
      emissiveIntensity: 0.65,
      roughness: 0.15,
      metalness: 0.85
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // Lõi tinh thể phụ lồng bên trong
    const innerGeo = new THREE.OctahedronGeometry(0.75, 0);
    const innerMat = this.createStandardMat({
      color: 0xf472b6,
      emissive: 0xdb2777,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.9
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.rotation.y = Math.PI / 4;
    group.add(innerMesh);

    // Vành đai 1 (Thiên thanh)
    const ring1Geo = new THREE.TorusGeometry(2.0, 0.04, 8, 48);
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.3
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    group.add(ring1);

    // Vành đai 2 (Hồng tinh tú)
    const ring2Geo = new THREE.TorusGeometry(1.6, 0.035, 8, 48);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 0.9,
      roughness: 0.3
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = -Math.PI / 4;
    ring2.rotation.y = Math.PI / 5;
    group.add(ring2);

    // Các vệ tinh nhỏ xoay quanh
    const moonGeo = new THREE.IcosahedronGeometry(0.18, 0);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x67e8f9,
      emissiveIntensity: 1.0
    });
    const moons = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(moonGeo, moonMat);
      group.add(m);
      moons.push(m);
    }

    const hitProxy = this.createHitProxy(2.2);
    group.add(hitProxy);

    return {
      stage: 1,
      name: 'Tinh Thể Vũ Trụ',
      quoteTitle: '✦ TINH THỂ VŨ TRỤ NGUYÊN BẢN ✦',
      quoteMsg: 'Mình gửi các bạn nữ những điều trong trẻo, dịu dàng và kỳ diệu nhất từ vũ trụ!',
      soundType: 'cosmic',
      group,
      coreMesh,
      innerMesh,
      ring1,
      ring2,
      moons,
      hitProxy,
      bounce: 0,
      basePos: new THREE.Vector3(5.2, 1.2, 7.5),
      update(delta, time) {
        coreMesh.rotation.y += delta * 0.45;
        coreMesh.rotation.x += delta * 0.25;
        innerMesh.rotation.y -= delta * 0.65;
        ring1.rotation.z += delta * 0.35;
        ring2.rotation.z -= delta * 0.4;

        moons.forEach((m, idx) => {
          const angle = time * 1.2 + (idx * Math.PI * 2) / 3;
          const r = 2.0;
          m.position.set(Math.cos(angle) * r, Math.sin(angle * 1.5) * 0.4, Math.sin(angle) * r);
        });

        group.position.y = this.basePos.y + Math.sin(time * 1.6) * 0.15;
      }
    };
  }

  // =========================================================================
  // 2. MÙA XUÂN: Chuông Gió Hoa Anh Đào (Sakura Wind Chime)
  // =========================================================================
  createSakuraChime() {
    const group = new THREE.Group();
    group.name = 'prop-spring';
    group.position.set(-5.0, 1.8, 7.8);

    // Mái vòm chuông thủy tinh hồng phấn
    const domeGeo = new THREE.SphereGeometry(0.95, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0xffb7c5,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.35,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    group.add(dome);

    // Lưỡi chuông thủy tinh nhỏ
    const clapperGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const clapperMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfecdd3,
      emissiveIntensity: 0.8
    });
    const clapper = new THREE.Mesh(clapperGeo, clapperMat);
    clapper.position.set(0, -0.4, 0);
    group.add(clapper);

    // Dải lụa ước nguyện treo rủ xuống
    const ribbonGeo = new THREE.PlaneGeometry(0.32, 1.5);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xffe4e6,
      emissive: 0xf472b6,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide
    });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.position.set(0, -1.3, 0);
    group.add(ribbon);

    // Cành hoa anh đào trang trí bên trên
    const branchGroup = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 2.2, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.8 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.rotation.z = Math.PI / 3;
    stem.position.set(0.4, 1.0, -0.1);
    branchGroup.add(stem);

    // 4 bông hoa đào 5 cánh nhỏ
    const petalGeo = new THREE.CircleGeometry(0.14, 5);
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xffc1d5,
      emissive: 0xff6b8b,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide
    });

    for (let f = 0; f < 4; f++) {
      const flower = new THREE.Group();
      for (let p = 0; p < 5; p++) {
        const petal = new THREE.Mesh(petalGeo, petalMat);
        petal.rotation.z = (p * Math.PI * 2) / 5;
        petal.position.set(Math.cos(petal.rotation.z) * 0.1, Math.sin(petal.rotation.z) * 0.1, 0);
        flower.add(petal);
      }
      flower.position.set(-0.3 + f * 0.45, 0.7 + (f % 2) * 0.25, 0.1);
      branchGroup.add(flower);
    }
    group.add(branchGroup);

    const hitProxy = this.createHitProxy(2.2);
    group.add(hitProxy);

    return {
      stage: 2,
      name: 'Chuông Gió Hoa Anh Đào',
      quoteTitle: '✦ TIẾNG CHUÔNG GIÓ HOA ANH ĐÀO ✦',
      quoteMsg: 'Mình chúc các bạn nữ luôn tươi trẻ, dịu dàng, rạng rỡ và ngập tràn sắc xuân hoa nở!',
      soundType: 'spring',
      group,
      dome,
      clapper,
      ribbon,
      branchGroup,
      hitProxy,
      swing: 0,
      basePos: new THREE.Vector3(-5.0, 1.8, 7.8),
      update(delta, time) {
        this.swing += (0 - this.swing) * (1 - Math.exp(-delta * 3));
        const naturalBreeze = Math.sin(time * 2.0) * 0.12 + this.swing;
        dome.rotation.z = naturalBreeze;
        clapper.rotation.z = -naturalBreeze * 1.3;
        ribbon.rotation.y = Math.sin(time * 2.8) * 0.25;
        ribbon.rotation.z = naturalBreeze * 1.5;
        group.position.y = this.basePos.y + Math.sin(time * 1.4) * 0.1;
      }
    };
  }

  // =========================================================================
  // 3. MÙA HẠ: Đèn Lồng Đom Đóm Thủy Tinh & Hoa Sen (Summer Firefly Lantern)
  // =========================================================================
  createSummerLantern() {
    const group = new THREE.Group();
    group.name = 'prop-summer';
    group.position.set(5.0, -0.6, 7.8);

    // Bình thủy tinh đựng đom đóm
    const glassGeo = new THREE.CylinderGeometry(0.7, 0.6, 1.6, 16, 1, true);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xeab308,
      emissiveIntensity: 0.35,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    group.add(glass);

    // Nắp và đế đèn lồng bằng đồng ấm
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.4,
      metalness: 0.75
    });
    const capGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.16, 16);
    const capTop = new THREE.Mesh(capGeo, brassMat);
    capTop.position.set(0, 0.85, 0);
    const capBottom = new THREE.Mesh(capGeo, brassMat);
    capBottom.position.set(0, -0.85, 0);
    group.add(capTop);
    group.add(capBottom);

    // Quai treo cong
    const handleGeo = new THREE.TorusGeometry(0.55, 0.04, 6, 24, Math.PI);
    const handle = new THREE.Mesh(handleGeo, brassMat);
    handle.position.set(0, 0.95, 0);
    group.add(handle);

    // Lõi đom đóm dạ quang vàng rực bên trong
    const coreGeo = new THREE.SphereGeometry(0.32, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Cánh sen vàng cam bao quanh đế đèn
    const lotusPetalGeo = new THREE.ConeGeometry(0.25, 0.65, 5);
    const lotusMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      roughness: 0.5
    });
    for (let p = 0; p < 8; p++) {
      const petal = new THREE.Mesh(lotusPetalGeo, lotusMat);
      const angle = (p * Math.PI * 2) / 8;
      petal.position.set(Math.cos(angle) * 0.7, -0.85, Math.sin(angle) * 0.7);
      petal.rotation.x = Math.sin(angle) * 0.4;
      petal.rotation.z = -Math.cos(angle) * 0.4;
      group.add(petal);
    }

    // 4 chú đom đóm mini bay lượn bên ngoài
    const ffGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const ffMat = new THREE.MeshBasicMaterial({ color: 0xa3e635 });
    const fireflies = [];
    for (let i = 0; i < 4; i++) {
      const ff = new THREE.Mesh(ffGeo, ffMat);
      group.add(ff);
      fireflies.push(ff);
    }

    const hitProxy = this.createHitProxy(2.2);
    group.add(hitProxy);

    return {
      stage: 3,
      name: 'Đèn Lồng Đom Đóm Mùa Hạ',
      quoteTitle: '✦ ĐÈN LỒNG ĐOM ĐÓM & HOA SEN HẠ ✦',
      quoteMsg: 'Mình chúc các bạn nữ luôn tràn ngập năng lượng nhiệt huyết, ấm áp và tỏa sáng rực rỡ như nắng hạ!',
      soundType: 'summer',
      group,
      glass,
      core,
      fireflies,
      hitProxy,
      glowPulse: 0,
      basePos: new THREE.Vector3(5.0, -0.6, 7.8),
      update(delta, time) {
        this.glowPulse *= Math.exp(-delta * 4);
        const breath = Math.sin(time * 3.2) * 0.35 + 0.95 + this.glowPulse;
        core.scale.setScalar(breath);
        group.position.y = this.basePos.y + Math.sin(time * 1.5) * 0.12;

        fireflies.forEach((ff, i) => {
          const a = time * (1.1 + i * 0.25) + i * 1.5;
          const r = 1.3 + Math.sin(time * 2 + i) * 0.3;
          ff.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.6, Math.sin(a) * r);
        });
      }
    };
  }

  // =========================================================================
  // 4. MÙA THU: Hạc Giấy Ước Nguyện Hoàng Hôn (Autumn Origami Crane)
  // =========================================================================
  createAutumnCrane() {
    const group = new THREE.Group();
    group.name = 'prop-autumn';
    group.position.set(-4.8, 0.6, 7.8);

    const origamiMat = this.createStandardMat({
      color: 0xfb923c,
      emissive: 0xea580c,
      emissiveIntensity: 0.45,
      roughness: 0.45,
      metalness: 0.15,
      side: THREE.DoubleSide
    });

    // Thân hạc gập Origami
    const bodyGeo = new THREE.ConeGeometry(0.35, 1.4, 4);
    const body = new THREE.Mesh(bodyGeo, origamiMat);
    body.rotation.x = Math.PI / 2.3;
    group.add(body);

    // Cổ và đầu hạc vươn cao
    const neckGeo = new THREE.ConeGeometry(0.14, 1.1, 4);
    const neck = new THREE.Mesh(neckGeo, origamiMat);
    neck.position.set(0, 0.45, 0.55);
    neck.rotation.x = -Math.PI / 3.5;
    group.add(neck);

    // Mỏ hạc nhỏ gập xuống
    const beakGeo = new THREE.ConeGeometry(0.08, 0.35, 3);
    const beak = new THREE.Mesh(beakGeo, origamiMat);
    beak.position.set(0, 0.85, 0.85);
    beak.rotation.x = Math.PI / 2;
    group.add(beak);

    // Đuôi hạc vuốt nhọn phía sau
    const tailGeo = new THREE.ConeGeometry(0.16, 0.9, 4);
    const tail = new THREE.Mesh(tailGeo, origamiMat);
    tail.position.set(0, 0.25, -0.6);
    tail.rotation.x = Math.PI / 3.2;
    group.add(tail);

    // Cánh trái Origami (có pivot xoay đập cánh)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.6, 0.5);
    wingShape.lineTo(1.1, -0.7);
    wingShape.closePath();
    const wingGeo = new THREE.ShapeGeometry(wingShape);

    const leftWingPivot = new THREE.Group();
    leftWingPivot.position.set(0.18, 0.15, 0);
    const leftWing = new THREE.Mesh(wingGeo, origamiMat);
    leftWingPivot.add(leftWing);
    group.add(leftWingPivot);

    // Cánh phải Origami
    const rightWingPivot = new THREE.Group();
    rightWingPivot.position.set(-0.18, 0.15, 0);
    const rightWing = new THREE.Mesh(wingGeo, origamiMat);
    rightWing.scale.set(-1, 1, 1);
    rightWingPivot.add(rightWing);
    group.add(rightWingPivot);

    // Quả thông vàng / Đèn lá phong treo đung đưa dưới hạc
    const pineGeo = new THREE.DodecahedronGeometry(0.24, 0);
    const pineMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.6
    });
    const pine = new THREE.Mesh(pineGeo, pineMat);
    pine.position.set(0, -0.6, 0);
    group.add(pine);

    const hitProxy = this.createHitProxy(2.2);
    group.add(hitProxy);

    return {
      stage: 4,
      name: 'Hạc Giấy Ước Nguyện Hoàng Hôn',
      quoteTitle: '✦ HẠC GIẤY ƯỚC NGUYỆN HOÀNG HÔN 20/10 ✦',
      quoteMsg: 'Mình chúc các bạn nữ một ngày 20/10 thật ngọt ngào, dịu êm, an yên và luôn được yêu thương trọn vẹn!',
      soundType: 'autumn',
      group,
      leftWingPivot,
      rightWingPivot,
      pine,
      hitProxy,
      flapSpeed: 1,
      basePos: new THREE.Vector3(-4.8, 0.6, 7.8),
      update(delta, time) {
        this.flapSpeed += (1 - this.flapSpeed) * (1 - Math.exp(-delta * 3));
        const wingAngle = Math.sin(time * 3.8 * this.flapSpeed) * 0.45;
        leftWingPivot.rotation.z = wingAngle;
        rightWingPivot.rotation.z = -wingAngle;

        group.position.y = this.basePos.y + Math.sin(time * 1.4) * 0.14;
        group.rotation.y = Math.sin(time * 0.8) * 0.18;
      }
    };
  }

  // =========================================================================
  // 5. MÙA ĐÔNG: Quả Cầu Tuyết Pha Lê Giáng Sinh (Winter Snow Globe)
  // =========================================================================
  createSnowGlobe() {
    const group = new THREE.Group();
    group.name = 'prop-winter';
    group.position.set(4.9, -0.4, 7.8);

    // Quả cầu thủy tinh pha lê trong suốt
    const domeGeo = new THREE.SphereGeometry(1.25, 24, 20);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.05,
      metalness: 0.15,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    group.add(dome);

    // Chân đế quả cầu mạ vàng sang trọng
    const baseGeo = new THREE.CylinderGeometry(1.1, 1.25, 0.4, 20);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xca8a04,
      roughness: 0.35,
      metalness: 0.85
    });
    const pedestal = new THREE.Mesh(baseGeo, baseMat);
    pedestal.position.set(0, -1.15, 0);
    group.add(pedestal);

    // Cây thông Noel 3 tầng pha lê bên trong quả cầu
    const treeGroup = new THREE.Group();
    const pineMat = new THREE.MeshStandardMaterial({
      color: 0x0d9488,
      emissive: 0x042f2e,
      roughness: 0.5
    });

    for (let c = 0; c < 3; c++) {
      const coneGeo = new THREE.ConeGeometry(0.65 - c * 0.14, 0.65, 8);
      const cone = new THREE.Mesh(coneGeo, pineMat);
      cone.position.set(0, -0.55 + c * 0.38, 0);
      treeGroup.add(cone);
    }

    // Ngôi sao vàng phát sáng trên đỉnh cây thông
    const starGeo = new THREE.OctahedronGeometry(0.18, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set(0, 0.75, 0);
    treeGroup.add(star);

    // Các quả châu Giáng sinh lấp lánh quanh cây
    const ornamentMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    for (let o = 0; o < 6; o++) {
      const orn = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), ornamentMat);
      const a = (o * Math.PI * 2) / 6;
      orn.position.set(Math.cos(a) * 0.4, -0.4 + (o % 3) * 0.3, Math.sin(a) * 0.4);
      treeGroup.add(orn);
    }

    group.add(treeGroup);

    // Bụi tuyết xoay tròn bên trong quả cầu
    const snowCount = 18;
    const snowPositions = new Float32Array(snowCount * 3);
    for (let s = 0; s < snowCount; s++) {
      snowPositions[s * 3] = (Math.random() - 0.5) * 1.6;
      snowPositions[s * 3 + 1] = (Math.random() - 0.5) * 1.6;
      snowPositions[s * 3 + 2] = (Math.random() - 0.5) * 1.6;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.85
    });
    const snowPoints = new THREE.Points(snowGeo, snowMat);
    group.add(snowPoints);

    const hitProxy = this.createHitProxy(2.2);
    group.add(hitProxy);

    return {
      stage: 5,
      name: 'Quả Cầu Tuyết Pha Lê Giáng Sinh',
      quoteTitle: '✦ QUẢ CẦU TUYẾT PHA LÊ GIÁNG SINH ✦',
      quoteMsg: 'Mình chúc các bạn nữ luôn an lành, kiên cường, ấm áp và lấp lánh kiêu sa như tuyết trắng mùa đông!',
      soundType: 'winter',
      group,
      dome,
      star,
      snowPoints,
      hitProxy,
      shake: 0,
      basePos: new THREE.Vector3(4.9, -0.4, 7.8),
      update(delta, time) {
        this.shake *= Math.exp(-delta * 4);
        star.rotation.y += delta * 1.5;
        snowPoints.rotation.y += delta * (0.4 + this.shake * 3);

        const shakeOffset = Math.sin(time * 30) * this.shake * 0.2;
        group.position.x = this.basePos.x + shakeOffset;
        group.position.y = this.basePos.y + Math.sin(time * 1.3) * 0.1;
      }
    };
  }

  // =========================================================================
  // 6. MÀN KẾT: Đèn Trời Nguyện Ước Khom Loi (Grand Finale Sky Lanterns)
  // =========================================================================
  createSkyLanterns() {
    const group = new THREE.Group();
    group.name = 'prop-finale';
    group.position.set(-4.6, 2.0, 8.5);

    const createSingleLantern = (scale, colorHex) => {
      const lantern = new THREE.Group();

      // Thân đèn lồng giấy lụa phát sáng
      const bodyGeo = new THREE.CylinderGeometry(0.65 * scale, 0.5 * scale, 1.4 * scale, 16);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.85,
        roughness: 0.6,
        metalness: 0.1
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      lantern.add(body);

      // Đỉnh vòm bo tròn
      const topGeo = new THREE.SphereGeometry(0.65 * scale, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const topMesh = new THREE.Mesh(topGeo, bodyMat);
      topMesh.position.set(0, 0.7 * scale, 0);
      lantern.add(topMesh);

      // Vành nan tre đáy
      const rimGeo = new THREE.TorusGeometry(0.52 * scale, 0.03 * scale, 6, 20);
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, -0.7 * scale, 0);
      lantern.add(rim);

      // Ngọn lửa nhỏ lung linh bên trong
      const flameGeo = new THREE.SphereGeometry(0.16 * scale, 8, 8);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(0, -0.4 * scale, 0);
      lantern.add(flame);

      return { lantern, flame };
    };

    // Đèn chính
    const main = createSingleLantern(1.0, 0xf97316);
    group.add(main.lantern);

    // 2 Đèn phụ bay lơ lửng phía xa
    const sub1 = createSingleLantern(0.6, 0xfbbf24);
    sub1.lantern.position.set(1.4, -0.7, -1.2);
    group.add(sub1.lantern);

    const sub2 = createSingleLantern(0.45, 0xf43f5e);
    sub2.lantern.position.set(-1.2, 0.9, -1.8);
    group.add(sub2.lantern);

    const hitProxy = this.createHitProxy(2.2);
    group.add(hitProxy);

    return {
      stage: 6,
      name: 'Đèn Trời Ước Nguyện Khom Loi',
      quoteTitle: '✦ ĐÈN TRỜI ƯỚC NGUYỆN ĐÊM HỘI 20/10 ✦',
      quoteMsg: 'Nguyện chúc mọi ước mơ, vẻ đẹp và khát vọng của phái đẹp đều hóa thành hiện thực rạng rỡ!',
      soundType: 'finale',
      group,
      main,
      sub1,
      sub2,
      hitProxy,
      lift: 0,
      basePos: new THREE.Vector3(-4.6, 2.0, 8.5),
      update(delta, time) {
        this.lift *= Math.exp(-delta * 3);
        const flicker = Math.sin(time * 12) * 0.15 + 1.0;
        main.flame.scale.setScalar(flicker);

        group.position.y = this.basePos.y + Math.sin(time * 1.3) * 0.15 + this.lift;
        group.rotation.y = Math.sin(time * 0.7) * 0.15;
      }
    };
  }

  // =========================================================================
  // BÙNG NỔ HẠT 3D ĐẶC TRƯNG TỪ VẬT THỂ (Interactive Particle Burst)
  // =========================================================================
  spawnParticleBurst(origin, stageIndex) {
    const count = 28;
    const positions = new Float32Array(count * 3);
    const velocities = [];

    const colors = {
      1: 0x38bdf8, // Cosmic cyan
      2: 0xf472b6, // Spring sakura
      3: 0xfacc15, // Summer firefly gold
      4: 0xf97316, // Autumn maple orange
      5: 0x38bdf8, // Winter snow cyan
      6: 0xfef08a  // Finale stardust yellow
    };

    const color = colors[stageIndex] || 0xffffff;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;

      const speed = 1.8 + Math.random() * 3.2;
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.acos(Math.random() * 2 - 1);

      velocities.push(
        new THREE.Vector3(
          speed * Math.sin(theta) * Math.cos(phi),
          speed * Math.sin(theta) * Math.sin(phi),
          speed * Math.cos(theta)
        )
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size: 0.35,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    this.bursts.push({
      points,
      positions,
      velocities,
      age: 0,
      lifespan: 1.6
    });
  }

  // =========================================================================
  // ÂM THANH TƯƠNG TÁC TINH TẾ (Web Audio API Synthesizer)
  // =========================================================================
  playSeasonalTone(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      const notesMap = {
        cosmic: [523.25, 659.25, 783.99, 1046.50],       // C5, E5, G5, C6 (shimmer)
        spring: [587.33, 739.99, 880.00, 1174.66],       // D5, F#5, A5, D6 (chime)
        summer: [659.25, 830.61, 987.77, 1318.51],       // E5, G#5, B5, E6 (harp)
        autumn: [440.00, 554.37, 659.25, 880.00],        // A4, C#5, E5, A5 (warm bell)
        winter: [523.25, 659.25, 783.99, 1046.5, 1318.5],// Jingle bell arpeggio
        finale: [523.25, 659.25, 783.99, 987.77, 1046.5] // Grand stardust chord
      };

      const notes = notesMap[type] || [523.25, 659.25];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = (type === 'summer' || type === 'autumn') ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0, now + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.85);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.9);
      });
    } catch (e) {
      // Bỏ qua lỗi audio autoplay gracefully
    }
  }

  // =========================================================================
  // TOAST THÔNG ĐIỆP Ý NGHĨA KHI CHẠM
  // =========================================================================
  showPropToast(title, message) {
    if (!this.toastEl) {
      this.toastEl = document.getElementById('prop-toast');
      if (!this.toastEl) return;
    }

    const titleEl = this.toastEl.querySelector('.prop-toast-title');
    const msgEl = this.toastEl.querySelector('.prop-toast-text');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    this.toastEl.style.display = 'flex';
    this.toastEl.classList.remove('hiding');
    this.toastEl.classList.add('visible');

    clearTimeout(this.toastEl.hideTimer);
    clearTimeout(this.toastEl.dismissTimer);
    this.toastEl.hideTimer = setTimeout(() => {
      this.toastEl.classList.remove('visible');
      this.toastEl.classList.add('hiding');
      this.toastEl.dismissTimer = setTimeout(() => {
        if (this.toastEl.classList.contains('hiding')) {
          this.toastEl.style.display = 'none';
        }
      }, 500);
    }, 4200);
  }

  // =========================================================================
  // TƯƠNG TÁC TẠI TỌA ĐỘ MÀN HÌNH (Click / Tap Raycasting)
  // =========================================================================
  interactAt(clientX, clientY) {
    const activeProp = this.props[this.currentStage - 1];
    if (!activeProp || !activeProp.group.visible) return false;

    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    activeProp.group.updateWorldMatrix(true, true);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const hits = this.raycaster.intersectObject(activeProp.hitProxy, true);
    if (!hits.length) return false;

    if (this.onInteract?.(activeProp)) return true;
    this.reactProp(activeProp);
    return true;
  }

  reactProp(activeProp, showToast = true) {

    // Kích hoạt phản ứng vật lý & hoạt ảnh tương ứng từng mùa
    switch (activeProp.stage) {
      case 1: // Cosmic: Nảy xung lực & tăng tốc xoay
        activeProp.coreMesh.scale.setScalar(1.35);
        setTimeout(() => activeProp.coreMesh.scale.setScalar(1.0), 300);
        break;
      case 2: // Spring: Lắc chuông mạnh
        activeProp.swing = 0.55;
        break;
      case 3: // Summer: Đèn bừng sáng & phồng nhẹ
        activeProp.glowPulse = 0.8;
        break;
      case 4: // Autumn: Hạc vỗ cánh dồn dập
        activeProp.flapSpeed = 2.8;
        break;
      case 5: // Winter: Rung lắc quả cầu tuyết
        activeProp.shake = 1.0;
        break;
      case 6: // Finale: Đèn trời bốc lên cao
        activeProp.lift = 1.2;
        break;
    }

    // Lấy vị trí thế giới để bùng nổ hạt
    const worldPos = new THREE.Vector3();
    activeProp.group.getWorldPosition(worldPos);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.spawnParticleBurst(worldPos, this.currentStage);

    // Phát âm thanh & hiển thị lời chúc ý nghĩa
    this.playSeasonalTone(activeProp.soundType);
    if (showToast) this.showPropToast(activeProp.quoteTitle, activeProp.quoteMsg);
  }

  // =========================================================================
  // HOVER CHECK (Di chuột qua để đổi con trỏ pointer & tạo hiệu ứng sáng)
  // =========================================================================
  checkHover(clientX, clientY) {
    const activeProp = this.props[this.currentStage - 1];
    if (!activeProp || !activeProp.group.visible) return false;

    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    activeProp.group.updateWorldMatrix(true, true);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const hits = this.raycaster.intersectObject(activeProp.hitProxy, true);
    const isHovered = hits.length > 0;

    this.hoveredProp = isHovered ? activeProp : null;
    if (isHovered) document.body.style.cursor = 'pointer';

    return isHovered;
  }

  // =========================================================================
  // CHUYỂN GIAI ĐOẠN 6 MÙA
  // =========================================================================
  setStage(stage) {
    this.currentStage = stage;
    this.hoveredProp = null;
  }

  // =========================================================================
  // CẬP NHẬT TRONG MỖI KHUNG HÌNH (Render Loop)
  // =========================================================================
  update(delta, reduced) {
    if (!reduced) this.time += delta;
    const area = getStageArea();
    const stacked = area.width < 620;

    // Cập nhật độ mờ và hoạt ảnh cho từng sự vật mùa
    this.props.forEach((prop, idx) => {
      const isTarget = (this.currentStage === idx + 1);
      const targetOpacity = isTarget ? 1 : 0;
      const smooth = 1 - Math.exp(-delta * (reduced ? 20 : 3.5));

      prop.opacity += (targetOpacity - prop.opacity) * smooth;
      prop.group.visible = prop.opacity > 0.01;

      if (prop.group.visible) {
        prop.group.position.copy(prop.basePos);
        if (!reduced) prop.update(delta, this.time);
        const sway = prop.group.position.y - prop.basePos.y;
        const x = this.currentStage === 6 ? window.innerWidth * 0.60
          : area.left + area.width * (stacked ? 0.50 : 0.14);
        // Leave space below the object for its tap label on narrow screens.
        const y = this.currentStage === 6 ? window.innerHeight * 0.64
          : area.top + (area.height - (stacked ? 48 : 0)) * (stacked ? 0.81 : 0.58);
        const pixels = Math.min(stacked ? 64 : 138, area.height * 0.24);
        const depth = 6;
        const scale = pixels * (2 * Math.tan(this.camera.fov * Math.PI / 360) * Math.abs(this.camera.position.z - depth)) / window.innerHeight / 4.8;
        this.worldPoint.set(x / window.innerWidth * 2 - 1, 1 - y / window.innerHeight * 2, 0.5).unproject(this.camera);
        this.worldPoint.sub(this.camera.position);
        this.worldPoint.multiplyScalar((depth - this.camera.position.z) / this.worldPoint.z);
        prop.group.position.copy(this.camera.position).add(this.worldPoint);
        prop.group.position.y += sway * scale;
        prop.group.scale.setScalar(scale * (this.hoveredProp === prop ? 1.06 : 1));
        for (const {material, opacity} of prop.materials) material.opacity = opacity * prop.opacity;
      }
    });

    // Cập nhật các chùm hạt nổ (Particle Bursts)
    for (let b = this.bursts.length - 1; b >= 0; b--) {
      const burst = this.bursts[b];
      burst.age += delta;

      if (burst.age >= burst.lifespan) {
        this.scene.remove(burst.points);
        burst.points.geometry.dispose();
        burst.points.material.dispose();
        this.bursts.splice(b, 1);
        continue;
      }

      const pCount = burst.velocities.length;
      const pos = burst.positions;
      const progress = burst.age / burst.lifespan;

      for (let i = 0; i < pCount; i++) {
        const vel = burst.velocities[i];
        pos[i * 3] += vel.x * delta;
        pos[i * 3 + 1] += vel.y * delta;
        pos[i * 3 + 2] += vel.z * delta;

        // Trọng lực và lực cản không khí nhẹ
        vel.y -= delta * 0.8;
        vel.multiplyScalar(Math.exp(-delta * 1.8));
      }

      burst.points.geometry.attributes.position.needsUpdate = true;
      burst.points.material.opacity = Math.max(0, 1.0 - progress);
    }
  }
}
