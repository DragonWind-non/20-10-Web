// tests/test-walle-natural-motion.js - Kiểm thử hoạt ảnh toàn thân tự nhiên của Wall-E
import assert from 'assert';

// 1. Mock THREE environment for NodeJS
class MockVector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { this.x = s; this.y = s; this.z = s; return this; }
  setXYZ(i, x, y, z) {}
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  normalize() { return this; }
  unproject() { return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  fromBufferAttribute() { return this; }
}

class MockEuler {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

class MockObject3D {
  constructor() {
    this.children = [];
    this.position = new MockVector3();
    this.rotation = new MockEuler();
    this.scale = new MockVector3(1, 1, 1);
    this.visible = true;
    this.name = '';
  }
  add(obj) { this.children.push(obj); }
  updateWorldMatrix() {}
  getWorldPosition(target) { target.set(this.position.x, this.position.y, this.position.z); return target; }
  worldToLocal(target) { return target.sub(this.position); }
}

class MockGroup extends MockObject3D {}
class MockMesh extends MockObject3D {
  constructor(geo, mat) {
    super();
    this.geometry = geo;
    this.material = mat || { emissiveIntensity: 0 };
  }
}

globalThis.THREE = {
  Group: MockGroup,
  Mesh: MockMesh,
  Vector3: MockVector3,
  Vector2: class { constructor(x=0,y=0) { this.x=x; this.y=y; } set(x,y) { this.x=x; this.y=y; return this; } clamp() { return this; } },
  Euler: MockEuler,
  Raycaster: class {
    constructor() { this.ray = {}; }
    setFromCamera() {}
    intersectObject() { return [{ point: new MockVector3() }]; }
  },
  BoxGeometry: class {
    constructor() {
      this.attributes = {
        position: { count: 8, fromBufferAttribute() {}, setXYZ() {} },
        normal: { count: 8, setXYZ() {} }
      };
    }
  },
  CylinderGeometry: class {},
  SphereGeometry: class {},
  TorusGeometry: class {},
  PlaneGeometry: class {},
  CircleGeometry: class {},
  ExtrudeGeometry: class { center() {} },
  Shape: class {
    moveTo() {}
    bezierCurveTo() {}
  },
  CanvasTexture: class {
    constructor() { this.encoding = 3001; }
  },
  MeshPhysicalMaterial: class {
    constructor(p) { Object.assign(this, p); this.color = { convertSRGBToLinear() {} }; }
  },
  MeshStandardMaterial: class {
    constructor(p) { Object.assign(this, p); this.color = { convertSRGBToLinear() {} }; }
  },
  MeshBasicMaterial: class {
    constructor(p) { Object.assign(this, p); }
  },
  MathUtils: {
    clamp: (v, min, max) => Math.max(min, Math.min(max, v))
  }
};

// Mock Document, Window & canvas
globalThis.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  addEventListener: () => {}
};

globalThis.matchMedia = window.matchMedia;
globalThis.innerWidth = 1920;
globalThis.innerHeight = 1080;

globalThis.document = {
  createElement: (tag) => {
    return {
      width: 512,
      height: 512,
      getContext: () => ({
        fillStyle: '',
        fillRect: () => {},
        fillText: () => {},
        font: '',
        textAlign: ''
      })
    };
  },
  getElementById: () => null,
  querySelector: () => null
};

console.log('Testing Wall-E Natural Full-Body Animations...');

const { WallERobot } = await import('../public/js/wall-e.js');

const mockScene = new MockGroup();
const mockCamera = new MockObject3D();
mockCamera.fov = 55;
mockCamera.position.set(0, 0, 25);

const wallE = new WallERobot(mockScene, mockCamera);

// 1. Kiểm tra giữ nguyên cấu trúc model chính xác
assert(wallE.body, 'Wall-E phải có body group');
assert(wallE.neck, 'Wall-E phải có thanh cổ neck');
assert(wallE.neckBase, 'Wall-E phải có bệ cổ neckBase');
assert(wallE.head, 'Wall-E phải có đầu head');
assert(wallE.eyes.length === 2, 'Wall-E phải có đủ 2 mắt');
assert(wallE.arms.length === 2, 'Wall-E phải có đủ 2 cánh tay');
assert(wallE.treads.length === 2, 'Wall-E phải có 2 dải bánh xích 2 bên');
assert(wallE.wheels.length >= 6, 'Wall-E phải có các bánh xe xích');
assert(wallE.trackShoes.length === 60, 'Wall-E phải có 60 mắt xích xe (30 mỗi bên)');
assert(wallE.chestLights.length === 3, 'Wall-E phải có 3 đèn sạc năng lượng trước ngực');
console.log('PASS: Model Wall-E được giữ nguyên vẹn 100% với đầy đủ các bộ phận!');

// 2. Kiểm tra hoạt ảnh nhịp thở và uốn thân mình (Torso animation)
const initialBodyY = wallE.body.position.y;
wallE.update(0.5, null);
assert(wallE.body.position.y !== initialBodyY || wallE.body.rotation.x !== 0, 'Thân mình phải có nhịp thở bồng bềnh tự nhiên');
console.log('PASS: Thân mình đã có chuyển động nhịp thở và uốn lượn hữu cơ!');

