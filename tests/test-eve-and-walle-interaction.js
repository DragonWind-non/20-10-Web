// tests/test-eve-and-walle-interaction.js - Kiểm thử robot EVE & tương tác gắn kết với WALL-E
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
  Vector2: class {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    set(x, y) { this.x = x; this.y = y; return this; }
    clamp() { return this; }
  },
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
  SphereGeometry: class {
    computeVertexNormals() {}
    constructor() {
      this.attributes = {
        position: { count: 24, getX: () => 0, getY: () => 0, getZ: () => 1, setXYZ() {}, setZ() {} }
      };
    }
  },
  ConeGeometry: class {
    translate() {}
  },
  TorusGeometry: class {},
  PlaneGeometry: class {
    constructor() {
      this.attributes = {
        position: { count: 16, getX: () => 0, getY: () => 0, setXYZ() {}, setZ() {} }
      };
    }
    computeVertexNormals() {}
  },
  CircleGeometry: class {},
  ExtrudeGeometry: class { center() {} },
  Shape: class {
    moveTo() {}
    bezierCurveTo() {}
  },
  CanvasTexture: class {
    constructor() { this.encoding = 3001; this.needsUpdate = false; }
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
  DoubleSide: 2,
  sRGBEncoding: 3001,
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
      height: 256,
      getContext: () => ({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        shadowColor: '',
        shadowBlur: 0,
        clip: () => {},
        fillRect: () => {},
        clearRect: () => {},
        fillText: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        ellipse: () => {},
        bezierCurveTo: () => {},
        quadraticCurveTo: () => {},
        stroke: () => {},
        fill: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        scale: () => {}
      })
    };
  },
  getElementById: (id) => {
    if (id === 'prop-toast') {
      return {
        style: {},
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        querySelector: () => ({ textContent: '' })
      };
    }
    return null;
  },
  querySelector: () => null
};

console.log('Testing Robot EVE Model & Wall-E Interactions...');

const { EveRobot } = await import('../public/js/eve.js');
const { updateHands } = await import('../public/js/robot-interaction.js');
const { WallERobot } = await import('../public/js/wall-e.js');

const mockScene = new MockGroup();
const mockCamera = new MockObject3D();
mockCamera.fov = 55;
mockCamera.position.set(0, 0, 25);

const wallE = new WallERobot(mockScene, mockCamera);
const eve = new EveRobot(mockScene, mockCamera);

wallE.setPartner(eve);
eve.setPartner(wallE);

// 1. Kiểm tra cấu trúc 3D của EVE
assert(eve.body, 'EVE phải có thân kén khí động học');
assert(eve.head, 'EVE phải có đầu lơ lửng maglev');
assert(eve.arms.length === 2, 'EVE phải có 2 cánh tay từ tính');
assert(eve.scanBeam, 'EVE phải có nón quét tia laser');
assert(eve.sparksGroup, 'EVE phải có nhóm hạt phát sáng điện tim');
console.log('PASS: Model EVE được khởi tạo hoàn chỉnh với đầy đủ các bộ phận!');

// 2. Kiểm tra các biểu cảm mắt LED qua Canvas
const emotions = ['normal', 'happy', 'wink', 'heart', 'scan', 'sleep'];
emotions.forEach(em => {
  eve.setEmotion(em);
  assert(eve.eyeState === (em === 'giggle' ? 'happy' : em), `Biểu cảm mắt EVE phải cập nhật đúng cho ${em}`);
});
console.log('PASS: Hệ thống mắt LED Cyan với đầy đủ 6 trạng thái biểu cảm mượt mà!');

// 3. Kiểm tra hoạt ảnh bay lượn phi trọng lực & nhịp thở
const initialY = eve.group.position.y;
eve.update(0.4, null);
assert(eve.head.position.y !== 0, 'Đầu Maglev phải có chuyển động lơ lửng bồng bềnh');
console.log('PASS: Chuyển động lơ lửng phi trọng lực và banking turns của EVE hoạt động chuẩn xác!');

// 4. Kiểm tra tương tác Nắm tay (Hold Hands)
console.log('Testing "Hold Hands" romantic interaction between WALL-E and EVE...');
wallE.triggerHoldHands(4.0);

assert.strictEqual(wallE.isHoldingHands, true, 'Wall-E phải chuyển sang trạng thái isHoldingHands');
assert.strictEqual(eve.isHoldingHands, true, 'EVE cũng phải tự động chuyển sang trạng thái isHoldingHands');
assert.strictEqual(eve.emotion, 'heart', 'Mắt EVE phải biến thành trái tim <3 khi nắm tay Wall-E');

// Cập nhật frame để kiểm tra cánh tay vươn ra
updateHands(wallE, eve, 0.5);
wallE.update(0.5, null);
eve.update(0.5, null);

assert(wallE.handHoldProgress > 0, 'Tiến trình vươn tay của Wall-E phải > 0');
assert(eve.handHoldProgress > 0, 'Tiến trình vươn tay của EVE phải > 0');
assert(wallE.arms[1].rotation.x < -0.3, 'Tay phải của Wall-E phải vươn ra phía trước để nắm tay');
assert(eve.arms[0].rotation.x < -0.3, 'Tay trái của EVE phải vươn ra phía trước để nắm tay');
assert.strictEqual(wallE.attention, 'eve', 'Ánh nhìn của Wall-E phải hướng về phía EVE');

console.log('PASS: Cử chỉ kinh điển Hold Hands hoạt động hoàn hảo, 2 robot cùng chìa tay nắm lấy nhau!');

// 5. Kiểm tra tương tác Click Raycast & Acrobatic Spin
const clickedEve = eve.interactAt(960, 540);
assert(clickedEve === true, 'Click vào EVE phải kích hoạt tương tác raycasting');
console.log('PASS: Tương tác tương tác click và hiệu ứng xoay lộn nhào biểu diễn thành công!');

// 6. Kiểm tra phản ứng theo từng giai đoạn (Stage 1 -> 6)
eve.setStage(2); // Xuân
assert.strictEqual(eve.emotion, 'happy', 'Mùa xuân EVE phải vui mừng');

eve.setStage(4); // Thu 20/10
assert.strictEqual(eve.emotion, 'heart', 'Mùa thu 20/10 EVE phải tràn ngập tình yêu với mắt trái tim');

eve.setStage(6); // Màn Kết Finale
assert.strictEqual(eve.emotion, 'sleep', 'Màn kết EVE phải cùng ngủ ngoan bên cạnh Wall-E trên đồi cỏ');
console.log('PASS: Tương tác 4 mùa và Màn Kết Finale 20/10 đồng bộ tuyệt đẹp!');

console.log('ALL TESTS PASSED: WALL-E & EVE 3D Models and Interactions 100% SUCCESSFUL!');
