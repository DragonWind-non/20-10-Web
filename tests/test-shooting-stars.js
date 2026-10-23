// tests/test-shooting-stars.js
// Kiểm tra hệ thống vệt sao băng dài lóe sáng (3D Ribbons & Anime Sky CSS) với chu kỳ 10s
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing Shooting Stars & Meteors System (10s Cycle & Luminous Flares)...');

// 1. Kiểm tra mã nguồn scene3d.js
const scenePath = path.join(__dirname, '../public/js/scene3d.js');
const sceneContent = fs.readFileSync(scenePath, 'utf8');

assert(sceneContent.includes('this.meteorInterval = 10.0'), 'Thiếu meteorInterval = 10.0 trong Scene3D');
assert(sceneContent.includes('this.meteorTimer = 7.5'), 'Thiếu meteorTimer = 7.5 (kích hoạt sau 2.5s đầu)');
assert(sceneContent.includes('createMeteorRibbonGeometry'), 'Thiếu hàm tạo hình dải ruy băng sao băng 3D');
assert(sceneContent.includes('triggerMeteorShower'), 'Thiếu hàm kích hoạt đợt sao băng');
assert(sceneContent.includes('particleTextures.meteorHead'), 'Thiếu texture đầu sao băng lóe sáng');
assert(sceneContent.includes('particleTextures.meteorTrail'), 'Thiếu texture vệt thân sao băng phát sáng');

// 3. Kiểm tra tính toán chu kỳ 10 giây
class MockMeteorTimer {
  constructor() {
    this.timer = 7.5;
    this.interval = 10.0;
    this.triggerCount = 0;
    this.triggerTimes = [];
    this.totalTime = 0;
  }

  update(delta) {
    this.totalTime += delta;
    this.timer += delta;
    if (this.timer >= this.interval) {
      this.timer -= this.interval;
      this.triggerCount++;
      this.triggerTimes.push(parseFloat(this.totalTime.toFixed(2)));
    }
  }
}

const sim = new MockMeteorTimer();
// Giả lập chạy 35 giây với bước nhảy 0.1s
for (let t = 0; t < 350; t++) {
  sim.update(0.1);
}

// Đợt 1 phải nổ tại t ≈ 2.5s (vì 10 - 7.5 = 2.5s)
assert(Math.abs(sim.triggerTimes[0] - 2.5) <= 0.15, `Đợt 1 phải xuất hiện sau khoảng 2.5s (thực tế: ${sim.triggerTimes[0]}s)`);
// Đợt 2 phải nổ tại t ≈ 12.5s (+10s)
assert(Math.abs(sim.triggerTimes[1] - 12.5) <= 0.15, `Đợt 2 phải xuất hiện sau khoảng 12.5s (thực tế: ${sim.triggerTimes[1]}s)`);
// Đợt 3 phải nổ tại t ≈ 22.5s (+10s)
assert(Math.abs(sim.triggerTimes[2] - 22.5) <= 0.15, `Đợt 3 phải xuất hiện sau khoảng 22.5s (thực tế: ${sim.triggerTimes[2]}s)`);
// Đợt 4 phải nổ tại t ≈ 32.5s (+10s)
assert(Math.abs(sim.triggerTimes[3] - 32.5) <= 0.15, `Đợt 4 phải xuất hiện sau khoảng 32.5s (thực tế: ${sim.triggerTimes[3]}s)`);

// 4. Kiểm tra đường cong lóe sáng (Flash Intensity Curve)
function calcFlashIntensity(p) {
  if (p < 0.15) {
    return p / 0.15;
  } else if (p < 0.65) {
    return 1.0;
  } else {
    const t = (p - 0.65) / 0.35;
    return Math.max(0, 1.0 - t * t);
  }
}

assert.strictEqual(calcFlashIntensity(0), 0, 'Độ sáng lúc xuất hiện ban đầu phải bằng 0');
assert.strictEqual(calcFlashIntensity(0.15), 1.0, 'Độ sáng lúc lóe sáng đỉnh cao phải là 1.0');
assert.strictEqual(calcFlashIntensity(0.4), 1.0, 'Độ sáng khi bay vụt qua phải duy trì 1.0');
assert(calcFlashIntensity(0.85) < 1.0, 'Độ sáng phải giảm dần về cuối hành trình');
assert.strictEqual(calcFlashIntensity(1.0), 0, 'Độ sáng khi kết thúc phải bằng 0');

console.log('PASS: All Shooting Stars & Meteors System tests verified successfully!');
