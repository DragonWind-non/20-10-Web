// js/vinyl-dock.js - Trình phát Đĩa Than 3D & Hiển thị Lyric Đồng Bộ Thời Gian Thực (Đã vá lỗi Code Review)
/* global THREE */
import { getStageArea } from './scene-layout.js';

export class VinylDock {
  constructor(audioManager, scene, camera) {
    this.audioManager = audioManager;
    this.scene = scene;
    this.camera = camera;

    // DOM Elements
    this.dockContainer = document.getElementById('vinyl-dock');
    this.miniDisc = document.getElementById('mini-vinyl-disc');
    this.trackTitle = document.getElementById('dock-track-title');
    this.trackArtist = document.getElementById('dock-track-artist');
    this.btnPlay = document.getElementById('btn-play-pause');
    this.btnPrev = document.getElementById('btn-prev-track');
    this.btnNext = document.getElementById('btn-next-track');

    this.lyricContainer = document.getElementById('lyric-hud');
    this.lyricMain = document.getElementById('lyric-main');
    this.lyricSub = document.getElementById('lyric-subtext');

    // 3D Vinyl Mesh in Three.js
    this.vinyl3DMesh = null;
    this.is3DSpinning = false;

    this.initEvents();
    this.updateTrackInfo(this.audioManager.getCurrentTrack());
    this.init3DVinyl();
  }

