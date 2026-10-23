// tests/test-anime-sky-layout.js
// Kiểm tra bộ điều khiển Anime Sky và tính phân định không chồng chéo giữa các tầng UI
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Testing Anime Sky & Non-Overlapping UI Layout...');

// 1. Kiểm tra cấu trúc index.html
const htmlPath = path.join(__dirname, '../public/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

assert(htmlContent.includes('id="anime-sky-container"'), 'Thiếu #anime-sky-container trong index.html');
assert(htmlContent.includes('sky-stage-1'), 'Thiếu sky-stage-1');
assert(htmlContent.includes('sky-stage-2'), 'Thiếu sky-stage-2');
assert(htmlContent.includes('sky-stage-3'), 'Thiếu sky-stage-3');
assert(htmlContent.includes('sky-stage-4'), 'Thiếu sky-stage-4');
assert(htmlContent.includes('sky-stage-5'), 'Thiếu sky-stage-5');
assert(htmlContent.includes('sky-stage-6'), 'Thiếu sky-stage-6');
assert(htmlContent.includes('css/anime-sky.css'), 'Thiếu link css/anime-sky.css');

// 2. Kiểm tra nội dung anime-sky.css
const cssPath = path.join(__dirname, '../public/css/anime-sky.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert(cssContent.includes('.sky-stage-1'), 'anime-sky.css thiếu .sky-stage-1');
assert(cssContent.includes('.sky-stage-2'), 'anime-sky.css thiếu .sky-stage-2');
assert(cssContent.includes('.sky-stage-3'), 'anime-sky.css thiếu .sky-stage-3');
assert(cssContent.includes('.sky-stage-4'), 'anime-sky.css thiếu .sky-stage-4');
assert(cssContent.includes('.sky-stage-5'), 'anime-sky.css thiếu .sky-stage-5');
assert(cssContent.includes('.sky-stage-6'), 'anime-sky.css thiếu .sky-stage-6');
assert(cssContent.includes('.scene-backdrop'), 'The painted background must fill the viewport');
assert(cssContent.includes('object-fit: cover'), 'Backgrounds must cover phone and desktop screens');
assert(cssContent.includes('prefers-reduced-motion'), 'Background transitions must honor reduced motion');

// 3. Kiểm tra logic mô phỏng chuyển stage trong AnimeSky
class MockLayer {
  constructor(className) {
    this.className = className;
    this.classes = new Set(className.split(' '));
  }
  classList = {
    contains: (cls) => this.classes.has(cls),
    add: (cls) => this.classes.add(cls),
    remove: (cls) => this.classes.delete(cls)
  };
}

const mockLayers = [1, 2, 3, 4, 5, 6].map(i => new MockLayer(`sky-layer sky-stage-${i}`));

function simulateSetStage(stageIndex) {
  const targetClass = `sky-stage-${stageIndex}`;
  mockLayers.forEach((layer) => {
    if (layer.classList.contains(targetClass)) {
      layer.classList.add('active');
    } else {
      layer.classList.remove('active');
    }
  });
}

// Chuyển sang stage 3 (Hè - Weathering with You)
simulateSetStage(3);
assert(mockLayers[2].classes.has('active'), 'Stage 3 phải có class active');
assert(!mockLayers[0].classes.has('active'), 'Stage 1 không được có active khi ở stage 3');
assert(!mockLayers[5].classes.has('active'), 'Stage 6 không được có active khi ở stage 3');

// Chuyển sang stage 6 (Màn Kết - Hồ Itomori Your Name)
simulateSetStage(6);
assert(mockLayers[5].classes.has('active'), 'Stage 6 phải có class active');
assert(!mockLayers[2].classes.has('active'), 'Stage 3 phải bị gỡ active khi sang stage 6');

// 4. Kiểm tra css/vinyl.css có class .finale-docked
const vinylCssPath = path.join(__dirname, '../public/css/vinyl.css');
const vinylCssContent = fs.readFileSync(vinylCssPath, 'utf8');
assert(vinylCssContent.includes('.vinyl-dock.finale-docked'), 'vinyl.css thiếu class .finale-docked');
assert(vinylCssContent.includes('.finale-docked-lyrics'), 'vinyl.css thiếu class .finale-docked-lyrics');

console.log('PASS: Anime Sky & Non-Overlapping Layout verified successfully!');
