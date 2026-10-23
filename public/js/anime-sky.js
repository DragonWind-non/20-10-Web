// js/anime-sky.js - Điều khiển Bầu Trời Anime Makoto Shinkai theo 6 Giai Đoạn
import { PASSAGE } from './scene-transition.js';

export class AnimeSky {
  constructor() {
    this.container = document.getElementById('anime-sky-container');
    this.layers = [];
    this.currentStage = 0;
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.motionQuery.addEventListener('change', () => {
      if (!this.motionQuery.matches) return;
      this.layers.forEach(layer => {
        layer.passageAnimation?.cancel();
        layer.classList.remove('departing');
      });
      this.glowAnimation?.cancel();
    });

    this.init();
  }

  init() {
    if (!this.container) return;
    this.layers = Array.from(this.container.querySelectorAll('.sky-layer'));
    ['cosmos', 'spring', 'summer', 'autumn', 'winter', 'finale'].forEach((season, index) => {
      const image = document.createElement('img');
      image.className = 'scene-backdrop';
      image.alt = '';
      image.decoding = 'async';
      image.fetchPriority = index === 0 ? 'high' : 'low';
      image.src = `assets/backgrounds/${index === 5 ? 'cosmos' : season}.jpg`;
      this.layers[index].prepend(image);
    });
    this.glow = document.createElement('div');
    this.glow.className = 'scene-passage-glow';
    this.container.appendChild(this.glow);
    this.setStage(1);
  }

  setStage(stageIndex) {
    if (stageIndex === this.currentStage) return;
    const initial = !this.currentStage, direction = Math.sign(stageIndex-this.currentStage);
    const reduced = this.motionQuery.matches;
    const states = this.layers.map(layer => {
      const style = getComputedStyle(layer);
      return { opacity: Number(style.opacity), transform: style.transform };
    });
    this.currentStage = stageIndex;
    document.body.dataset.stage = stageIndex;
    const targetClass = `sky-stage-${stageIndex}`;
    const targetIndex = stageIndex-1;
    const coveredBelow = states.slice(0, targetIndex).some(state => state.opacity > 0.9999);

    this.layers.forEach((layer, index) => {
      const incoming = layer.classList.contains(targetClass), state = states[index];
      layer.passageAnimation?.cancel();
      layer.classList.toggle('active', incoming);
      layer.classList.toggle('departing', !incoming && state.opacity > 0 && !initial);
      if (initial || (!incoming && state.opacity === 0)) return;
      const from = state.opacity > 0 ? state.transform : `translate3d(${direction*24}px,0,0) scale(1.025)`;
      const to = incoming ? 'translate3d(0,0,0) scale(1)' : `translate3d(${-direction*18}px,0,0) scale(1.015)`;
      // Fade only layers above a solid base, in either direction and on retarget.
      const fromOpacity = incoming && !coveredBelow ? 1 : state.opacity;
      const toOpacity = incoming ? 1 : index < targetIndex ? state.opacity : 0;
      const animation = layer.animate(reduced
        ? [{ opacity: fromOpacity }, { opacity: toOpacity }]
        : [{ opacity: fromOpacity, transform: from }, { opacity: toOpacity, transform: to }],
      { duration: reduced ? PASSAGE.swap : PASSAGE.sky, easing: 'cubic-bezier(.45,0,.25,1)' });
      layer.passageAnimation = animation;
      animation.onfinish = () => {
        if (layer.passageAnimation === animation) layer.classList.remove('departing');
      };
    });
    if (!initial && !reduced) {
      const opacity = Number(getComputedStyle(this.glow).opacity);
      this.glowAnimation?.cancel();
      this.glowAnimation = this.glow.animate([{ opacity, transform: 'scale(1)' },
        { opacity: 0.6, transform: 'scale(1.04)', offset: 0.38 },
        { opacity: 0, transform: 'scale(1.1)' }], { duration: PASSAGE.sky, easing: 'ease-in-out' });
    }

    console.log(`[AnimeSky] Kích hoạt bầu trời giai đoạn ${stageIndex} (${targetClass})`);
  }

  setPointer(x, y) {
    this.container.style.setProperty('--sky-x', `${x * 9}px`);
    this.container.style.setProperty('--sky-y', `${y * 5}px`);
  }
}
