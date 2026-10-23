import { CONFIG } from '../config.js';
import { AudioManager } from './audio-manager.js';
import { Scene3D } from './scene3d.js';
import { WallERobot } from './wall-e.js';
import { EveRobot } from './eve.js';
import { POVGuide } from './pov-guide.js';
import { VinylDock } from './vinyl-dock.js';
import { FinaleManager } from './finale.js';
import { AnimeSky } from './anime-sky.js';
import { getStageArea, joinRobotHands } from './scene-layout.js';
import { holdHands, releaseHands, updateHands } from './robot-interaction.js';
import { RoseGift } from './rose-gift.js';
import { SceneTransition, PASSAGE } from './scene-transition.js';
import { LiquidTransition } from './liquid-transition.js';
import { PropDelivery } from './prop-delivery.js';
import { PairMoments } from './pair-moments.js';
import { bindTouchNavigation } from './touch-navigation.js';

class App {
  constructor() {
    this.stage = 1;
    this.maxStages = 6;
    this.lastTransitionTime = 0;
    this.audioStarted = false;
    this.ambientTimer = 6;
    this.ambientAction = 0;
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');

    // DOM Elements
    this.stageIndicator = document.getElementById('stage-indicator');
    this.narrativeBox = document.getElementById('narrative-box');
    this.dialogueTitle = document.getElementById('dialogue-title');
    this.dialogueText = document.getElementById('dialogue-text');
    this.climaxWishContainer = document.getElementById('climax-wish-container');
    this.interactionHint = document.getElementById('interaction-hint');
    this.audioToggle = document.getElementById('audio-toggle');
    this.audioLabel = document.getElementById('audio-label');
    this.fullscreenBtn = document.getElementById('fullscreen-toggle');
    this.seasonStepper = document.getElementById('season-stepper');
    this.btnStartJourney = document.getElementById('btn-start-journey');
    this.roseButton = document.getElementById('rose-moment');
    this.propDiscovery = document.getElementById('prop-discover');
    this.roseRequested = false;

    // Modules
    this.animeSky = null;
    this.audioManager = null;
    this.scene3d = null;
    this.wallE = null;
    this.eve = null;
    this.povGuide = null;
    this.vinylDock = null;
    this.finaleManager = null;

    this.init();
  }

