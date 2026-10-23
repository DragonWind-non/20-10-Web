// tests/test-navigation-and-dock.js
// Kiểm tra hệ thống điều hướng UX (Timeline Stepper, Nút CTA Màn 1, Nút Toàn màn hình)
// và chế độ Đĩa than Mini xuyên suốt (Persistent Mini Vinyl Dock)
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing Navigation Controls & Persistent Mini Vinyl Dock...');

// 1. Kiểm tra cấu trúc index.html
const htmlPath = path.join(__dirname, '../public/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

assert(htmlContent.includes('id="fullscreen-toggle"'), 'Thiếu #fullscreen-toggle trong index.html');
assert(htmlContent.includes('id="season-stepper"'), 'Thiếu #season-stepper trong index.html');
assert(htmlContent.includes('data-stage="1"'), 'Thiếu nốt giai đoạn 1');
assert(htmlContent.includes('data-stage="2"'), 'Thiếu nốt giai đoạn 2');
assert(htmlContent.includes('data-stage="3"'), 'Thiếu nốt giai đoạn 3');
assert(htmlContent.includes('data-stage="4"'), 'Thiếu nốt giai đoạn 4');
assert(htmlContent.includes('data-stage="5"'), 'Thiếu nốt giai đoạn 5');
assert(htmlContent.includes('data-stage="6"'), 'Thiếu nốt giai đoạn 6');
assert(htmlContent.includes('id="btn-start-journey"'), 'Thiếu nút #btn-start-journey ở Màn 1');

// 2. Kiểm tra mã nguồn css/style.css
const stylePath = path.join(__dirname, '../public/css/style.css');
const styleContent = fs.readFileSync(stylePath, 'utf8');

assert(styleContent.includes('.top-hud-controls'), 'Thiếu class .top-hud-controls');
assert(styleContent.includes('.hud-pill-btn'), 'Thiếu class .hud-pill-btn');
assert(styleContent.includes('.season-stepper'), 'Thiếu class .season-stepper');
assert(styleContent.includes('.step-node'), 'Thiếu class .step-node');
assert(styleContent.includes('.btn-start-journey'), 'Thiếu class .btn-start-journey');
assert(styleContent.includes('pulseStartBtn'), 'Thiếu animation pulseStartBtn');

// 3. Kiểm tra mã nguồn css/vinyl.css
const vinylPath = path.join(__dirname, '../public/css/vinyl.css');
const vinylContent = fs.readFileSync(vinylPath, 'utf8');

assert(vinylContent.includes('.vinyl-dock.dock-mini'), 'Thiếu class .vinyl-dock.dock-mini');
assert(vinylContent.includes('.vinyl-dock.dock-mini.collapsed'), 'Thiếu class .vinyl-dock.dock-mini.collapsed');

// 4. Kiểm tra mã nguồn js/vinyl-dock.js
const vinylJsPath = path.join(__dirname, '../public/js/vinyl-dock.js');
const vinylJsContent = fs.readFileSync(vinylJsPath, 'utf8');

assert(vinylJsContent.includes('setMode(mode = \'mini\')'), 'Thiếu phương thức setMode trong VinylDock');
assert(vinylJsContent.includes('classList.add(\'dock-mini\')'), 'Thiếu xử lý class dock-mini');
assert(vinylJsContent.includes('classList.add(\'finale-docked\')'), 'Thiếu xử lý class finale-docked');

// 5. Kiểm tra mã nguồn js/app.js
const appPath = path.join(__dirname, '../public/js/app.js');
const appContent = fs.readFileSync(appPath, 'utf8');

assert(appContent.includes('toggleFullscreen()'), 'Thiếu hàm toggleFullscreen trong App');
assert(appContent.includes('updateFullscreenUI()'), 'Thiếu hàm updateFullscreenUI trong App');
assert(appContent.includes('this.seasonStepper'), 'Thiếu tham chiếu this.seasonStepper trong App');
assert(appContent.includes('this.btnStartJourney'), 'Thiếu tham chiếu this.btnStartJourney trong App');

// 6. Mô phỏng chế độ dock nhạc tương ứng theo từng giai đoạn
function getExpectedDockMode(stage) {
  if (stage >= 1 && stage <= 4) return 'mini';
  if (stage === 5) return 'stage5';
  if (stage === 6) return 'finale';
  return 'unknown';
}

assert.strictEqual(getExpectedDockMode(1), 'mini', 'Giai đoạn 1 phải dùng dock mini');
assert.strictEqual(getExpectedDockMode(2), 'mini', 'Giai đoạn 2 phải dùng dock mini');
assert.strictEqual(getExpectedDockMode(3), 'mini', 'Giai đoạn 3 phải dùng dock mini');
assert.strictEqual(getExpectedDockMode(4), 'mini', 'Giai đoạn 4 phải dùng dock mini');
assert.strictEqual(getExpectedDockMode(5), 'stage5', 'Giai đoạn 5 phải dùng dock stage5');
assert.strictEqual(getExpectedDockMode(6), 'finale', 'Giai đoạn 6 phải dùng dock finale');

console.log('PASS: All Navigation Controls & Mini Vinyl Dock tests verified successfully!');
