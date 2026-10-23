/* global THREE */
import { SpaceMotion } from './space-motion.js';
import { fitRobotLayout, fitSleepingRobotLayout } from './scene-layout.js';
import { holdHands, releaseHands } from './robot-interaction.js';
import { giftAngle } from './rose-gift.js';

/**
 * Robot EVE (Extraterrestrial Vegetation Evaluator)
 * Thiết kế chuẩn 3D theo nguyên tác phim WALL-E của Pixar:
 * - Thân hình giọt nước/kén khí động học phủ men sứ nano siêu bóng (Apple-inspired aesthetics)
 * - Đầu lơ lửng từ tính (Maglev Floating Head) tách rời hoàn toàn khỏi thân với đĩa từ tính âm bên dưới
 * - Mặt nạ kính đen cong mượt mà tích hợp đôi mắt LED Cyan biểu cảm phong phú (CanvasTexture scanlines)
 * - Hai cánh tay từ tính (Maglev Aero-Flippers) uốn lượn khí động học ôm theo dáng thân
 * - Cử chỉ kinh điển nắm tay WALL-E ("Hold Hands"), xoay lộn nhào biểu diễn, tia quét Scanner xanh ngọc
 * - Biểu tượng mầm cây Directive phát sáng xanh ngọc trên ngực
 */
export class EveRobot {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'EVE';

    this.floatPivot = new THREE.Group();
    this.floatPivot.position.y = 1.8;
    this.model = new THREE.Group();
    this.model.position.y = -1.05;
    this.floatPivot.add(this.model);
    this.group.add(this.floatPivot);

    this.motion = new SpaceMotion();
    this.motion.wanderTime = 2.0;
    this.motion.spinWait = 9 + Math.random() * 8;

    // Các thành phần cấu trúc chính
    this.body = new THREE.Group();
    this.head = new THREE.Group();
    this.arms = []; // [leftArm, rightArm]
    this.armsPivot = [];

    // Hệ thống theo dõi & Điều hướng
    this.pointer = new THREE.Vector2();
    this.pointerAge = Infinity;
    this.raycaster = new THREE.Raycaster();
    this.screenPoint = new THREE.Vector2();
    this.worldPoint = new THREE.Vector3();
    this.rayDirection = new THREE.Vector3();
    this.lookPoint = new THREE.Vector3();
    this.partner = null; // Tham chiếu đến Wall-E

    // Layout màn hình (EVE bay bổng tao nhã giữa Wall-E và vật thể 4 mùa)
    this.layout = { x: 0.24, y: 0.20, pixels: 195, height: 4.4, roamX: 280, roamY: 160 };
    this.displayLayout = { ...this.layout };
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');

    // Trạng thái cảm xúc & Hoạt ảnh
    this.time = 0;
    this.stage = 1;
    this.emotion = 'idle'; // 'idle' | 'happy' | 'wink' | 'heart' | 'scan' | 'sleep' | 'giggle'
    this.eyeState = 'normal';
    this.blushOpacity = 0;
    this.blinkTimer = 2.5 + Math.random() * 3;
    this.blinkProgress = 0;
    this.spinTime = 0;
    this.spinAngle = this.spinOrigin = 0;
    this.spinPitch = 0;
    this.bankPitch = this.bankRoll = 0;
    this.headingYaw = 0;
    this.pendingSpin = false;
    this.reactionTime = 0; // Khi lộn nhào biểu diễn

    // Tương tác Hold Hands với WALL-E
    this.isHoldingHands = false;
    this.holdHandsTimer = 0;
    this.handHoldProgress = 0;
    this.handTip = new THREE.Vector3(0, -0.74, 0);

    // Tia quét Scanner Beam
    this.isScanning = false;
    this.scanBeam = null;
    this.scanTimer = 0;

    // Khởi tạo các thành phần 3D
    this.initMaterials();
    this.buildModel();
    this.buildScannerBeam();
    this.buildSparks();