  init() {
    console.log(`[App] Khởi động hành trình 20/10 dành tặng: ${CONFIG.recipientName}`);

    // 0. Khởi tạo Bầu Trời Anime Makoto Shinkai
    this.animeSky = new AnimeSky();

    // 1. Khởi tạo 3D Scene
    if (typeof THREE === 'undefined') return this.showGreetingFallback();
    try {
      this.scene3d = new Scene3D();
    } catch (error) {
      console.warn('[App] Không thể khởi tạo 3D:', error);
      return this.showGreetingFallback();
    }

    // 2. Khởi tạo Audio Manager
    this.audioManager = new AudioManager();

    // 3. Khởi tạo Wall-E & EVE Robot 3D
    this.wallE = new WallERobot(this.scene3d.scene, this.scene3d.camera);
    this.eve = new EveRobot(this.scene3d.scene, this.scene3d.camera);
    this.wallE.setPartner(this.eve);
    this.eve.setPartner(this.wallE);
    this.roseGift = new RoseGift(this.scene3d.scene, this.wallE, this.eve);

    // 4. Khởi tạo POV Guide (Góc nhìn bàn tay & Bướm dạ quang)
    this.povGuide = new POVGuide(this.scene3d.scene);

    // 5. Khởi tạo Vinyl Dock & Lyric HUD
    this.vinylDock = new VinylDock(this.audioManager, this.scene3d.scene, this.scene3d.camera);

    // 6. Khởi tạo Grand Finale Manager
    this.finaleManager = new FinaleManager(this.scene3d, this.wallE, this.vinylDock, this.eve);
    this.sceneTransition = new SceneTransition(this.scene3d.camera, this.wallE, this.eve);
    this.liquidTransition = new LiquidTransition(this.scene3d, this.animeSky.layers);
    this.propDelivery = new PropDelivery(this);
    this.pairMoments = new PairMoments(this);
    this.discoveryPoint = new THREE.Vector3();
    this.scene3d.seasonalProps.onInteract = prop => {
      this.roseRequested = false;
      this.propDiscovery.classList.remove('is-new');
      return this.propDelivery.start(prop);
    };
    // Prepare hidden gesture materials before their first interactive frame.
    this.scene3d.renderer.compile(this.scene3d.scene, this.scene3d.camera);

    // 7. Đồng bộ nhịp đập âm nhạc với trái tim nảy trên đầu Wall-E & EVE
    this.audioManager.onBeat((intensity) => {
      if (this.wallE) {
        this.wallE.triggerHeartBounce(intensity);
      }
      if (this.eve && this.eve.emotion === 'heart') {
        this.eve.motion.kick((Math.random() - 0.5) * 0.1, 0.08 * intensity);
      }
    });

    // 8. Đăng ký các sự kiện điều hướng theo tốc độ người xem (Click, Tap, Scroll, Swipe)
    this.initNavigationEvents();
    this.layoutObserver = new ResizeObserver(() => {
      this.wallE.fitToViewport();
      this.eve.fitToViewport();
      this.updateStepperSelection();
      this.updateDiscovery();
    });
    [this.narrativeBox, this.vinylDock.lyricContainer, this.vinylDock.dockContainer, this.povGuide.container, this.seasonStepper]
      .forEach(element => this.layoutObserver.observe(element));
    document.addEventListener('visibilitychange', () => {
      document.body.classList.toggle('is-paused', document.hidden);
      if (document.hidden) {
        this.pausedPassage = [this.phaseAnimation, this.animeSky.glowAnimation, this.propDelivery.letterAnimation,
          ...this.animeSky.layers.map(layer => layer.passageAnimation)]
          .filter(animation => animation?.playState === 'running');
        this.pausedPassage.forEach(animation => animation.pause());
      } else {
        this.resetFrameClock = true;
        for (const animation of this.pausedPassage || []) if (animation.playState === 'paused') animation.play();
        this.pausedPassage = [];
      }
    });
    this.motionQuery.addEventListener('change', () => {
      this.phaseAnimation?.cancel();
      if (this.motionQuery.matches) {
        if (this.propDelivery.active) this.propDelivery.reduceMotion();
        else this.sceneTransition.cancel(true);
        this.liquidTransition.active = false;
        this.roseGift.cancel(true);
        this.pairMoments.cancel(true);
        this.wallE.motion.update(0, true, false);
        this.eve.motion.update(0, true, false);
        this.eve.spinTime = 0;
        this.eve.pendingSpin = false;
      }
      this.wallE.fitToViewport();
      if (this.eve) this.eve.fitToViewport();
    });

    // 9. Bắt đầu vòng lặp cập nhật animation
    this.startMainLoop();

    // 10. Thiết lập trạng thái sân khấu ban đầu (Stage 1)
    this.applyStage(1);
  }

  showGreetingFallback() {
    this.animeSky.setStage(4);
    ['ui-container', 'webgl-canvas', 'finale-layer'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
    document.getElementById('fallback-recipient').textContent = `Gửi ${CONFIG.recipientName},`;
    const wishes = CONFIG.wishesStream.map(text => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      return paragraph;
    });
    document.getElementById('fallback-wishes').replaceChildren(...wishes);
    document.getElementById('fallback-retry').addEventListener('click', () => location.reload());
    document.getElementById('greeting-fallback').hidden = false;
    document.getElementById('fallback-title').focus();
  }

