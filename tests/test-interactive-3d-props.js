// tests/test-interactive-3d-props.js - Kiểm thử logic Sự Vật 3D Tương Tác 4 Mùa & Đêm Sao
import assert from 'assert';

// 1. Mock môi trường THREE tối giản cho NodeJS
class MockVector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { this.x = s; this.y = s; this.z = s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  unproject() { return this; }
}

class MockObject3D {
  constructor() {
    this.children = [];
    this.position = new MockVector3();
    this.rotation = new MockVector3();
    this.scale = new MockVector3(1, 1, 1);
    this.visible = true;
    this.name = '';
  }
  add(obj) { this.children.push(obj); }
  traverse(fn) { fn(this); this.children.forEach(child => child.traverse(fn)); }
  remove(obj) {
    const idx = this.children.indexOf(obj);
    if (idx !== -1) this.children.splice(idx, 1);
  }
  updateWorldMatrix() {}
  getWorldPosition(target) { target.set(this.position.x, this.position.y, this.position.z); return target; }
}

class MockGroup extends MockObject3D {}
class MockMesh extends MockObject3D {
  constructor(geo, mat) {
    super();
    this.geometry = geo;
    this.material = mat;
  }
}
class MockPoints extends MockObject3D {
  constructor(geo, mat) {
    super();
    this.geometry = geo;
    this.material = mat;
  }
}

globalThis.THREE = {
  Group: MockGroup,
  Mesh: MockMesh,
  Points: MockPoints,
  Vector3: MockVector3,
  Vector2: class { constructor(x=0,y=0) { this.x=x; this.y=y; } },
  Raycaster: class {
    constructor() { this.ray = {}; }
    setFromCamera() {}
    intersectObject() { return []; }
  },
  SphereGeometry: class {},
  OctahedronGeometry: class {},
  IcosahedronGeometry: class {},
  DodecahedronGeometry: class {},
  TorusGeometry: class {},
  CylinderGeometry: class {},
  ConeGeometry: class {},
  PlaneGeometry: class {},
  CircleGeometry: class {},
  ShapeGeometry: class {},
  Shape: class {
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    closePath() {}
  },
  BufferGeometry: class {
    constructor() {
      this.attributes = { position: { needsUpdate: false } };
    }
    setAttribute() {}
    dispose() {}
  },
  BufferAttribute: class {},
  MeshStandardMaterial: class { constructor(p) { Object.assign(this, {opacity: 1}, p); } },
  MeshBasicMaterial: class { constructor(p) { Object.assign(this, {opacity: 1}, p); } },
  PointsMaterial: class { constructor(p) { Object.assign(this, {opacity: 1}, p); } dispose() {} },
  AdditiveBlending: 2,
  DoubleSide: 2
};

// Mock Document & Window
globalThis.window = {
  innerWidth: 1920,
  innerHeight: 1080
};
globalThis.innerWidth = window.innerWidth;
globalThis.innerHeight = window.innerHeight;

globalThis.document = {
  querySelector: () => null,
  getElementById: (id) => {
    return {
      id,
      style: {},
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false
      },
      querySelector: () => ({ textContent: '' })
    };
  },
  body: { style: {} }
};

console.log('Testing SeasonalProps 3D Interactive Objects system...');

const { SeasonalProps } = await import('../public/js/seasonal-props.js');

const mockScene = new MockGroup();
const mockCamera = new MockObject3D();
mockCamera.fov = 55;
mockCamera.position.z = 25;

const propsMgr = new SeasonalProps(mockScene, mockCamera);

// Kiểm thử 1: Có đầy đủ 6 sự vật 3D tương ứng 6 giai đoạn
assert(propsMgr.props.length === 6, 'Hệ thống phải có đúng 6 sự vật 3D cho 6 giai đoạn');

const expectedProps = [
  { stage: 1, name: 'Tinh Thể Vũ Trụ', sound: 'cosmic' },
  { stage: 2, name: 'Chuông Gió Hoa Anh Đào', sound: 'spring' },
  { stage: 3, name: 'Đèn Lồng Đom Đóm Mùa Hạ', sound: 'summer' },
  { stage: 4, name: 'Hạc Giấy Ước Nguyện Hoàng Hôn', sound: 'autumn' },
  { stage: 5, name: 'Quả Cầu Tuyết Pha Lê Giáng Sinh', sound: 'winter' },
  { stage: 6, name: 'Đèn Trời Ước Nguyện Khom Loi', sound: 'finale' }
];

