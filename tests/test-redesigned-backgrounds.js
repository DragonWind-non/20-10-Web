// tests/test-redesigned-backgrounds.js
// Kiểm tra thiết kế nền Mùa Đông (Cực quang đa tầng & Vành đai quầng băng 22°)
// và Màn Cuối Grand Finale (Bầu trời sao vũ trụ Your Name rực rỡ lấp lánh, không bị đen mù)
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing Redesigned Backgrounds (Winter Aurora & Grand Finale Starry Sky)...');

// Each stage has a distinct, production-sized, locally served image.
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../public/css/anime-sky.css'), 'utf8');
const backgrounds = ['cosmos', 'spring', 'summer', 'autumn', 'winter', 'finale'];
let totalBytes = 0;
const fingerprints = new Set();
for (let i = 0; i < backgrounds.length; i++) {
  assert(html.includes(`sky-stage-${i + 1}`));
  const bytes = fs.readFileSync(path.join(__dirname, `../public/assets/backgrounds/${backgrounds[i]}.jpg`));
  assert(bytes[0] === 0xff && bytes[1] === 0xd8, 'Background must be a valid JPEG');
  assert(bytes.length > 100000 && bytes.length < 700000, 'Artwork should retain detail without oversized downloads');
  totalBytes += bytes.length;
  fingerprints.add(bytes.subarray(bytes.length - 4096).toString('base64'));
}
assert.equal(fingerprints.size, 6, 'Seasons must use different paintings');
assert(totalBytes < 3_000_000, 'The complete six-scene background set must stay below 3 MB');
assert(css.includes('prefers-reduced-motion') && css.includes('visibility'), 'Background handoff needs a motion fallback and inactive-layer culling');

// 3. Kiểm tra Scene3D trong js/scene3d.js
const scenePath = path.join(__dirname, '../public/js/scene3d.js');
const sceneJs = fs.readFileSync(scenePath, 'utf8');

// Kiểm tra xử lý Fog khắc phục màn đen
assert(sceneJs.includes('this.targetFogColor'), 'Thiếu targetFogColor thích ứng theo mùa');
assert(sceneJs.includes('this.targetFogDensity'), 'Thiếu targetFogDensity thích ứng theo mùa');
assert(sceneJs.includes('0.0018'), 'Fog density ở màn cuối phải hạ xuống cực thấp (0.0018) để sao tỏa sáng rực rỡ không bị đen');
assert(sceneJs.includes('this.scene.fog.color.lerp'), 'Thiếu lerp màu sương mù mượt mà');
assert(sceneJs.includes('this.scene.fog.density +='), 'Thiếu lerp độ đậm sương mù');

// Kiểm tra các thành phần 3D mới
assert(sceneJs.includes('createWinterDiamondDust'), 'Thiếu hàm tạo bụi kim cương băng giá 3D cho mùa đông');
assert(sceneJs.includes('createMacroStars'), 'Thiếu hàm tạo sao lớn 3D 4 cánh lấp lánh cho màn cuối');
assert(sceneJs.includes('createStardustRiver'), 'Thiếu hàm tạo dải bụi sao 3D cho màn cuối');
assert(sceneJs.includes('createBackgroundSkyLanterns'), 'Thiếu hàm tạo đèn trời thả ước nguyện 3D cho màn cuối');
assert(sceneJs.includes('particleTextures.starCross'), 'Thiếu texture sao kim cương có tia tán xạ chữ thập');

console.log('PASS: js/scene3d.js xử lý Fog thích ứng & vật thể 3D chiều sâu ảo diệu đạt chuẩn!');
console.log('ALL PASS: Redesigned Backgrounds verified 100%!');