  initNavigationEvents() {
    // Helper kiểm tra xem target có phải thuộc khu vực điều khiển hoặc dòng chúc hay không
    const isControlTarget = (target) => {
      return Boolean(
        target.closest('.vinyl-dock') ||
        target.closest('#audio-toggle') ||
        target.closest('#fullscreen-toggle') ||
        target.closest('#season-stepper') ||
        target.closest('#btn-start-journey') ||
        target.closest('#prop-toast') ||
        target.closest('#prop-letter') ||
        target.closest('#pair-moment') ||
        target.closest('#prop-discover') ||
        target.closest('#finale-ritual') ||
        target.closest('.finale-photo-credit') ||
        target.closest('.narrative-card') ||
        target.closest('.wishes-stream-column') ||
        target.closest('.wishes-stream-scroll')
      );
    };

    // A. Bắt sự kiện Click trên toàn màn hình (User Activation Event)
    window.addEventListener('click', (e) => {
      if (this.touchNavigation.shouldIgnoreClick(e)) return;
      if (isControlTarget(e.target)) return;
      this.activateAt(e.clientX, e.clientY);
    });

    // B. Bắt sự kiện Cuộn chuột (Mouse Wheel Scroll)
    let wheelTimeout = null;
    window.addEventListener('wheel', (e) => {
      if (isControlTarget(e.target)) return;
      if (wheelTimeout) return;
      wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 350);

      // Không gọi startAudio ở wheel vì trình duyệt chặn non-gesture autoplay
      if (e.deltaY > 30) {
        this.handleUserAdvance(1);
      } else if (e.deltaY < -30) {
        this.handleUserAdvance(-1);
      }
    }, { passive: true });

    this.roseButton.addEventListener('click', () => {
      this.ensureAudioUnlocked();
      this.roseRequested = true;
      this.roseGift.wait = 0;
      releaseHands(this.wallE, this.eve);
    });
    this.propDiscovery.addEventListener('click', () => {
      this.ensureAudioUnlocked();
      const props = this.scene3d.seasonalProps;
      const prop = props.props[this.stage - 1];
      if (!props.onInteract(prop)) props.reactProp(prop);
    });

    this.touchNavigation = bindTouchNavigation(window, {
      isControlTarget,
      onTap: (x, y) => this.activateAt(x, y, true),
      onSwipe: direction => { this.ensureAudioUnlocked(); this.handleUserAdvance(direction); }
    });

