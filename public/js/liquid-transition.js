/* global THREE */
// Reuse the renderer so refraction adds no second WebGL context.
export class LiquidTransition {
  constructor(scene3d, layers) {
    this.scene3d = scene3d;
    this.layers = layers;
    this.active = false;
    this.from = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
    this.to = this.from.clone();
    this.from.texture.encoding = this.to.texture.encoding = THREE.sRGBEncoding;
    this.textures = layers.map(layer => {
      const image = layer.querySelector('img');
      const texture = new THREE.Texture(image);
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      if (image.complete && image.naturalWidth) texture.needsUpdate = true;
      image.addEventListener('load', () => { texture.needsUpdate = true; });
      return texture;
    });
    this.uniforms = {
      fromScene: { value: this.from.texture }, toScene: { value: this.to.texture },
      fromSky: { value: this.textures[0] }, toSky: { value: this.textures[0] },
      fromFit: { value: new THREE.Vector4() }, toFit: { value: new THREE.Vector4() },
      viewport: { value: new THREE.Vector2() }, progress: { value: 0 }, direction: { value: 1 }
    };
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D fromScene, toScene, fromSky, toSky;
        uniform vec4 fromFit, toFit;
        uniform vec2 viewport;
        uniform float progress, direction;
        vec3 composite(sampler2D image, sampler2D scene, vec4 fit, vec2 uv) {
          uv = clamp(uv, .001, .999);
          vec3 sky = texture2D(image, (uv-.5)*fit.xy+fit.zw).rgb;
          // shortcut: sky gradients mirror anime-sky.css; update them when backdrop styling changes.
          vec2 layerUv = (uv*viewport+32.)/(viewport+64.);
          float vignette = smoothstep(.35, 1., length((layerUv-vec2(.5,.52))/vec2(.707,.735)))*.18;
          sky = mix(sky, vec3(5.,13.,28.)/255., vignette);
          float shade = layerUv.y>.55 ? (layerUv.y-.55)/.45*.25 : (.55-layerUv.y)/.55*.08;
          sky = mix(sky, (layerUv.y>.55 ? vec3(8.,18.,36.) : vec3(7.,17.,33.))/255., shade);
          vec4 layer = texture2D(scene, uv);
          return layer.rgb + sky*(1.-layer.a);
        }
        void main() {
          float aspect = viewport.x/viewport.y;
          vec2 origin = vec2(direction > 0. ? .84 : .16, .52);
          vec2 p = (vUv-origin)*vec2(aspect, 1.);
          float distance = length(p);
          vec2 normal = p/max(distance, .0001);
          float t = smoothstep(0., 1., progress);
          float radius = mix(-.18, length(vec2(aspect*.84, .52))+.2, t);
          float rim = exp(-pow((distance-radius)/.065, 2.));
          float energy = sin(progress*3.14159265);
          vec2 bend = normal/vec2(aspect, 1.)*rim*.034*energy;
          float reveal = 1.-smoothstep(radius-.024, radius+.024, distance);
          vec3 before = composite(fromSky, fromScene, fromFit, vUv+bend);
          vec3 after = composite(toSky, toScene, toFit, vUv-bend*.72);
          vec3 color = mix(before, after, reveal);
          float light = pow(max(0., dot(normal, normalize(vec2(-.5, .8)))), 5.);
          color *= 1.-rim*.075*energy;
          color += rim*energy*(vec3(.055, .075, .09)+light*.24);
          gl_FragColor = vec4(color, 1.);
        }`
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  fit(stage, target) {
    const image = this.layers[stage-1].querySelector('img');
    const rect = image.getBoundingClientRect();
    const position = getComputedStyle(image).objectPosition.split(' ').map(parseFloat);
    const aspect = rect.width/rect.height;
    const ratio = (image.naturalWidth || 1)/(image.naturalHeight || 1);
    const x = Math.min(1, aspect/ratio), y = Math.min(1, ratio/aspect);
    target.set(x*innerWidth/rect.width, y*innerHeight/rect.height,
      .5+(position[0]/100-.5)*(1-x)+((innerWidth/2-rect.left)/rect.width-.5)*x,
      .5+(.5-position[1]/100)*(1-y)+((rect.bottom-innerHeight/2)/rect.height-.5)*y);
  }

  start(fromStage, toStage, direction) {
    const { renderer, scene, camera } = this.scene3d;
    const scale = Math.min(devicePixelRatio, 1.5);
    for (const target of [this.from, this.to]) target.setSize(Math.round(innerWidth*scale), Math.round(innerHeight*scale));
    renderer.setRenderTarget(this.from);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    this.fromStage = fromStage;
    this.toStage = toStage;
    this.uniforms.fromSky.value = this.textures[fromStage-1];
    this.uniforms.toSky.value = this.textures[toStage-1];
    this.uniforms.direction.value = direction;
    this.active = true;
  }

  render(progress) {
    const { renderer, scene, camera } = this.scene3d;
    this.uniforms.progress.value = Math.max(0, Math.min(1, progress));
    this.uniforms.viewport.value.set(innerWidth, innerHeight);
    this.fit(this.fromStage, this.uniforms.fromFit.value);
    this.fit(this.toStage, this.uniforms.toFit.value);
    renderer.setRenderTarget(this.to);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
    if (progress >= 1) this.active = false;
  }
}