// 3. Kiểm tra cổ co giãn (Telescoping neck) khi tò mò và khi ngủ
const normalNeckExtend = wallE.neckExtension;

// Khi tò mò (pointer active)
wallE.setPointer(0.5, 0.5);
wallE.update(0.3, null);
assert(wallE.neckExtension >= normalNeckExtend, 'Cổ Wall-E phải vươn cao khi tò mò quan sát');

// Khi ngủ (sleep mode)
wallE.setEmotion('sleep');
for (let i = 0; i < 20; i++) wallE.update(0.1, null);
assert(wallE.neckExtension < 0, 'Cổ Wall-E phải rụt gọn vào trong thân khi ngủ');
console.log('PASS: Khớp cổ co giãn (Telescoping Neck) hoạt động nhịp nhàng theo cảm xúc!');

// 4. Kiểm tra bánh xích và mắt xích chuyển động (Treads & Wheels)
wallE.setEmotion('idle');
const initialTreadProgress = wallE.treadProgress;
wallE.motion.velocity.x = 0.5;
wallE.update(0.2, null);
assert(wallE.treadProgress > initialTreadProgress, 'Bánh xích và bánh xe phải chuyển động khi di chuyển');
console.log('PASS: Bánh xích và bánh xe xích lăn bánh chân thực!');

// 5. Kiểm tra cánh tay uyển chuyển 2 bên (Dual Arms Natural Kinematics)
assert(wallE.arms[0].rotation.x !== 0, 'Cánh tay trái phải có chuyển động bồng bềnh zero-g');
assert(wallE.arms[1].rotation.x !== 0, 'Cánh tay phải phải có chuyển động bồng bềnh zero-g');
console.log('PASS: Cả 2 cánh tay uyển chuyển tự nhiên trong không gian!');

// 6. Kiểm tra tương tác chạm đơn (Touch interaction)
const interacted = wallE.interactAt(960, 540);
assert(interacted === true, 'Tương tác click/tap phải thành công');
assert(wallE.joyWiggleTime > 0, 'Khi chạm vào phải kích hoạt hoạt ảnh nảy mừng (joy wiggle)');
console.log('PASS: Tương tác chạm kích hoạt hoạt ảnh nảy mừng toàn thân tự nhiên!');

// 7. Kiểm tra vạch đỏ má hồng anime /// và chạm liên tục gây ngại ngùng (Blush)
assert(wallE.blushMeshes.length === 6, 'Phải có 6 vạch má hồng /// (3 vạch mỗi bên mắt)');
// Chạm lần 2 liên tiếp
wallE.interactAt(960, 540);
assert(wallE.emotion === 'blush', 'Chạm lần 2 phải chuyển cảm xúc sang blush');
assert(wallE.blushOpacity === 1.0, 'Độ mờ má đỏ phải đạt cực đại 1.0');
wallE.update(0.1, null);
assert(wallE.blushMeshes[0].visible === true, 'Các vạch má đỏ /// phải hiển thị trong 3D');
console.log('PASS: Chạm liên tục kích hoạt ngại ngùng đỏ mặt với vạch má hồng anime ///!');

// 8. Chạm liên tiếp lần 3 & lần 4 -> Xua tay bối rối và Bơi trốn (Shoo & Swim Away)
wallE.interactAt(960, 540); // Lần 3
wallE.interactAt(960, 540); // Lần 4
assert(wallE.swimState === 'shoo', 'Chạm lần 4 phải kích hoạt trạng thái xua tay (shoo)');

// Sau 1s xua tay, chuyển sang trạng thái bơi sải (swimming)
wallE.update(0.9, null);
assert(wallE.swimState === 'swimming', 'Phải chuyển sang trạng thái bơi sải (swimming)');

// Cập nhật khi đang bơi: kiểm tra vẫy chân (bánh xích đạp) và xua tay ra sau
wallE.update(0.5, null);
assert(wallE.treads[0].position.y !== 0.43, 'Bánh xích phải nhấp nhô vẫy chân khi bơi');
console.log('PASS: Wall-E xua 2 tay ra sau và vẫy bánh xích đạp bơi trốn sang vị trí khác!');

// 9. Kiểm tra phạm vi trôi nổi rộng khắp không gian (Wide Roam Range)
wallE.setEmotion('idle');
wallE.fitToViewport();
assert(wallE.layout.roamX > 28 && wallE.layout.roamX < innerWidth * 0.1, 'Desktop must permit visible drift within a bounded lane');
assert(wallE.layout.roamY > 20 && wallE.layout.roamY < innerHeight * 0.1, 'Vertical drift must be visible without using the whole viewport');
console.log('PASS: Companion layout leaves a bounded roaming area.');

// 10. Kiểm tra khả năng xoay các hướng trong không gian 3D
wallE.motion.velocity.x = 0.4;
wallE.update(0.5, null);
assert(wallE.group.rotation.y !== 0, 'Wall-E phải xoay thân theo hướng trôi nổi và ngắm vũ trụ 3D');
console.log('PASS: Khả năng xoay chuyển 3D các hướng của Wall-E hoạt động xuất sắc!');

console.log('ALL PASS: Wall-E full-body natural animations verified successfully!');
