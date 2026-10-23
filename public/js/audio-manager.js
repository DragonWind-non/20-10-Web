// js/audio-manager.js - Quản lý phát nhạc, đồng bộ lyric và phân tích nhịp đập (Đã vá lỗi Code Review)
import { CONFIG } from '../config.js';

export class AudioManager {
  constructor() {
    this.playlist = CONFIG.playlist || [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.audioContext = null;
    this.analyser = null;
    this.audioElement = new Audio();
    this.sourceNode = null;
    this.frequencyData = null;

    // Listeners
    this.lyricListeners = [];
    this.beatListeners = [];
    this.trackChangeListeners = [];

    // State tracking
    this.currentLyricIndex = -1;
    this.lastBeatTime = 0;

    this.playRequest = 0;

    this.setupAudioElement();
  }

  setupAudioElement() {
    this.audioElement.crossOrigin = "anonymous";
    this.audioElement.preload = "auto";

    this.audioElement.addEventListener('ended', () => {
      this.next();
    });

    this.audioElement.addEventListener('error', () => {
      this.failPlayback(this.audioElement.error);
    });
  }

  // Khởi động Web Audio API đồng bộ ngay trong event tick của người dùng (Vá lỗi Issue 2 cho iOS Safari)
  initSync() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }

        try {
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 256;
          this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

          if (!this.sourceNode && this.audioElement) {
            this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
            this.sourceNode.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
          }
        } catch (e) {
          console.warn('[AudioManager] Kết nối MediaElementSource không khả dụng, phát trực tiếp:', e);
        }
      }
    } else if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.startAnimationLoop();
  }

  async init() {
    this.initSync();
  }

  play(index = this.currentIndex) {
    if (this.playlist.length === 0) return;

    this.currentIndex = (index + this.playlist.length) % this.playlist.length;
    const currentTrack = this.playlist[this.currentIndex];
    this.currentLyricIndex = -1;
    this.notifyTrackChange(currentTrack);
    this.audioElement.src = currentTrack.src;
    this.resume();
  }

  resume() {
    const request = ++this.playRequest;
    this.isPlaying = true;
    Promise.resolve(this.audioElement.play()).catch(error => {
      // A paused or replaced track can reject after a newer request has started.
      if (request === this.playRequest) this.failPlayback(error);
    });
  }

  failPlayback(error) {
    this.pause();
    console.warn('[AudioManager] Không thể phát bài đã chọn:', error);
  }

  pause() {
    this.playRequest++;
    this.isPlaying = false;
    this.audioElement.pause();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else if (this.audioElement.src) {
      this.resume();
    } else {
      this.play(this.currentIndex);
    }
    return this.isPlaying;
  }

  next() {
    this.play(this.currentIndex + 1);
  }

  prev() {
    this.play(this.currentIndex - 1);
  }

  getCurrentTime() {
    return this.audioElement.currentTime || 0;
  }

  getCurrentTrack() {
    return this.playlist[this.currentIndex] || null;
  }

  onLyricChange(callback) {
    this.lyricListeners.push(callback);
  }

  onBeat(callback) {
    this.beatListeners.push(callback);
  }

  onTrackChange(callback) {
    this.trackChangeListeners.push(callback);
  }

  notifyTrackChange(track) {
    this.trackChangeListeners.forEach(cb => cb(track, this.currentIndex));
  }

  startAnimationLoop() {
    if (this.animationStarted) return;
    this.animationStarted = true;
    const updateLoop = () => {
      if (this.isPlaying) {
        const time = this.getCurrentTime();
        this.checkLyrics(time);
        this.checkBeats();
      }
      requestAnimationFrame(updateLoop);
    };
    requestAnimationFrame(updateLoop);
  }

  checkLyrics(currentTime) {
    const track = this.getCurrentTrack();
    if (!track || !track.lyrics || track.lyrics.length === 0) return;

    let activeIdx = -1;
    for (let i = 0; i < track.lyrics.length; i++) {
      if (currentTime >= track.lyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== this.currentLyricIndex) {
      this.currentLyricIndex = activeIdx;
      const activeLine = activeIdx >= 0 ? track.lyrics[activeIdx] : null;
      const nextLine = activeIdx + 1 < track.lyrics.length ? track.lyrics[activeIdx + 1] : null;
      const prevLine = activeIdx > 0 ? track.lyrics[activeIdx - 1] : null;

      this.lyricListeners.forEach(cb => cb({
        activeLine,
        nextLine,
        prevLine,
        index: activeIdx
      }));

      // Khi câu hát thay đổi, tự động kích hoạt một nhịp nảy trái tim
      this.dispatchBeat(1.0);
    }
  }

  checkBeats() {
    if (this.analyser && this.frequencyData) {
      this.analyser.getByteFrequencyData(this.frequencyData);

      let bassSum = 0;
      const bassBinCount = 6;
      for (let i = 0; i < bassBinCount; i++) {
        bassSum += this.frequencyData[i];
      }
      const bassAvg = bassSum / bassBinCount;

      const now = performance.now();
      if (bassAvg > 165 && (now - this.lastBeatTime) > 320) {
        this.lastBeatTime = now;
        const intensity = Math.min(1.0, (bassAvg - 165) / 70 + 0.3);
        this.dispatchBeat(intensity);
      }
    }
  }

  dispatchBeat(intensity) {
    this.beatListeners.forEach(cb => cb(intensity));
  }
}