expectedProps.forEach((expected, i) => {
  const p = propsMgr.props[i];
  assert(p.stage === expected.stage, `Vật thể ${i} phải thuộc Stage ${expected.stage}`);
  assert(p.name === expected.name, `Tên vật thể ${i} phải là ${expected.name}`);
  assert(p.soundType === expected.sound, `Âm thanh vật thể ${i} phải là ${expected.sound}`);
  assert(typeof p.quoteTitle === 'string' && p.quoteTitle.length > 0, `Tiêu đề lời chúc vật thể ${i} không được rỗng`);
  assert(typeof p.quoteMsg === 'string' && p.quoteMsg.length > 0, `Thông điệp lời chúc vật thể ${i} không được rỗng`);
  assert(p.group && p.group.children.length > 0, `Group vật thể ${i} phải có các mesh con 3D`);
  assert(p.hitProxy, `Vật thể ${i} phải có hitProxy để raycast bắt chạm cực nhạy`);
});
console.log('PASS: Cả 6 vật thể 3D cho 6 giai đoạn đã được khởi tạo hoàn chỉnh!');

// Kiểm thử 2: Tính chất chung chung, không cá nhân hóa (Universal Women's Day Celebration)
const prohibitedRomanticTerms = ['anh yêu em', 'bạn gái', 'người yêu', 'yêu anh', 'vợ yêu'];
propsMgr.props.forEach((p) => {
  const text = (p.quoteTitle + ' ' + p.quoteMsg).toLowerCase();
  prohibitedRomanticTerms.forEach(term => {
    assert(!text.includes(term), `Thông điệp của "${p.name}" không được chứa từ ngữ cá nhân hóa người yêu ("${term}")`);
  });
});
console.log('PASS: Tất cả thông điệp 3D tôn vinh phụ nữ chung chung, phổ quát, không cá nhân hóa!');

// Kiểm thử 3: Chuyển giai đoạn (setStage) & Cập nhật Render Loop
propsMgr.setStage(3);
assert(propsMgr.currentStage === 3, 'currentStage phải cập nhật sang 3');

// Cập nhật update delta
propsMgr.update(0.016, false);
assert(propsMgr.props[2].opacity > 0, 'Stage 3 prop opacity phải tăng dần khi được chọn');
assert(propsMgr.props[2].materials.some(({material}) => material.opacity > 0 && material.opacity < 1),
  'Incoming meshes must actually fade, not only store an unused opacity value');

// Kiểm thử 4: Bùng nổ hạt 3D (Particle Bursts)
propsMgr.spawnParticleBurst(new MockVector3(0, 0, 0), 2);
assert(propsMgr.bursts.length === 1, 'Hệ thống phải ghi nhận 1 chùm hạt bùng nổ');
assert(propsMgr.bursts[0].velocities.length === 28, 'Mỗi chùm nổ phải có 28 hạt bay đa hướng');

// Cập nhật delta qua thời gian lifespan để hạt tự hủy
propsMgr.update(2.0, false);
assert(propsMgr.bursts.length === 0, 'Chùm hạt phải tự giải phóng bộ nhớ sau lifespan');
console.log('PASS: Hệ thống hạt nổ 3D và giải phóng bộ nhớ (garbage collection) hoạt động chính xác!');

propsMgr.raycaster.intersectObject = () => [{}];
let delivered = null, reactions = 0;
propsMgr.onInteract = prop => { delivered = prop; return true; };
propsMgr.reactProp = () => { reactions++; };
assert(propsMgr.interactAt(100,100));
assert.equal(delivered,propsMgr.props[2]);
assert.equal(reactions,0,'A delivery owns the contact timing; do not react before the robot arrives');
propsMgr.onInteract = () => false;
assert(propsMgr.interactAt(100,100));
assert.equal(reactions,1,'Keep the existing reaction when no delivery handles the click');
console.log('ALL PASS: Interactive 3D Seasonal Props tests verified successfully!');