  initEvents() {
    if (this.btnPlay) {
      this.btnPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audioManager.initSync();
        const playing = this.audioManager.togglePlay();
        this.setSpinning(playing);
      });
    }

    if (this.btnNext) {
      this.btnNext.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audioManager.next();
      });
    }

    if (this.btnPrev) {
      this.btnPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audioManager.prev();
      });
    }

    if (this.miniDisc) {
      this.miniDisc.setAttribute('role', 'button');
      this.miniDisc.setAttribute('tabindex', '0');
      this.miniDisc.setAttribute('aria-label', 'Thu gọn hoặc mở trình phát nhạc');
      this.miniDisc.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.miniDisc.click();
        }
      });
      this.miniDisc.addEventListener('click', (e) => {
        if (this.dockContainer && this.dockContainer.classList.contains('dock-mini')) {
          e.stopPropagation();
          this.dockContainer.classList.toggle('collapsed');
        }
      });
    }

    // Lắng nghe thay đổi bài hát
    this.audioManager.onTrackChange((track) => {
      this.updateTrackInfo(track);
    });

    // Lắng nghe thay đổi lyric
    this.audioManager.onLyricChange(({ activeLine, nextLine }) => {
      this.updateLyrics(activeLine, nextLine);
    });

    // Lắng nghe resize màn hình để định vị lại đĩa than 3D
    window.addEventListener('resize', () => {
      this.updateResponsivePosition();
    });
  }

  // Tạo đĩa than 3D vinyl xoay lơ lửng trong Three.js
  init3DVinyl() {
    if (!this.scene || !this.camera || typeof THREE === 'undefined') return;

    const vinylGroup = new THREE.Group();
    this.worldPoint = new THREE.Vector3();

    // 1. Đĩa than chính (Cylinder đen tuyền)
    const discGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.08, 64);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.35,
      metalness: 0.7
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    vinylGroup.add(discMesh);

    // 2. Nhãn tâm tròn màu vàng ánh kim (Center Gold Label)
    const labelGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.09, 32);
    const labelMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0x886611,
      emissiveIntensity: 0.4,
      roughness: 0.3
    });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    vinylGroup.add(labelMesh);

    // Lỗ trục giữa đĩa
    const holeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const holeMesh = new THREE.Mesh(holeGeo, holeMat);
    vinylGroup.add(holeMesh);

    vinylGroup.rotation.x = Math.PI / 3;
    vinylGroup.rotation.z = Math.PI / 6;
    vinylGroup.visible = false;

    this.vinyl3DMesh = vinylGroup;
    this.updateResponsivePosition();
    this.scene.add(vinylGroup);
  }

  // Use the same camera projection and reading boundaries as the robots and props.
  updateResponsivePosition() {
    if (!this.vinyl3DMesh) return;

    const area = getStageArea();
    const pixels = Math.min(144, area.width * 0.20, area.height * 0.27);
    const x = area.left + pixels / 2 + 12;
    const y = area.top + area.height - pixels / 2;
    const depth = 8;
    const viewHeight = 2 * Math.tan(this.camera.fov * Math.PI / 360) * Math.abs(this.camera.position.z - depth);
    this.worldPoint.set(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2, 0.5).unproject(this.camera);
    this.worldPoint.sub(this.camera.position);
    this.worldPoint.multiplyScalar((depth - this.camera.position.z) / this.worldPoint.z);
    this.vinyl3DMesh.position.copy(this.camera.position).add(this.worldPoint);
    // Leave perspective clearance for the full rotating disc, not only its center.
    this.vinyl3DMesh.scale.setScalar(pixels * viewHeight / innerHeight / 7.2);
  }

  show() {
    if (this.dockContainer) {
      this.dockContainer.style.display = 'flex';
    }
    if (this.lyricContainer) {
      this.lyricContainer.style.display = 'flex';
    }
    if (this.vinyl3DMesh) {
      this.updateResponsivePosition();
      this.vinyl3DMesh.visible = true;
    }
    this.setSpinning(this.audioManager.isPlaying);
  }

  hide() {
    if (this.dockContainer) {
      this.dockContainer.style.display = 'none';
    }
    if (this.lyricContainer) {
      this.lyricContainer.style.display = 'none';
    }
    if (this.vinyl3DMesh) {
      this.vinyl3DMesh.visible = false;
    }
    this.setSpinning(false);
  }

  // Quản lý chế độ hiển thị xuyên suốt: 'mini' (Giai đoạn 1-4), 'stage5' (Giai đoạn 5), 'finale' (Giai đoạn 6)
  setMode(mode = 'mini') {
    if (!this.dockContainer) return;

    this.dockContainer.style.display = 'flex';

    if (mode === 'mini') {
      this.dockContainer.classList.add('dock-mini');
      this.dockContainer.classList.remove('finale-docked');
      if (this.lyricContainer) {
        this.lyricContainer.style.display = 'none';
      }
      if (this.vinyl3DMesh) {
        this.vinyl3DMesh.visible = false;
      }
      this.setSpinning(this.audioManager.isPlaying);
    } else if (mode === 'stage5') {
      this.dockContainer.classList.remove('dock-mini');
      this.dockContainer.classList.remove('finale-docked');
      this.dockContainer.classList.remove('collapsed');
      if (this.lyricContainer) {
        this.lyricContainer.style.display = 'flex';
        this.lyricContainer.classList.remove('finale-docked-lyrics');
      }
      if (this.vinyl3DMesh) {
        this.updateResponsivePosition();
        this.vinyl3DMesh.visible = true;
      }
      this.setSpinning(this.audioManager.isPlaying);
    } else if (mode === 'finale') {
      this.dockContainer.classList.remove('dock-mini');
      this.dockContainer.classList.add('finale-docked');
      this.dockContainer.classList.remove('collapsed');
      if (this.lyricContainer) {
        this.lyricContainer.classList.add('finale-docked-lyrics');
        this.lyricContainer.style.display = 'none';
      }
      if (this.vinyl3DMesh) {
        this.vinyl3DMesh.visible = false;
      }
      this.setSpinning(this.audioManager.isPlaying);
    }
  }

  updateTrackInfo(track) {
    if (!track) return;
    if (this.trackTitle) this.trackTitle.textContent = track.title || 'Chưa đặt tên';
    if (this.trackArtist) this.trackArtist.textContent = track.artist || 'Nghệ sĩ ẩn danh';
  }

  setSpinning(isSpinning) {
    this.is3DSpinning = isSpinning;
    if (this.miniDisc) {
      if (isSpinning) {
        this.miniDisc.classList.add('spinning');
        if (this.btnPlay) this.btnPlay.textContent = '⏸';
      } else {
        this.miniDisc.classList.remove('spinning');
        if (this.btnPlay) this.btnPlay.textContent = '▶';
      }
    }
  }

  updateLyrics(activeLine, nextLine) {
    clearTimeout(this.lyricTimer);
    if (this.lyricMain) {
      if (activeLine && activeLine.text) {
        this.lyricMain.style.opacity = '0';
        this.lyricMain.style.transform = 'translateY(8px)';
        this.lyricTimer = setTimeout(() => {
          this.lyricMain.textContent = `♪ ${activeLine.text} ♪`;
          this.lyricMain.style.opacity = '1';
          this.lyricMain.style.transform = 'translateY(0)';
        }, 150);
      } else {
        this.lyricMain.textContent = '';
      }
    }

    if (this.lyricSub) {
      if (nextLine && nextLine.text) {
        this.lyricSub.textContent = `[ Sắp tới: ${nextLine.text} ]`;
      } else {
        this.lyricSub.textContent = '';
      }
    }
  }

  // Cập nhật góc quay đĩa than 3D qua mỗi frame
  update(delta) {
    if (this.vinyl3DMesh && this.vinyl3DMesh.visible) {
      this.updateResponsivePosition();
      if (this.is3DSpinning) this.vinyl3DMesh.rotation.y += delta * 1.4;
    }
  }
}
