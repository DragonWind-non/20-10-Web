// js/pov-guide.js - Quản lý góc nhìn thứ nhất (POV) nắm tay nhau và Chú bướm dạ quang dẫn đường
/* global THREE */

export class POVGuide {
  constructor(scene) {
    this.scene = scene;
    this.container = document.getElementById('pov-container');
    this.handGradientStop = document.querySelector('#handGlow stop');

    // 3D Butterfly
    this.butterflyGroup = null;
    this.leftWing = null;
    this.rightWing = null;
    this.trailParticles = null;
    this.butterflyPathTime = 0;
    this.isVisible = false;

    this.init3DButterfly();
  }

  // Khởi tạo chú bướm dạ quang 3D trong không gian Three.js
  init3DButterfly() {
    if (!this.scene || typeof THREE === 'undefined') return;

    this.butterflyGroup = new THREE.Group();
    this.butterflyGroup.name = 'guide-butterfly';

    // 1. Cánh bướm dạ quang (Luminescent Wings)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.bezierCurveTo(0.6, 1.2, 1.4, 1.2, 1.5, 0.4);
    wingShape.bezierCurveTo(1.6, -0.2, 0.8, -0.6, 0, 0);

    const wingGeo = new THREE.ShapeGeometry(wingShape);
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xe8c7df,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.leftWing = new THREE.Mesh(wingGeo, wingMat);
    this.rightWing = new THREE.Mesh(wingGeo, wingMat);
    this.rightWing.scale.set(-1, 1, 1); // Đối xứng qua trục Y

    this.butterflyGroup.add(this.leftWing);
    this.butterflyGroup.add(this.rightWing);

    // Thân bướm nhỏ phát sáng
    const bodyGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.butterflyGroup.add(bodyMesh);

    // Vị trí mặc định
    this.butterflyGroup.position.set(0, 2, 16);
    this.butterflyGroup.scale.setScalar(0.2);
    this.butterflyGroup.visible = false;
    this.scene.add(this.butterflyGroup);
  }

  show(captionText = "Cùng mình qua những mùa yêu thương") {
    clearTimeout(this.visibilityTimer);
    this.isVisible = true;
    if (this.container) {
      this.container.style.display = 'flex';
      this.visibilityTimer = setTimeout(() => {
        this.container.style.opacity = '1';
        this.container.style.transform = 'translateX(-50%) translateY(0)';
      }, 20);

      const caption = this.container.querySelector('.pov-caption');
      if (caption && captionText) {
        caption.textContent = captionText;
      }
    }

    if (this.butterflyGroup) {
      this.butterflyGroup.visible = true;
    }
  }

  hide() {
    clearTimeout(this.visibilityTimer);
    this.isVisible = false;
    if (this.container) {
      this.container.style.opacity = '0';
      this.container.style.transform = 'translateX(-50%) translateY(30px)';
      this.visibilityTimer = setTimeout(() => {
        if (!this.isVisible) this.container.style.display = 'none';
      }, 800);
    }

    if (this.butterflyGroup) {
      this.butterflyGroup.visible = false;
    }
  }

  setSeasonColor(hexColor) {
    if (this.handGradientStop) {
      this.handGradientStop.setAttribute('stop-color', hexColor);
    }
    if (this.leftWing && this.rightWing) {
      const colorObj = new THREE.Color(hexColor);
      this.leftWing.material.color = colorObj;
      this.rightWing.material.color = colorObj;
    }
  }

  // Cập nhật hoạt ảnh đập cánh & đường bay của bướm (60fps)
  update(delta) {
    if (!this.butterflyGroup || !this.butterflyGroup.visible) return;

    this.butterflyPathTime += delta;

    // 1. Đập cánh nhanh (Wing Flap)
    const flap = Math.sin(this.butterflyPathTime * 18.0) * 0.75;
    this.leftWing.rotation.y = flap;
    this.rightWing.rotation.y = -flap;

    // 2. Đường bay uốn lượn lơ lửng trước camera (Lissajous / Bezier Curve)
    const t = this.butterflyPathTime * 0.8;
    this.butterflyGroup.position.x = Math.sin(t) * 2.8;
    this.butterflyGroup.position.y = 1.2 + Math.cos(t * 1.5) * 1.2;
    // Keep the guide behind the robots so its wings never cover their faces.
    this.butterflyGroup.position.z = 5 + Math.sin(t * 0.5);

    // Bướm quay đầu theo hướng bay
    this.butterflyGroup.rotation.z = Math.cos(t) * 0.2;
    this.butterflyGroup.rotation.y = Math.cos(t) * 0.4;
  }
}