    window.addEventListener('keydown', (event) => {
      if (event.target.closest('button, input, textarea, [contenteditable="true"], .has-season-wish, #prop-letter')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') this.handleUserAdvance(1);
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') this.handleUserAdvance(-1);
    });

    // D. Nút Bật/Tắt âm thanh ở góc trên
    if (this.audioToggle) {
      this.audioToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const started = this.audioStarted;
        this.ensureAudioUnlocked();
        const playing = started ? this.audioManager.togglePlay() : true;
        this.updateAudioLabel(playing);
        if (this.vinylDock) this.vinylDock.setSpinning(playing);
      });
    }

    // D2. Nút Bật/Tắt Toàn Màn Hình
    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFullscreen();
      });
      document.addEventListener('fullscreenchange', () => {
        this.updateFullscreenUI();
      });
    }

    // D3. Thanh Điều Hướng 6 Giai Đoạn (Timeline Stepper)
    if (this.seasonStepper) {
      this.seasonStepper.querySelectorAll('.step-node').forEach((node) => {
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          this.ensureAudioUnlocked();
          const target = parseInt(node.getAttribute('data-stage'), 10);
          if (!isNaN(target)) {
            this.goToStage(target);
          }
        });
      });
    }

    // D4. Nút Khám Phá 4 Mùa ở Màn 1 (CTA Button)
    if (this.btnStartJourney) {
      this.btnStartJourney.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ensureAudioUnlocked();
        this.goToStage(2);
      });
    }

    // E. Theo dõi con trỏ chuột cho Wall-E, EVE, Parallax và Tương tác Vật thể 3D 4 Mùa
    const updatePointer = (e) => {
      if (e.pointerType === 'touch') return;
      this.ambientTimer = Math.max(this.ambientTimer, 4);
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      if (this.wallE) {
        this.wallE.setPointer(normX, normY);
      }
      if (this.eve) {
        this.eve.setPointer(normX, normY);
      }
      this.animeSky.setPointer(normX, normY);
      const glass = e.target.closest('.narrative-card, .vinyl-dock');
      if (glass) {
        const rect = glass.getBoundingClientRect();
        glass.style.setProperty('--glass-x', `${(e.clientX - rect.left) / rect.width * 100}%`);
        glass.style.setProperty('--glass-y', `${(e.clientY - rect.top) / rect.height * 100}%`);
      }

      if (this.scene3d && this.scene3d.checkHover) {
        const isHovered = this.scene3d.checkHover(e.clientX, e.clientY);
        if (!isHovered) {
          const overBtn = e.target && e.target.closest && e.target.closest('button, .step-node, #audio-toggle, #fullscreen-toggle, .btn-dock');
          if (!overBtn) {
            document.body.style.cursor = 'default';
          }
        }
      }
    };
    window.addEventListener('pointermove', updatePointer);
    window.addEventListener('pointerdown', updatePointer);
  }

  activateAt(x, y, touch = false) {
    this.ensureAudioUnlocked();
    if (this.sceneTransition.active && !this.sceneTransition.delivery) return;
    const points = [[x, y]];
    // A small screen-space margin makes moving 3D details reachable by a fingertip.
    if (touch) for (const [dx, dy] of [[-12,0],[12,0],[0,-12],[0,12]]) points.push([x+dx, y+dy]);
    for (const [px, py] of points) {
      if (this.wallE.interactAt(px, py) || this.eve.interactAt(px, py) || this.scene3d.interactAt(px, py)) return;
    }
    this.handleUserAdvance(1);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('[App] Không thể bật toàn màn hình:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('[App] Không thể thoát toàn màn hình:', err);
        });
      }
    }
  }

  updateFullscreenUI() {
    if (!this.fullscreenBtn) return;
    const isFull = Boolean(document.fullscreenElement);
    const icon = this.fullscreenBtn.querySelector('.fullscreen-icon');
    const text = this.fullscreenBtn.querySelector('.fullscreen-text');
    if (icon) icon.textContent = isFull ? '🗗' : '⛶';
    if (text) text.textContent = isFull ? 'Thu nhỏ' : 'Toàn màn hình';
    this.fullscreenBtn.setAttribute('title', isFull ? 'Thoát toàn màn hình' : 'Chế độ toàn màn hình');
  }

  // Khởi động phát nhạc đồng bộ ngay trong event tick của người dùng (Vá lỗi Issue 2 cho iOS Safari)
  ensureAudioUnlocked() {
    if (!this.audioStarted && this.audioManager) {
      this.audioStarted = true;
      // Khởi động đồng bộ không await để không làm mất token user activation
      this.audioManager.initSync();
      if (!this.audioManager.audioElement.src) this.audioManager.play(0);
      this.updateAudioLabel(true);
      if (this.vinylDock) this.vinylDock.setSpinning(true);
    }
  }

  updateAudioLabel(isPlaying) {
    if (this.audioLabel) {
      this.audioLabel.textContent = isPlaying ? "Âm nhạc: Đang phát" : "Âm nhạc: Tạm dừng";
    }
  }

  // Điều hướng người xem qua các giai đoạn
  handleUserAdvance(direction = 1) {
    const now = performance.now();
    if (now - this.lastTransitionTime < 450) return;

    const nextStage = (this.queuedStage ?? this.destinationStage ?? this.stage) + direction;
    if (nextStage >= 1 && nextStage <= this.maxStages) {
      this.lastTransitionTime = now;
      this.goToStage(nextStage);
    }
  }

  goToStage(newStage) {
    if (!Number.isInteger(newStage) || newStage < 1 || newStage > this.maxStages) return;
    if (this.sceneTransition.active) {
      this.queuedStage = newStage;
      this.sceneTransition.delivery?.cancel();
      return;
    }
    if (newStage === this.stage) return;
    const direction = Math.sign(newStage - this.stage);
    if (this.motionQuery.matches) { this.commitStage(newStage, direction); return; }
    this.destinationStage = newStage;
    this.sceneTransition.start(direction, () => {
      if (!this.motionQuery.matches) this.liquidTransition.start(this.stage, newStage, direction);
      this.sceneTransition.prepare();
      this.commitStage(newStage, direction);
      // Layout changes happen while the pair is outside the frame.
      for (const robot of [this.wallE, this.eve]) Object.assign(robot.displayLayout, robot.layout);
    }, () => {
      this.liquidTransition.active = false;
      this.destinationStage = null;
      const queued = this.queuedStage;
      this.queuedStage = null;
      if (queued != null) this.goToStage(queued);
    });
    this.roseGift.cancel(true);
    releaseHands(this.wallE, this.eve);
    this.wallE.swimState = 'none';
    this.eve.pendingSpin = false;
    this.eve.spinTime = 0;
    this.eve.isScanning = false;
    this.eve.scanBeam.visible = false;
  }

  commitStage(newStage, direction) {
    this.stage = newStage;
    console.log(`[App] Chuyển sang Giai đoạn ${this.stage}`);

    const currentStyle = getComputedStyle(this.narrativeBox);
    const currentOpacity = currentStyle.display === 'none' ? 0 : Number(currentStyle.opacity);
    const currentTranslate = currentStyle.translate;
    this.phaseAnimation?.cancel();
    const reduced = this.motionQuery.matches;
    this.phaseAnimation = this.narrativeBox.animate(reduced
      ? [{ opacity: currentOpacity }, { opacity: 1 }]
      : [{ opacity: currentOpacity, translate: currentTranslate, easing: 'ease-in' },
        { opacity: 0, translate: `0px ${-direction*8}px`, offset: PASSAGE.swap/PASSAGE.story },
        { opacity: 0, translate: `0px ${direction*8}px`, offset: 0.28, easing: 'cubic-bezier(.22,1,.36,1)' },
        { opacity: 1, translate: '0px 0px' }],
      { duration: reduced ? PASSAGE.swap : PASSAGE.story, easing: reduced ? 'ease-out' : 'linear' });
    this.phaseAnimation.onfinish = () => {
      this.wallE.fitToViewport();
      this.eve.fitToViewport();
    };
    this.applyStage(this.stage);
  }

  applyStage(stage) {
    this.ambientTimer = 12;
    this.pairMoments.setStage(stage);
    this.roseGift.cancel(true);
    this.roseGift.wait = 8;
    this.roseRequested = false;
    this.propDiscovery.classList.add('is-new');
    document.getElementById('prop-discover-name').textContent = [
      '✧ Chạm ngôi sao', '♪ Chạm chuông gió', '🏮 Chạm lồng đèn',
      '✧ Chạm hạc giấy', '❄ Chạm cầu tuyết'
    ][stage - 1] || '';
    clearTimeout(this.dialogueTimer);
    const toast = document.getElementById('prop-toast');
    clearTimeout(toast.hideTimer);
    clearTimeout(toast.dismissTimer);
    toast.style.display = 'none';
    toast.classList.remove('visible', 'hiding');
    releaseHands(this.wallE, this.eve);
    this.wallE.swimState = 'none';
    this.wallE.swimTimer = this.wallE.joyWiggleTime = 0;
    if (this.scene3d) {
      this.scene3d.setSeason(stage);
    }
    if (this.animeSky) {
      this.animeSky.setStage(stage);
    }
    if (this.eve) {
      this.eve.setStage(stage);
      this.eve.environmentTarget = this.scene3d.seasonalProps.props[stage - 1].group;
    }

    // Cập nhật thanh tiến trình 6 mùa trực quan
    if (this.seasonStepper) {
      this.seasonStepper.querySelectorAll('.step-node').forEach((node) => {
        const s = parseInt(node.getAttribute('data-stage'), 10);
        if (s === stage) {
          node.classList.add('active');
          node.setAttribute('aria-current', 'step');
        } else {
          node.classList.remove('active');
          node.removeAttribute('aria-current');
        }
      });
    }

    // Nút bắt đầu hành trình ở Màn 1
    if (this.btnStartJourney) {
      this.btnStartJourney.style.display = (stage === 1) ? 'inline-flex' : 'none';
    }

    switch (stage) {
      case 1:
        this.setHUD("✨ Giai đoạn 1 / 6: Vũ Trụ Thức Giấc", "#bedbe8");
        this.setDialogue(
          "Cùng WALL-E và EVE bắt đầu nhé",
          CONFIG.seasons.stage1.dialogue,
          null,
          "Thử các nút và vật sáng trước khi sang mùa mới"
        );
        if (this.narrativeBox) {
          this.narrativeBox.style.display = 'flex';
          this.narrativeBox.style.opacity = '1';
        }
        this.wallE.setEmotion('idle');
        this.povGuide.hide();
        this.vinylDock.setMode('mini');
        this.finaleManager.deactivate();
        break;

      case 2:
        this.setHUD("🌸 Giai đoạn 2 / 6: Mùa Xuân Nở Hoa", "#f2c4d4");
        this.setDialogue(
          "Mùa xuân, sức sống mới",
          CONFIG.seasons.stage2.dialogue,
          CONFIG.seasons.stage2.climaxWish,
          "[ Tiếp tục cuộn chuột hoặc chạm tay để bước đi ]"
        );
        if (this.narrativeBox) {
          this.narrativeBox.style.display = 'flex';
          this.narrativeBox.style.opacity = '1';
        }
        this.wallE.setEmotion('happy');
        this.povGuide.show("Cùng mình qua mùa xuân rực rỡ nhé...");
        this.povGuide.setSeasonColor("#ffb6c1");
        this.vinylDock.setMode('mini');
        this.finaleManager.deactivate();
        break;

      case 3:
        this.setHUD("☀️ Giai đoạn 3 / 6: Mùa Hạ Rực Rỡ", "#eed6ad");
        this.setDialogue(
          "Mùa hạ, các bạn nữ cứ rực rỡ theo cách riêng",
          CONFIG.seasons.stage3.dialogue,
          CONFIG.seasons.stage3.climaxWish,
          "[ Tiếp tục bước đi giữa ánh đom đóm hạ ]"
        );
        if (this.narrativeBox) {
          this.narrativeBox.style.display = 'flex';
          this.narrativeBox.style.opacity = '1';
        }
        this.wallE.setEmotion('wink');
        this.povGuide.show("Cùng nhau bước qua mùa hạ đầy nhiệt huyết...");
        this.povGuide.setSeasonColor("#ffd700");
        this.vinylDock.setMode('mini');
        this.finaleManager.deactivate();
        break;

      case 4:
        this.setHUD("🍁 Giai đoạn 4 / 6: Mùa Thu 20/10 Dịu Êm", "#edc797");
        this.setDialogue(
          "Mùa thu 20/10, dành tặng các bạn nữ",
          CONFIG.seasons.stage4.dialogue,
          CONFIG.seasons.stage4.climaxWish,
          "[ Chạm tiếp để đến mùa đông giáng sinh ấm áp ]"
        );
        if (this.narrativeBox) {
          this.narrativeBox.style.display = 'flex';
          this.narrativeBox.style.opacity = '1';
        }
        this.wallE.setEmotion('blush');
        this.povGuide.show("Nụ cười mùa thu mãi là điều đẹp nhất...");
        this.povGuide.setSeasonColor("#ff9f43");
        this.vinylDock.setMode('mini');
        this.finaleManager.deactivate();
        break;

      case 5:
        this.setHUD("❄️ Giai đoạn 5 / 6: Mùa Đông Giáng Sinh", "#bedde9");
        this.setDialogue(
          "Mùa đông, một nơi thật ấm áp",
          CONFIG.seasons.stage5.dialogue,
          CONFIG.seasons.stage5.climaxWish,
          "[ Lắng nghe giai điệu và chuẩn bị đến khoảnh khắc kết thúc ]"
        );
        if (this.narrativeBox) {
          this.narrativeBox.style.display = 'flex';
          this.narrativeBox.style.opacity = '1';
        }
        this.wallE.setEmotion('happy');
        this.povGuide.hide();
        this.vinylDock.setMode('stage5');
        this.finaleManager.deactivate();
        break;

      case 6:
        this.povGuide.hide();
        if (this.narrativeBox) {
          this.narrativeBox.style.display = 'none';
        }
        this.vinylDock.setMode('finale');
        this.finaleManager.activate();
        break;
    }
    this.wallE.fitToViewport();
    this.eve.fitToViewport();
    this.updateStepperSelection();
  }

  updateStepperSelection() {
    const active = this.seasonStepper.querySelector('.step-node.active');
    if (!active) return;
    for (const [name, value] of Object.entries({ x: active.offsetLeft, y: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight })) {
      this.seasonStepper.style.setProperty(`--selection-${name}`, `${value}px`);
    }
  }

  setHUD(text, color) {
    if (this.stageIndicator) {
      this.stageIndicator.textContent = text;
      this.stageIndicator.style.color = color;
      this.stageIndicator.style.borderColor = `${color}55`;
    }
  }

  setDialogue(title, text, climaxWish, hint) {
    clearTimeout(this.dialogueTimer);
    const season = CONFIG.seasons[`stage${this.stage}`];
    this.dialogueTimer = setTimeout(() => {
      if (this.dialogueTitle) this.dialogueTitle.textContent = title;
      this.narrativeBox?.classList.toggle('season-wishes', Boolean(season?.wish));
      if (this.dialogueText) {
        this.dialogueText.textContent = text;
        for (const [className, value] of [['season-poem', season?.poem], ['season-wish', season?.wish]]) {
          if (!value) continue;
          const paragraph = document.createElement('p');
          paragraph.className = className;
          paragraph.textContent = value;
          this.dialogueText.append(paragraph);
        }
        this.dialogueText.classList.toggle('has-season-wish', Boolean(season?.wish));
        this.dialogueText.scrollTop = 0;
      }
      if (this.climaxWishContainer) {
        this.climaxWishContainer.replaceChildren();
        if (climaxWish) {
          const wish = document.createElement('span');
          wish.className = 'climax-wish-badge';
          wish.textContent = climaxWish;
          this.climaxWishContainer.append(wish);
        }
      }
      if (this.interactionHint && hint) this.interactionHint.textContent = season?.wish
        ? (matchMedia('(pointer: coarse)').matches
          ? '[ Vuốt trái/phải đổi cảnh • Cuộn trong bảng để đọc ]'
          : '[ Cuộn để đọc • Chọn mùa để tiếp tục ]') : hint;
      this.wallE.fitToViewport();
      if (this.eve) this.eve.fitToViewport();
    }, this.motionQuery.matches ? 0 : 180);
  }

  updateAmbientInteraction(delta) {
    if (this.touchNavigation.isActive()) return;
    if (this.sceneTransition.active) return;
    if (this.motionQuery.matches || this.stage === 6) return;
    if (this.roseGift.active) { this.ambientTimer = 6; return; }
    this.ambientTimer -= delta;
    this.roseGift.wait -= delta;
    this.pairMoments.wait -= delta;
    if (this.wallE.handHoldProgress > 0.01 || this.wallE.swimState !== 'none' || this.eve.isScanning
      || this.eve.spinTime > 0 || this.eve.pendingSpin || this.wallE.motion.spinTime >= 0 || this.eve.motion.spinTime >= 0) return;
    if (this.roseGift.wait <= 0 && this.roseGift.start()) {
      this.roseRequested = false;
      this.pairMoments.round++;
      this.pairMoments.wait = 35;
      this.ambientTimer = 6;
      return;
    }
    if (this.roseRequested || this.wallE.pointerAge < 3 || this.eve.pointerAge < 3) return;
    if (this.pairMoments.wait <= 0 && this.pairMoments.round % 2 === 0 && this.pairMoments.start()) return;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 6 + Math.random() * 3;
    if (this.ambientAction === 0) {
      holdHands(this.wallE, this.eve, 3);
    } else {
      this.eve.triggerScan(2.8, this.scene3d.seasonalProps.props[this.stage - 1].group);
      this.wallE.waveTime = 0;
      this.wallE.triggerHeartBounce(0.45);
    }
    this.ambientAction = 1 - this.ambientAction;
  }

  updateDiscovery() {
    const busy = this.sceneTransition.active;
    this.roseButton.disabled = busy || this.roseGift.active || this.roseRequested || this.motionQuery.matches;
    const label = this.motionQuery.matches ? '🌹 Đã giảm chuyển động'
      : this.roseGift.active ? '🌹 Đang tặng hoa…'
      : this.roseRequested ? '🌹 Sắp tặng hoa…' : '🌹 Tặng hoa & hôn';
    if (this.roseButton.textContent !== label) this.roseButton.textContent = label;
    this.roseButton.title = this.motionQuery.matches ? 'Cảnh tặng hoa tạm tắt theo tùy chọn giảm chuyển động của thiết bị' : 'WALL-E tặng hoa, EVE nhận hoa và hôn má';
    this.propDiscovery.hidden = busy || this.stage === 6;
    if (this.propDiscovery.hidden) return;
    const prop = this.scene3d.seasonalProps.props[this.stage - 1];
    prop.group.updateWorldMatrix(true, false);
    prop.group.localToWorld(this.discoveryPoint.set(0, -2.5, 0)).project(this.scene3d.camera);
    const halfWidth = this.propDiscovery.offsetWidth / 2;
    const area = getStageArea();
    const x = Math.max(area.left + halfWidth, Math.min(area.left + area.width - halfWidth, (this.discoveryPoint.x + 1) * innerWidth / 2));
    const lyrics = this.vinylDock.lyricContainer.getBoundingClientRect();
    const bottom = Math.min(area.top + area.height, lyrics.height ? lyrics.top - 12 : Infinity);
    const y = Math.max(area.top, Math.min((1 - this.discoveryPoint.y) * innerHeight / 2,
      bottom - this.propDiscovery.offsetHeight - 4));
    this.propDiscovery.style.left = `${x}px`;
    this.propDiscovery.style.top = `${y}px`;
  }

  startMainLoop() {
    let lastTime = performance.now();
    const loop = (currentTime) => {
      const delta = this.resetFrameClock ? 0 : Math.max(0, Math.min(0.1, (currentTime - lastTime) / 1000));
      this.resetFrameClock = false;
      lastTime = currentTime;
      if (document.hidden) { requestAnimationFrame(loop); return; }

      if (this.playbackState !== this.audioManager.isPlaying) {
        this.playbackState = this.audioManager.isPlaying;
        this.updateAudioLabel(this.playbackState);
        this.audioToggle.setAttribute('aria-pressed', String(this.playbackState));
        this.vinylDock.setSpinning(this.playbackState);
      }

      this.sceneTransition.prepare();
      this.scene3d.update(delta);
      if (this.povGuide) this.povGuide.update(this.motionQuery.matches ? 0 : delta);
      const props = this.scene3d.seasonalProps;
      const interest = props.hoveredProp?.group || (this.povGuide.butterflyGroup.visible
        ? this.povGuide.butterflyGroup : this.scene3d.meteors.find(meteor => meteor.visible) || props.props[this.stage - 1]?.group);
      this.updateAmbientInteraction(delta);
      this.roseGift.prepare(delta);
      updateHands(this.wallE, this.eve, delta, this.motionQuery.matches);
      if (this.wallE) {
        this.wallE.update(delta, this.eve.isScanning ? this.eve.scanTarget : interest);
      }
      if (this.eve) {
        this.eve.update(delta, interest);
      }
      joinRobotHands(this.wallE, this.eve, delta, this.motionQuery.matches);
      this.roseGift.apply(delta);
      this.finaleManager.update(delta);
      this.sceneTransition.apply(delta);
      this.updateDiscovery();
      this.pairMoments.button.disabled = this.sceneTransition.active || this.roseGift.active;
      if (this.vinylDock) this.vinylDock.update(this.motionQuery.matches ? 0 : delta);
      if (this.liquidTransition.active) {
        this.liquidTransition.render((this.sceneTransition.time-PASSAGE.exit)/(PASSAGE.sky/1000));
      } else this.scene3d.render();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.appInstance = new App();
});