    this.scene.add(this.group);
    this.fitToViewport();
    window.addEventListener('resize', () => this.fitToViewport());
  }

  setPartner(wallE) {
    this.partner = wallE;
  }

  initMaterials() {
    // Vỏ men sứ nano trắng siêu bóng phản quang bầu trời anime (Apple nano-ceramic)
    this.hullMat = new THREE.MeshPhysicalMaterial({
      color: 0xf3f5f7,
      roughness: 0.24,
      metalness: 0.04,
      clearcoat: 0.75,
      clearcoatRoughness: 0.05,
      envMapIntensity: 0.75
    });

    // Màng đen bóng mờ bên trong các khớp từ tính
    this.hullMat.color.convertSRGBToLinear();

    this.eyeCanvas = document.createElement('canvas');
    this.eyeCanvas.width = 512;
    this.eyeCanvas.height = 256;
    this.eyeCtx = this.eyeCanvas.getContext('2d');
    this.eyeTexture = new THREE.CanvasTexture(this.eyeCanvas);
    if (this.eyeTexture) this.eyeTexture.encoding = THREE.sRGBEncoding;

    // The opaque visor sits just outside the ceramic shell.
    this.visorMat = new THREE.MeshBasicMaterial({
      map: this.eyeTexture,
      transparent: true,
      alphaTest: 0.03,
      toneMapped: false
    });

    // Khớp nối tương thích test suite
    this.eyeScreenMat = this.visorMat;

    // Biểu tượng mầm cây xanh Directive ở ngực
    this.plantCanvas = document.createElement('canvas');
    this.plantCanvas.width = 128;
    this.plantCanvas.height = 128;
    this.renderPlantIcon();
    this.plantTexture = new THREE.CanvasTexture(this.plantCanvas);

    this.plantMat = new THREE.MeshStandardMaterial({
      map: this.plantTexture,
      transparent: true,
      color: 0xffffff,
      emissive: 0x22c55e,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      depthWrite: false
    });

    this.updateEyeCanvas('normal', 0);
  }

  renderPlantIcon() {
    const ctx = this.plantCanvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#22c55e';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 14;

    // Vẽ 2 lá mầm cây nhỏ xinh vươn lên đặc trưng của Directive
    ctx.beginPath();
    ctx.ellipse(48, 76, 17, 10, -0.62, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(80, 62, 22, 11, 0.52, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 5;
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(64, 98);
    ctx.quadraticCurveTo(58, 76, 76, 62);
    ctx.stroke();
  }

  updateEyeCanvas(expression = 'normal', blink = 0) {
    const blinkFrame = Math.round(blink * 16);
    const blushFrame = Math.round(this.blushOpacity * 16);
    if (this.drawnExpression === expression && this.drawnBlink === blinkFrame && this.drawnBlush === blushFrame) return;
    this.drawnExpression = expression;
    this.drawnBlink = blinkFrame;
    this.drawnBlush = blushFrame;
    const ctx = this.eyeCtx;
    const w = 512, h = 256;
    ctx.clearRect(0, 0, w, h);

    // 1. Nền kính đen sâu của visor với hiệu ứng bóng gương nhẹ
    ctx.fillStyle = '#060a10';
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(80, 214);
    ctx.bezierCurveTo(24, 186, 47, 130, 74, 97);
    ctx.bezierCurveTo(139, 12, 372, 12, 439, 97);
    ctx.bezierCurveTo(467, 139, 489, 206, 432, 223);
    ctx.bezierCurveTo(342, 250, 139, 248, 80, 214);
    ctx.fill();
    ctx.clip();

    if (typeof ctx.createLinearGradient === 'function') {
      const gradGloss = ctx.createLinearGradient(0, 0, 0, 120);
      gradGloss.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
      gradGloss.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
      gradGloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradGloss;
      ctx.beginPath();
      ctx.ellipse(w / 2, 30, w * 0.44, 55, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (blushFrame > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 113, 151, ${blushFrame / 16 * 0.85})`;
      ctx.shadowColor = '#ff7197';
      ctx.shadowBlur = 9;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      for (const cheek of [113, 397]) {
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(cheek + i * 12 - 4, 177);
          ctx.lineTo(cheek + i * 12 + 4, 195);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    if (blink > 0.88) {
      // Nhắm mắt hoàn toàn
      ctx.restore();
      this.eyeTexture.needsUpdate = true;
      return;
    }

    const eyeScaleY = Math.max(0.04, 1 - blink);
    const eyeCyan = '#40c6ff';
    const innerCyan = '#e0faff';

    ctx.save();
    ctx.shadowColor = eyeCyan;
    ctx.shadowBlur = 18;
    ctx.fillStyle = eyeCyan;
    ctx.strokeStyle = eyeCyan;

    const leftX = 175, rightX = 337, centerY = 130;

    if (expression === 'heart') {
      // Mắt trái tim phát sáng tình yêu khi bên cạnh Wall-E
      const drawHeart = (cx, cy) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1.15, 1.15 * eyeScaleY);
        ctx.beginPath();
        ctx.moveTo(0, 16);
        ctx.bezierCurveTo(-28, -16, -42, -50, -20, -66);
        ctx.bezierCurveTo(0, -66, 0, -42, 0, -32);
        ctx.bezierCurveTo(0, -42, 0, -66, 20, -66);
        ctx.bezierCurveTo(42, -50, 28, -16, 0, 16);
        ctx.fill();
        ctx.restore();
      };
      ctx.fillStyle = '#38bdf8';
      drawHeart(leftX, centerY + 18);
      drawHeart(rightX, centerY + 18);
    } else if (expression === 'happy' || expression === 'giggle') {
      // Mắt cong cười tít hạnh phúc ^ ^
      ctx.lineWidth = 24 * eyeScaleY;
      ctx.lineCap = 'round';
      const drawSmileArc = (cx) => {
        ctx.beginPath();
        ctx.arc(cx, centerY + 28, 48, Math.PI * 1.14, Math.PI * 1.86, false);
        ctx.stroke();
      };
      drawSmileArc(leftX);
      drawSmileArc(rightX);
    } else if (expression === 'wink') {
      // Một bên mắt nháy cười ^, một bên mắt mở to tròn
      ctx.lineWidth = 22 * eyeScaleY;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(leftX, centerY + 26, 46, Math.PI * 1.16, Math.PI * 1.84, false);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(rightX, centerY, 38, 50 * eyeScaleY, -0.12, 0, Math.PI * 2);
      ctx.fill();
    } else if (expression === 'sleep') {
      // Hai đường cong khép mắt ngủ thanh thản \smile \smile
      ctx.lineWidth = 15;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(leftX, centerY - 12, 38, Math.PI * 0.2, Math.PI * 0.8, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightX, centerY - 12, 38, Math.PI * 0.2, Math.PI * 0.8, false);
      ctx.stroke();
    } else if (expression === 'scan') {
      // Chế độ Scanner: mắt mở to kèm vạch quét laser
      ctx.beginPath();
      ctx.ellipse(leftX, centerY, 42, 48 * eyeScaleY, 0.08, 0, Math.PI * 2);
      ctx.ellipse(rightX, centerY, 42, 48 * eyeScaleY, -0.08, 0, Math.PI * 2);
      ctx.fill();

      // Vạch tia quét laser ngang màn hình
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(35, centerY);
      ctx.lineTo(477, centerY);
      ctx.stroke();
    } else {
      // 'normal': Hai mắt hình bầu dục nghiêng nhẹ hướng vào nhau đặc trưng của EVE
      ctx.beginPath();
      ctx.ellipse(leftX, centerY, 44, 38 * eyeScaleY, 0.14, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(rightX, centerY, 44, 38 * eyeScaleY, -0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hiệu ứng các đường scanlines công nghệ cao của tàu Axiom
    ctx.restore();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 2);
    }

    ctx.restore();
    this.eyeTexture.needsUpdate = true;
  }

  buildModel() {
    const addMesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // =========================================================================
    // 1. Thân kén hình giọt nước liền khối hoàn hảo (Seamless Egg-Pod Hull)
    // =========================================================================
    this.body.position.set(0, 0.65, 0);
    this.model.add(this.body);

    // Tạo hình dáng thân kén bằng Sphere biến dạng mượt mà (100% không vết cắt)
    const torsoGeo = new THREE.SphereGeometry(1, 64, 48);
    const tpos = torsoGeo.attributes?.position;
    if (tpos) {
      for (let i = 0; i < tpos.count; i++) {
        const x = typeof tpos.getX === 'function' ? tpos.getX(i) : (tpos.array ? tpos.array[i * 3] : 0);
        const y = typeof tpos.getY === 'function' ? tpos.getY(i) : (tpos.array ? tpos.array[i * 3 + 1] : 0);
        const z = typeof tpos.getZ === 'function' ? tpos.getZ(i) : (tpos.array ? tpos.array[i * 3 + 2] : 0);

        let newY, taper;
        if (y >= 0) {
          // Nửa trên: từ ngực đến vành cổ (y = 0 đến 1)
          newY = (1 - Math.pow(1 - y, 3)) * 0.88;
          taper = 0.86 * (1 - 0.12 * y);
        } else {
          // Nửa dưới: từ ngực vuốt thon dài về đáy tròn
          const t = -y;
          newY = -t * 1.35;
          taper = 0.86 * (1 - t * 0.20);
        }
        if (typeof tpos.setXYZ === 'function') {
          tpos.setXYZ(i, x * taper, newY, z * taper * 0.88);
        } else if (tpos.array) {
          tpos.array[i * 3] = x * taper;
          tpos.array[i * 3 + 1] = newY;
          tpos.array[i * 3 + 2] = z * taper * 0.88;
        }
      }
      torsoGeo.computeVertexNormals?.();
    }
    const torsoMesh = addMesh(torsoGeo, this.hullMat, this.body, 0, 0, 0);

    // Vành cổ từ tính bên trên (Magnetic Collar Socket)
    const plantPlateGeo = new THREE.PlaneGeometry(0.28, 0.28);
    const plantBadge = addMesh(plantPlateGeo, this.plantMat, this.body, 0, 0.32, 0.72);
    plantBadge.rotation.x = 0.12;

    // =========================================================================
    // 2. Đầu lơ lửng không khớp nối (Maglev Floating Head & Curved Visor)
    // =========================================================================
    this.head.position.set(0, 2.06, 0);
    this.model.add(this.head);

    // Vỏ đầu tròn mềm mại (Head Dome)
    const headShellGeo = new THREE.SphereGeometry(1, 48, 36);
    const headPositions = headShellGeo.attributes.position;
    for (let i = 0; i < headPositions.count; i++) {
      const x = headPositions.getX(i), y = headPositions.getY(i), z = headPositions.getZ(i);
      headPositions.setXYZ(i, x * 0.91 * (1 - 0.12 * y), y * (y >= 0 ? 0.68 : 0.50), z * 0.70 * (1 - 0.06 * y));
    }
    headShellGeo.computeVertexNormals();
    addMesh(headShellGeo, this.hullMat, this.head);

    const visorGeo = new THREE.PlaneGeometry(1.60, 0.98, 36, 28);
    const visorPositions = visorGeo.attributes.position;
    for (let i = 0; i < visorPositions.count; i++) {
      const x = visorPositions.getX(i), y = visorPositions.getY(i);
      const ny = y / (y >= 0 ? 0.68 : 0.50);
      const nx = x / (0.91 * (1 - 0.12 * ny));
      const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * 0.70 * (1 - 0.06 * ny) + 0.014;
      visorPositions.setXYZ(i, x, y, z);
    }
    visorGeo.computeVertexNormals();
    const visor = addMesh(visorGeo, this.visorMat, this.head);
    visor.castShadow = false;

    for (const side of [-1, 1]) {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.96, 0.72, 0);
      this.model.add(armPivot);
      this.armsPivot.push(armPivot);

      const arm = new THREE.Group();
      armPivot.add(arm);
      this.arms.push(arm);

      // Cánh tay dạng vây khí động học uốn lượn mượt mà theo thân
      const armGeo = new THREE.SphereGeometry(1, 28, 24);
      const positions = armGeo.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        positions.setXYZ(i, x * (0.18 + 0.03 * y) + side * (0.07 * (1 - y * y)), y * 0.78, z * 0.22);
      }
      armGeo.computeVertexNormals();
      addMesh(armGeo, this.hullMat, arm);

    }
  }

  buildScannerBeam() {
    // Nón tia quét laser xanh ngọc của EVE khi rà soát vật thể 4 mùa
    const coneGeo = new THREE.ConeGeometry(1.6, 4.2, 24, 1, true);
    coneGeo.translate?.(0, -2.1, 0);
    this.scanMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide || 2,
      depthWrite: false
    });
    this.scanBeam = new THREE.Mesh(coneGeo, this.scanMat);
    this.scanBeam.position.set(0, 1.8, 0.6);
    this.scanBeam.rotation.x = -0.65;
    this.scanBeam.visible = false;
    this.model.add(this.scanBeam);
  }

  buildSparks() {
    // Các hạt tia sáng hình sao / trái tim khi nắm tay WALL-E
    this.sparksGroup = new THREE.Group();
    this.sparks = [];
    const sparkGeo = new THREE.CircleGeometry(0.07, 4);
    for (let i = 0; i < 18; i++) {
      const sparkMat = new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xff6b9d : 0x38bdf8,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      this.sparksGroup.add(spark);
      this.sparks.push({
        mesh: spark,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0
      });
    }
    this.model.add(this.sparksGroup);
  }

  triggerHoldHands(duration = 4.5) {
    holdHands(this.partner, this, duration);
    this.showToast('WALL-E & EVE', 'Mình cùng nắm tay đi qua bốn mùa nhé.', '♡');
  }

  triggerScan(duration = 3.2, target = this.environmentTarget) {
    if (this.stage === 6) return;
    this.travelController?.cancel();
    this.giftController?.cancel();
    releaseHands(this.partner, this);
    this.pendingSpin = false;
    this.spinTime = 0;
    this.scanTarget = target;
    this.isScanning = true;
    this.scanTimer = duration;
    this.setEmotion('scan');
    this.scanBeam.visible = true;
    if (!target) this.showToast('✦ EVE ✦', 'Cùng EVE tìm một mầm xanh giữa bốn mùa nhé!', '💙');
  }

  triggerAcrobaticSpin() {
    if (this.stage === 6) return;
    this.travelController?.cancel();
    this.giftController?.cancel();
    releaseHands(this.partner, this);
    this.isScanning = false;
    this.scanBeam.visible = false;
    this.scanTimer = 0;
    if (this.spinTime > 0) return;
    if (this.handHoldProgress > 0.02) { this.pendingSpin = true; return; }
    this.pendingSpin = false;
    this.spinOrigin = Math.round(this.spinAngle / (Math.PI * 2)) * Math.PI * 2;
    this.spinTime = this.motionQuery.matches ? 0 : 2.1;
    this.reactionTime = 2.4;
    this.setEmotion('happy');
    this.motion.kick((Math.random() - 0.5) * 0.35, 0.28);
    this.showToast('✦ EVE VUI MỪNG ✦', '✨ (≧◡≦) EVE xoay một vòng duyên dáng bay lượn cùng gió!', '🕊️');
  }

  setEmotion(emotion) {
    this.emotion = emotion;
    switch (emotion) {
      case 'heart':
        this.eyeState = 'heart';
        break;
      case 'happy':
      case 'giggle':
        this.eyeState = 'happy';
        break;
      case 'wink':
        this.eyeState = 'wink';
        break;
      case 'scan':
        this.eyeState = 'scan';
        break;
      case 'sleep':
        this.eyeState = 'sleep';
        break;
      default:
        this.eyeState = 'normal';
        break;
    }
    this.updateEyeCanvas(this.eyeState, 0);
  }

  setStage(stage) {
    this.stage = stage;
    releaseHands(this.partner, this);
    this.isScanning = false;
    this.pendingSpin = false;
    this.spinTime = this.scanTimer = 0;
    this.reactionTime = stage === 6 ? 0 : 2.8;
    this.scanBeam.visible = false;
    switch (stage) {
      case 1:
        this.setEmotion('normal');
        break;
      case 2: // Xuân
        this.setEmotion('happy');
        break;
      case 3: // Hạ
        this.setEmotion('wink');
        break;
      case 4: // Thu 20/10
        this.setEmotion('heart');
        break;
      case 5: // Đông
        this.setEmotion('happy');
        break;
      case 6: // Màn kết Finale
        this.setEmotion('sleep');
        break;
    }
    this.fitToViewport();
  }

  setPointer(normX, normY) {
    this.pointer.set(normX, normY);
    this.pointerAge = 0;
  }

  interactAt(x, y) {
    if (this.emotion === 'sleep') return false;
    this.screenPoint.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.group.updateWorldMatrix(true, true);
    this.raycaster.setFromCamera(this.screenPoint, this.camera);
    const hit = [this.body, this.head, ...this.armsPivot].some(part =>
      this.raycaster.intersectObject(part, true).some(hit => hit.object?.visible !== false));
    if (!hit) return false;
    this.travelController?.cancel();

    // Người dùng chạm vào EVE
    if (this.isHoldingHands) {
      this.triggerAcrobaticSpin();
    } else {
      if (this.spinTime > 0 || this.pendingSpin) {
        this.setEmotion('wink');
        this.reactionTime = 0.8;
      } else {
        this.triggerHoldHands();
      }
    }
    return true;
  }

  showToast(title, message, icon = '🕊️') {
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
    }, 4000);
  }

  fitToViewport() {
    const sleeping = this.stage === 6 || this.emotion === 'sleep';
    if (sleeping) {
      fitSleepingRobotLayout(this, true);
    } else {
      fitRobotLayout(this, true);
    }

    if (!this.displayLayout) this.displayLayout = { ...this.layout };
  }

  update(delta, interest) {
    delta = Math.max(0, delta || 0);
    if (!this.motionQuery.matches) this.time += delta;
    this.pointerAge += delta;
    const reduced = this.motionQuery.matches;
    const sleeping = this.stage === 6 || this.emotion === 'sleep';
    const smooth = reduced ? 1 : 1 - Math.exp(-delta * 3.6);
    const gift = this.giftPose;
    if (!gift) this.blushOpacity *= Math.exp(-delta * 5);
    if (reduced || sleeping) this.spinTime = 0;

    // =========================================================================
    // 1. Cập nhật nháy mắt tự nhiên (Blinking Physics)
    // =========================================================================
    if (!sleeping && !reduced) {
      this.blinkTimer -= delta;
      if (this.blinkTimer <= 0) {
        this.blinkProgress += delta * 7.5;
        if (this.blinkProgress >= 1.0) {
          this.blinkProgress = 0;
          this.blinkTimer = 2.4 + Math.random() * 3.6;
        }
      }
    }
    const blinkAmount = sleeping || reduced ? 0 : Math.sin(this.blinkProgress * Math.PI);
    this.updateEyeCanvas(this.eyeState, blinkAmount);

    // =========================================================================
    // 2. Cập nhật tiến trình Nắm tay (Hold Hands Progress)
    // =========================================================================
    if (this.pendingSpin && this.handHoldProgress < 0.02 && !sleeping) this.triggerAcrobaticSpin();
    if (this.reactionTime > 0 && !this.isHoldingHands && !this.isScanning) {
      this.reactionTime = Math.max(0, this.reactionTime - delta);
      if (this.reactionTime === 0 && !sleeping) this.setEmotion('normal');
    }

    let spinPitch = 0, spinRoll = Math.round(this.spinAngle / (Math.PI * 2)) * Math.PI * 2;
    if (this.spinTime > 0) {
      this.spinTime -= delta;
      const t = 1.0 - Math.max(0, this.spinTime / 2.1);
      spinPitch = Math.sin(t * Math.PI) * 0.28;
      spinRoll = this.spinOrigin + Math.PI * 2 * t * t * t * (t * (t * 6 - 15) + 10);
    }

    // =========================================================================
    // 4. Cập nhật Scanner Beam
    // =========================================================================
    if (this.isScanning) {
      this.scanTimer -= delta;
      if (this.scanTimer <= 0) {
        this.isScanning = false;
        this.scanBeam.visible = false;
        this.setEmotion(['normal', 'happy', 'wink', 'heart', 'happy', 'sleep'][this.stage - 1]);
      } else {
        this.scanMat.opacity = Math.min(0.10, this.scanTimer * 0.15);
      }
    }

    // =========================================================================
    // 5. Cập nhật Hạt Tia Sáng Điện Tim (Sparks)
    // =========================================================================
    if (this.handHoldProgress > 0.4 && !reduced) {
      this.sparksGroup.visible = true;
      this.sparks.forEach(sp => {
        sp.life += delta;
        if (sp.life >= sp.maxLife) {
          sp.life = 0;
          sp.maxLife = 0.5 + Math.random() * 0.6;
          // Phát ra từ điểm chạm tay giữa Wall-E và EVE
          sp.mesh.position.set(-1.1 + (Math.random() - 0.5) * 0.35, 0.4 + (Math.random() - 0.5) * 0.35, 0.5);
          sp.vel.set((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6);
        }
        sp.mesh.position.addScaledVector(sp.vel, delta);
        const progress = sp.life / sp.maxLife;
        sp.mesh.material.opacity = Math.sin(progress * Math.PI) * 0.85;
        sp.mesh.scale.setScalar(0.8 + Math.sin(progress * Math.PI) * 0.6);
      });
    } else {
      this.sparksGroup.visible = false;
    }

    // =========================================================================
    // 6. Cập nhật Vị trí & Tọa độ Màn hình (Screen Projection)
    // =========================================================================
    this.motion.update(delta, reduced, sleeping || this.handHoldProgress > 0 || this.isScanning || this.spinTime > 0 || !!gift || !!this.isTravelling);
    for (const key of ['x', 'y', 'pixels', 'height', 'roamX', 'roamY']) {
      this.displayLayout[key] += (this.layout[key] - this.displayLayout[key]) * (reduced ? 1 : 1 - Math.exp(-delta * 4));
    }
    const layout = this.displayLayout;

    // Vị trí không gian của EVE
    const hoverBobY = sleeping || reduced ? 0 : Math.sin(this.time * 2.2) * 2;
    const hoverBobX = sleeping || reduced ? 0 : Math.cos(this.time * 1.4) * 2;

    const offsetX = (this.motion.position.x * layout.roamX) + hoverBobX;
    const offsetY = (this.motion.position.y * layout.roamY) + hoverBobY;
    const camera = this.camera;
    const depth = 8.5 + (sleeping || reduced ? 0 : this.motion.position.z * 0.9);

    this.worldPoint.set(layout.x + (offsetX / innerWidth) * 2, layout.y + (offsetY / innerHeight) * 2, 0.5).unproject(camera);
    this.rayDirection.copy(this.worldPoint).sub(camera.position).normalize();
    const distance = (depth - camera.position.z) / this.rayDirection.z;
    this.group.position.copy(camera.position).addScaledVector(this.rayDirection, distance);

    const scale = (layout.pixels * (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.abs(camera.position.z - depth))) / innerHeight / layout.height;
    this.group.scale.setScalar(scale);

    // =========================================================================
    // 7. Nghiêng thân theo hướng lướt gió (Aerodynamic Banking)
    // =========================================================================
    const facing = Math.atan2(camera.position.x - this.group.position.x, camera.position.z - depth);
    const bankRoll = reduced || sleeping ? 0 : -this.motion.velocity.x * 0.45;
    const bankPitch = reduced || sleeping ? 0 : this.motion.velocity.y * 0.28 + Math.sin(this.time * 1.8) * 0.04
      - (this.pointerAge < 2.5 && !this.handHoldProgress ? this.pointer.y * 0.1 : 0);

    this.bankPitch += (bankPitch - this.bankPitch) * smooth;
    this.bankRoll += (bankRoll - this.bankRoll) * smooth;
    let heading = facing;
    if (!sleeping && !reduced && !this.handHoldProgress && !this.spinTime) {
      heading += this.pointerAge < 2.5 ? this.pointer.x * 0.5 : this.motion.yaw;
      if (this.isScanning && this.scanTarget) {
        this.scanTarget.getWorldPosition(this.lookPoint);
        heading = Math.atan2(this.lookPoint.x - this.group.position.x, this.lookPoint.z - this.group.position.z);
      }
    }
    if (gift) heading = giftAngle(heading, facing + gift.heading, gift.weight);
    this.headingYaw += Math.atan2(Math.sin(heading - this.headingYaw), Math.cos(heading - this.headingYaw)) * smooth;
    this.group.rotation.set(gift ? giftAngle(this.bankPitch, gift.pitch, gift.weight) : this.bankPitch,
      this.headingYaw, gift ? giftAngle(this.bankRoll, gift.roll, gift.weight) : this.bankRoll);
    const spinSmooth = reduced ? 1 : 1 - Math.exp(-delta * 13);
    this.spinAngle += (spinRoll - this.spinAngle) * spinSmooth;
    this.spinPitch += (spinPitch - this.spinPitch) * spinSmooth;
    this.floatPivot.rotation.set(this.spinPitch + this.motion.pitch, 0, this.spinAngle + this.motion.roll);
    if (this.isScanning && this.scanTarget) {
      this.model.updateWorldMatrix(true, true);
      const target = this.model.worldToLocal(this.scanTarget.getWorldPosition(new THREE.Vector3()));
      this.scanBeam.position.set(0, 2.15, 0.65);
      const direction = target.sub(this.scanBeam.position);
      this.scanBeam.scale.set(0.18, direction.length() / 4.2, 0.18);
      this.scanBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction.normalize());
    }

    // =========================================================================
    // 8. Đầu lơ lửng Maglev dõi theo Wall-E, Chuột hoặc Tựa đầu khi ngủ
    // =========================================================================
    let headYaw = 0, headPitch = sleeping ? 0.20 : 0, headRoll = sleeping ? -0.22 : 0;

    if (!sleeping && !reduced) {
      if (this.isHoldingHands && this.partner) {
        // Khi nắm tay: EVE nghiêng đầu dịu dàng nhìn thẳng vào WALL-E
        this.partner.head.getWorldPosition(this.lookPoint);
        this.model.worldToLocal(this.lookPoint).sub(this.head.position);
        headYaw = THREE.MathUtils.clamp(Math.atan2(this.lookPoint.x, Math.max(0.6, this.lookPoint.z)), -0.75, 0.75);
        headPitch = THREE.MathUtils.clamp(-Math.atan2(this.lookPoint.y, Math.hypot(this.lookPoint.x, this.lookPoint.z)), -0.4, 0.4);
        headRoll = 0.16; // Nghiêng đầu âu yếm
      } else if ((this.isScanning && this.scanTarget) || (this.pointerAge >= 2.5 && interest?.visible)) {
        const target = this.isScanning && this.scanTarget ? this.scanTarget : interest;
        target.getWorldPosition(this.lookPoint);
        this.model.worldToLocal(this.lookPoint).sub(this.head.position);
        headYaw = THREE.MathUtils.clamp(Math.atan2(this.lookPoint.x, Math.max(0.8, this.lookPoint.z)), -0.65, 0.65);
        headPitch = THREE.MathUtils.clamp(-Math.atan2(this.lookPoint.y, Math.hypot(this.lookPoint.x, this.lookPoint.z)), -0.35, 0.35);
      } else if (this.pointerAge < 2.5) {
        this.lookPoint.set(this.pointer.x, this.pointer.y, 0.5).unproject(camera);
        this.rayDirection.copy(this.lookPoint).sub(camera.position).normalize();
        this.lookPoint.copy(camera.position).addScaledVector(this.rayDirection, (13 - camera.position.z) / this.rayDirection.z);
        this.model.worldToLocal(this.lookPoint).sub(this.head.position);
        headYaw = THREE.MathUtils.clamp(Math.atan2(this.lookPoint.x, Math.max(0.8, this.lookPoint.z)), -0.65, 0.65);
        headPitch = THREE.MathUtils.clamp(-Math.atan2(this.lookPoint.y, Math.hypot(this.lookPoint.x, this.lookPoint.z)), -0.35, 0.35);
      } else if (this.partner) {
        // Tự nhiên thi thoảng liếc nhìn Wall-E
        const gazeAtWallE = Math.sin(this.time * 0.6) > 0.2;
        if (gazeAtWallE) {
          this.partner.head.getWorldPosition(this.lookPoint);
          this.model.worldToLocal(this.lookPoint).sub(this.head.position);
          headYaw = THREE.MathUtils.clamp(Math.atan2(this.lookPoint.x, Math.max(0.8, this.lookPoint.z)), -0.65, 0.65);
          headPitch = THREE.MathUtils.clamp(-Math.atan2(this.lookPoint.y, Math.hypot(this.lookPoint.x, this.lookPoint.z)), -0.3, 0.3);
          headRoll = -0.08;
        }
      }
    }

    // Nhịp lơ lửng tự nhiên của đầu Maglev
    const maglevFloatY = 2.06 + (reduced || sleeping ? 0 : Math.sin(this.time * 2.6) * 0.035);
    if (gift) {
      headPitch = giftAngle(headPitch, gift.head[0], gift.weight);
      headYaw = giftAngle(headYaw, gift.head[1], gift.weight);
      headRoll = giftAngle(headRoll, gift.head[2], gift.weight);
    }
    this.head.position.y = maglevFloatY;
    this.head.rotation.y += (headYaw - this.head.rotation.y) * smooth;
    this.head.rotation.x += (headPitch - this.head.rotation.x) * smooth;
    this.head.rotation.z += (headRoll - this.head.rotation.z) * smooth;

    // =========================================================================
    // 9. Cánh tay trôi nổi Maglev Arms & Tư thế Nắm tay (Hold Hands)
    // =========================================================================
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const pivot = this.armsPivot[i];
      const arm = this.arms[i];

      // Tay đung đưa tự nhiên khi bay lượn
      const armHoverZ = reduced || sleeping ? 0 : Math.sin(this.time * 2.2 + side * 0.5) * 0.08;
      const armHoverPitch = reduced || sleeping ? 0 : Math.sin(this.time * 2.0 + side * 0.3) * 0.06;

      if (gift) {
        const idle = [armHoverPitch, 0, side * 0.08 + armHoverZ];
        for (const [index, axis] of ['x', 'y', 'z'].entries()) {
          const target = giftAngle(idle[index], gift.arms[i][index], gift.weight);
          arm.rotation[axis] += (target - arm.rotation[axis]) * smooth;
        }
        pivot.position.x = side * 0.96;
        pivot.position.z = 0;
      } else if (!sleeping && this.handHoldProgress > 0 && side === -1) {
        // Cánh tay trái của EVE đưa ra phía trước chìa tay nắm lấy tay WALL-E
        const targetPitch = -1.15 * this.handHoldProgress;
        const targetYaw = 0.38 * this.handHoldProgress;
        const targetRoll = -0.22 * this.handHoldProgress;
        arm.rotation.x += (targetPitch - arm.rotation.x) * smooth;
        arm.rotation.y += (targetYaw - arm.rotation.y) * smooth;
        arm.rotation.z += (targetRoll - arm.rotation.z) * smooth;
        pivot.position.x = side * 0.96 - 0.12 * this.handHoldProgress;
        pivot.position.z = 0.36 * this.handHoldProgress;
      } else if (this.isScanning && side === 1) {
        // Tay phải giơ lên hướng dẫn tia quét
        arm.rotation.x += (-0.85 - arm.rotation.x) * smooth;
        arm.rotation.y += (-0.25 - arm.rotation.y) * smooth;
      } else {
        // Trôi nổi tự do hai bên thân
        arm.rotation.x += (armHoverPitch - arm.rotation.x) * smooth;
        arm.rotation.y += (0 - arm.rotation.y) * smooth;
        arm.rotation.z += (side * 0.08 + armHoverZ - arm.rotation.z) * smooth;
        pivot.position.x = side * 0.96;
        pivot.position.z = 0;
      }
    }

    // =========================================================================
    // 10. Đèn mầm cây Directive nhịp thở xanh ngọc
    // =========================================================================
    if (this.plantMat) {
      const plantGlow = 0.45 + Math.sin(this.time * 2.8) * 0.35;
      this.plantMat.emissiveIntensity = sleeping ? 0.15 : plantGlow;
    }
  }
}
