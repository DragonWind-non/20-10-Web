/* global THREE */
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

function flowerTexture(season) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.translate(256, 256);
  if (season === 'winter') {
    ctx.strokeStyle = '#f5fcff';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -190);
      for (const distance of [70, 125]) {
        ctx.moveTo(-42, -distance - 30); ctx.lineTo(0, -distance); ctx.lineTo(42, -distance - 30);
      }
      ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#d8f0ff';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
  } else if (season === 'autumn') {
    const points = [[0,-208],[34,-122],[92,-168],[82,-70],[182,-96],[140,-20],[205,1],[108,55],[134,98],[35,90],[0,172],[-35,90],[-134,98],[-108,55],[-205,1],[-140,-20],[-182,-96],[-82,-70],[-92,-168],[-34,-122]];
    const gradient = ctx.createLinearGradient(-150, -190, 140, 150);
    gradient.addColorStop(0, '#ffe5a4'); gradient.addColorStop(0.5, '#f4ad52'); gradient.addColorStop(1, '#cb643b');
    ctx.fillStyle = gradient;
    ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a85b32'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 210); ctx.lineTo(0, -188);
    for (const side of [-1,1]) for (const [x,y] of [[158,0],[82,-125],[113,80]]) {
      ctx.moveTo(0, 100); ctx.quadraticCurveTo(side * x * 0.35, y + 35, side * x, y);
    }
    ctx.stroke();
  } else {
    const summer = season === 'summer';
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.rotate(i * Math.PI * 2 / 5);
      const gradient = ctx.createLinearGradient(0, 20, 0, -200);
      gradient.addColorStop(0, summer ? '#ffd3a6' : '#fff1f5');
      gradient.addColorStop(0.48, summer ? '#ed725a' : '#f7bed5');
      gradient.addColorStop(1, summer ? '#b73746' : '#de86ae');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.moveTo(0, 18);
      ctx.bezierCurveTo(-110, -48, -115, -180, -38, -193);
      ctx.quadraticCurveTo(-12, -206, 0, summer ? -202 : -178);
      ctx.quadraticCurveTo(30, -213, 61, -186);
      ctx.bezierCurveTo(125, -142, 69, -35, 0, 18);
      ctx.fill();
      ctx.strokeStyle = summer ? '#fda67a' : '#f9dce8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(-14, -94, 0, -166); ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = summer ? '#ffe9ad' : '#ba678a'; ctx.lineWidth = 3;
    for (let i = 0; i < 15; i++) {
      const angle = i * 2.399, radius = 24 + i % 4 * 9;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(x,y); ctx.stroke();
      ctx.fillStyle = '#ffe9ad'; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = 4;
  return texture;
}

export class SeasonalWorld {
  constructor(scene) {
    this.count = innerWidth < 768 ? 64 : 120;
    this.currentStage = 1;
    this.time = 0;
    this.dummy = new THREE.Object3D();
    this.groups = SEASONS.map((name, index) => {
      const material = new THREE.MeshBasicMaterial({
        map: flowerTexture(name), color: 0xffffff, toneMapped: false,
        side: THREE.DoubleSide, transparent: true, opacity: 0,
        alphaTest: 0.035, depthWrite: false
      });
      const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, this.count);
      mesh.name = `${name}-falling-forms`;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const particles = Array.from({ length: this.count }, (_, i) => ({
        x: (Math.random() - 0.5) * 44,
        y: (Math.random() - 0.5) * 32,
        z: -15 + Math.random() * 28,
        size: (i % 9 === 0 ? 0.75 : 0.18 + Math.random() * 0.38) * (index === 3 ? 0.65 : 1),
        speed: 0.45 + Math.random() * 0.65,
        angle: Math.random() * Math.PI * 2,
        turn: (Math.random() - 0.5) * 0.85,
        phase: Math.random() * Math.PI * 2
      }));
      scene.add(mesh);
      return { name, mesh, material, particles, opacity: 0 };
    });
  }

  setStage(stage) { this.currentStage = stage; }

  update(delta, reduced) {
    if (!reduced) this.time += delta;
    for (let season = 0; season < this.groups.length; season++) {
      const group = this.groups[season];
      const target = this.currentStage === season + 2 ? 1 : 0;
      group.opacity += (target - group.opacity) * (1 - Math.exp(-delta * (reduced ? 24 : 3.4)));
      group.material.opacity = group.opacity * 0.92;
      group.mesh.visible = group.opacity > 0.005;
      if (!group.mesh.visible) continue;
      group.particles.forEach((particle, i) => {
        if (!reduced) {
          particle.y -= particle.speed * delta;
          particle.x += (Math.sin(this.time * 0.38 + particle.phase) * 0.35 + 0.12) * delta;
          particle.angle += particle.turn * delta;
          if (particle.y < -17) particle.y = 18;
          if (particle.x > 23) particle.x = -23;
        }
        this.dummy.position.set(particle.x, particle.y, particle.z);
        this.dummy.rotation.set(reduced ? 0 : Math.sin(this.time * 0.45 + particle.phase) * 0.7,
          reduced ? 0 : Math.cos(this.time * 0.4 + particle.phase) * 0.65, particle.angle);
        this.dummy.scale.setScalar(particle.size);
        this.dummy.updateMatrix();
        group.mesh.setMatrixAt(i, this.dummy.matrix);
      });
      group.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
