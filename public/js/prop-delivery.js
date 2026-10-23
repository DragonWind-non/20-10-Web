/* global THREE */
import { CONFIG } from '../config.js';
import { releaseHands } from './robot-interaction.js';

const ease = (start, end, time) => {
  const t = Math.max(0, Math.min(1, (time-start)/(end-start)));
  return t*t*t*(t*(t*6-15)+10);
};
export function sampleDelivery(time) {
  return { weight: ease(0,.7,time), travel: ease(.55,2.6,time), reach: ease(2.35,3.25,time),
    lift: ease(3.25,3.8,time), approach: ease(3.8,6.2,time), offer: ease(5.7,6.8,time) };
}

export class PropDelivery {
  constructor(app) {
    this.app = app;
    this.transition = app.sceneTransition;
    this.camera = app.scene3d.camera;
    this.robots = [app.wallE,app.eve];
    this.active = false;
    this.dialog = document.getElementById('prop-letter');
    this.dialog.querySelectorAll('button').forEach(button => button.addEventListener('click', () => this.cancel()));
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.cancel(); });
    this.dialog.addEventListener('click', event => {
      const r = this.dialog.getBoundingClientRect();
      if (event.target === this.dialog && (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom)) this.cancel();
    });
    for (const name of ['point','target','contact','hand','up','forward','ray']) this[name] = new THREE.Vector3();
    this.rotation = new THREE.Quaternion();
    this.euler = new THREE.Euler();
    this.gift = new THREE.Group();
    this.gift.name = 'delivered-keepsake';
    this.flower = app.roseGift.rose.clone(true);
    this.flower.visible = true;
    // The ambient rose fades its own materials independently of this keepsake.
    const copies = new Map();
    this.flower.traverse(mesh => {
      if (!mesh.material) return;
      if (!copies.has(mesh.material)) copies.set(mesh.material,mesh.material.clone());
      mesh.material = copies.get(mesh.material);
    });
    this.envelope = this.makeEnvelope();
    this.gift.add(this.flower,this.envelope);
    const sparkleMaterial = new THREE.MeshBasicMaterial({ color:0xffe6bd, transparent:true, opacity:.5, depthWrite:false });
    const sparkleGeometry = new THREE.IcosahedronGeometry(.025,0);
    this.sparkles = Array.from({length:18},()=>{
      const mesh = new THREE.Mesh(sparkleGeometry,sparkleMaterial);
      this.gift.add(mesh); return mesh;
    });
    const materials = new Set();
    this.gift.traverse(mesh=>{if(mesh.material){mesh.material.transparent=true;materials.add(mesh.material);}});
    this.materials=[...materials].map(material=>({material,opacity:material.opacity}));
    this.gift.visible = false;
    app.scene3d.scene.add(this.gift);
  }

  makeEnvelope() {
    const envelope = new THREE.Group();
    const paper = new THREE.MeshStandardMaterial({color:0xf9e8d5,roughness:.8,side:THREE.DoubleSide});
    const lining = new THREE.MeshStandardMaterial({color:0xd7a6b0,roughness:.65,side:THREE.DoubleSide});
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.55,1.05,.07),paper);
    body.position.y = .56;
    envelope.add(body);
    const shape = new THREE.Shape();
    shape.moveTo(-.77,0); shape.lineTo(.77,0); shape.lineTo(0,-.62); shape.closePath();
    this.flap = new THREE.Group();
    this.flap.position.set(0,1.08,.05);
    this.flap.add(new THREE.Mesh(new THREE.ShapeGeometry(shape),lining));
    envelope.add(this.flap);
    const canvas = document.createElement('canvas');
    canvas.width=512;canvas.height=384;
    const context=canvas.getContext('2d');
    context.fillStyle='#fff8ec';context.fillRect(0,0,512,384);
    context.textAlign='center';context.fillStyle='#996579';
    context.font='42px Georgia';context.fillText('20 / 10',256,108);
    context.font='italic 34px Georgia';context.fillText('Gửi các bạn nữ',256,190);
    context.fillStyle='#d2afb3';
    for(let y=250;y<340;y+=22)context.fillRect(90,y,332,2);
    const texture = new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
    this.note = new THREE.Mesh(new THREE.PlaneGeometry(1.3,.98),new THREE.MeshStandardMaterial({map:texture,side:THREE.DoubleSide,roughness:.9}));
    this.note.position.set(0,.6,.055);
    envelope.add(this.note);
    return envelope;
  }

  start(prop) {
    if (this.active || this.transition.active || !CONFIG.gifts[prop.stage]) return false;
    this.active = true;
    this.prop = prop;
    this.time = 0;
    this.returning = this.reacted = this.revealed = false;
    this.ownerIndex = prop.stage===2 || prop.stage===5 ? 1 : 0;
    this.together = prop.stage===3 || prop.stage===5;
    this.flower.visible = prop.stage===2 || prop.stage===5;
    this.envelope.visible = !this.flower.visible;
    this.emotions = this.robots.map(robot=>robot.emotion);
    if (this.app.eve.isScanning) this.emotions[1]=['normal','happy','wink','heart','happy'][prop.stage-1];
    this.previousFocus = document.activeElement;
    this.transition.delivery = this;
    this.transition.start(0,null,()=>this.finish());
    this.origins = this.transition.from.filter(state=>this.robots.some(robot=>robot.group===state.node));
    this.point.copy(prop.group.position).project(this.camera);
    this.side = this.origins[this.ownerIndex].screen.x < this.point.x ? -1 : 1;
    this.armIndex = this.side<0 ? 1 : 0;
    this.app.roseGift.cancel(true);
    releaseHands(...this.robots);
    this.app.wallE.swimState='none';
    this.app.eve.pendingSpin=false;this.app.eve.spinTime=0;
    this.app.eve.isScanning=false;this.app.eve.scanBeam.visible=false;this.app.eve.reactionTime=0;
    this.app.wallE.setEmotion('happy');this.app.eve.setEmotion('heart');
    const toast=this.app.scene3d.seasonalProps.toastEl;
    clearTimeout(toast.hideTimer);clearTimeout(toast.dismissTimer);toast.style.display='none';
    document.body.classList.add('is-delivering');
    document.body.style.cursor='default';
    if (this.app.motionQuery.matches) this.reduceMotion();
    return true;
  }

  reduceMotion() {
    this.letterAnimation?.cancel();
    if (this.returning) this.transition.finish();
    else this.time=6.8;
  }

  showLetter() {
    if (this.revealed) return;
    this.revealed=true;
    const gift=CONFIG.gifts[this.prop.stage];
    // Preserve the original seasonal passage in the central card only.
    const wish=CONFIG.seasons[`stage${this.prop.stage}`]?.wish?.replace(/\b(anh|em)\b/gi,
      word=>word.toLowerCase()==='em' ? 'các bạn nữ' : word==='Anh' ? 'Mình' : 'mình');
    this.dialog.querySelector('h2').textContent=gift.title;
    const paragraphs=[`Gửi ${CONFIG.recipientName},`,gift.opening,wish,...CONFIG.giftWishes,gift.ending].filter(Boolean);
    const body=this.dialog.querySelector('.letter-body');
    body.replaceChildren(...paragraphs.map(text=>{
      const p=document.createElement('p');p.textContent=text;return p;
    }));
    this.dialog.showModal();
    body.scrollTop=0;
    this.dialog.querySelector('h2').focus({preventScroll:true});
    if (!this.app.motionQuery.matches) this.letterAnimation=this.dialog.animate([
      {opacity:0,transform:'perspective(1000px) translate3d(-20px,12px,0) rotateY(-12deg) scale(.94)'},
      {opacity:1,transform:'perspective(1000px) translate3d(0,0,0) rotateY(0) scale(1)'}
    ],{duration:900,easing:'cubic-bezier(.16,1,.3,1)'});
  }

  cancel(immediate = false) {
    if (!this.active) return;
    if (immediate || this.app.motionQuery.matches) { this.transition.finish(); return; }
    if (this.returning) return;
    this.returning=true;this.returnTime=0;
    if (this.dialog.open) {
      this.letterAnimation?.cancel();
      this.letterAnimation=this.dialog.animate([{opacity:1},{opacity:0,transform:'translateY(8px) scale(.98)'}],{duration:180,easing:'ease-in'});
      this.letterAnimation.onfinish=()=>{if(this.returning && this.dialog.open)this.dialog.close();};
    }
    this.transition.capture();
    this.transition.prepare();
    this.transition.cancelled=true;
    document.body.classList.remove('is-gift-close');
  }

  finish() {
    this.active=false;this.gift.visible=false;
    this.letterAnimation?.cancel();
    if (this.dialog.open) this.dialog.close();
    document.body.classList.remove('is-delivering','is-gift-close');
    this.robots.forEach((robot,index)=>robot.setEmotion(this.emotions[index]));
    this.app.ambientTimer=8;this.app.roseGift.wait=30;
    const focus = this.previousFocus;
    requestAnimationFrame(() => { if (focus?.isConnected) focus.focus({preventScroll:true}); });
    const queued=this.app.queuedStage;
    this.app.queuedStage=null;
    if (queued!=null) this.app.goToStage(queued);
  }

  place(x,y,depth,target) {
    this.ray.set(x/innerWidth*2-1,1-y/innerHeight*2,.5).unproject(this.camera).sub(this.camera.position).normalize();
    return target.copy(this.camera.position).addScaledVector(this.ray,depth/this.ray.dot(this.forward));
  }

  apply(delta) {
    const t=this.transition, reduced=this.app.motionQuery.matches;
    if (this.returning) {
      this.returnTime+=delta;
      const weight=1-ease(0,1.6,this.returnTime);
      t.blendFromOrigin(weight);
      this.updateGift(weight,reduced);
      if (this.returnTime>=1.6) t.finish();
      return;
    }
    this.time=reduced ? 6.8 : this.time+delta;
    t.time=this.time;
    const c=this.cue=sampleDelivery(this.time);
    t.blendFromOrigin(1-c.weight);
    this.up.set(0,1,0).applyQuaternion(this.camera.quaternion);
    this.forward.set(0,0,-1).applyQuaternion(this.camera.quaternion);
    const prop=this.prop;
    prop.group.updateWorldMatrix(true,true);
    if (prop.stage===2) prop.ribbon.localToWorld(this.contact.set(0,0,.06));
    else prop.group.localToWorld(this.contact.set(0,.35,prop.stage===4 ? .35 : 1.2));
    const projected=this.point.copy(this.contact).project(this.camera);
    const px=(projected.x+1)*innerWidth/2,py=(1-projected.y)*innerHeight/2;
    const propDepth=this.target.copy(this.contact).sub(this.camera.position).dot(this.forward);
    const portrait=innerWidth<=700 && innerHeight>innerWidth;
    const room=portrait ? Math.max(80,innerHeight*.52-180) : Math.min(innerHeight*.55,innerWidth*.28);
    for(const [index,robot] of this.robots.entries()) {
      const owner=index===this.ownerIndex;
      const participate=owner || this.together;
      if (!participate) {
        const origin=this.origins[index];
        this.place(innerWidth*.13,portrait ? 120+Math.min(120,innerHeight*.14) : innerHeight*.65,origin.depth*1.3,this.target);
        robot.group.position.lerp(this.target,c.approach);
        this.rotation.setFromEuler(this.euler.set(0,-this.side*.24,0)).premultiply(this.camera.quaternion);
        t.mixRotation(robot.group,this.rotation,c.weight*.6);
        continue;
      }
      const origin=this.origins[index], pixels=robot.displayLayout.pixels;
      const go=owner ? c.travel : ease(.8,2.95,this.time);
      const approach=owner ? c.approach : ease(4.05,6.45,this.time);
      const ownerPixels=this.robots[this.ownerIndex].displayLayout.pixels;
      const ownerX=px+this.side*ownerPixels*.62;
      const farX=THREE.MathUtils.clamp(owner ? ownerX : ownerX+(index-this.ownerIndex)*(ownerPixels+pixels)*.65,
        pixels*.3+12,innerWidth-pixels*.3-12);
      const farY=py+pixels*.3-(owner ? 0 : pixels*.18);
      const sx=(origin.screen.x+1)*innerWidth/2,sy=(1-origin.screen.y)*innerHeight/2;
      const closePixels=portrait ? Math.min(room*.9,innerWidth*(this.together ? .38 : .62),230)
        : Math.min(room,this.together ? innerWidth*.19 : 400);
      const closeDepth=origin.scale.x*robot.layout.height*innerHeight
        /(2*Math.tan(this.camera.fov*Math.PI/360)*closePixels);
      const closeX=portrait ? innerWidth*(this.together ? (index ? .7 : .3) : .5)
        : innerWidth*(this.together ? (index ? .39 : .19) : .34);
      const closeY=portrait ? 100+room*.88
        : Math.max(innerHeight*.35+closePixels*.45,76+closePixels*.9);
      const x=(sx+(farX-sx)*go)*(1-approach)+closeX*approach;
      const y=(sy+(farY-sy)*go-Math.sin(go*Math.PI)*pixels*.18)*(1-approach)+closeY*approach;
      const depth=(origin.depth+(propDepth-origin.depth)*go)*(1-approach)+closeDepth*approach;
      this.place(x,y,depth,this.target);
      if (!reduced) this.target.addScaledVector(this.up,Math.sin(this.time*1.7+index)*.025*c.weight);
      robot.group.position.lerp(this.target,c.weight);
      robot.group.scale.lerp(origin.scale,c.weight);
      const facingSide=Math.sign(farX-px);
      const heading=-facingSide*.62*go*(1-approach)+(owner ? -.08 : .2)*approach;
      this.rotation.setFromEuler(this.euler.set(-.05*Math.sin(go*Math.PI),heading,this.side*.06*Math.sin(go*Math.PI))).premultiply(this.camera.quaternion);
      t.mixRotation(robot.group,this.rotation,c.weight);
      this.rotation.identity();t.mixRotation(robot.floatPivot,this.rotation,c.weight);
      this.rotation.setFromEuler(this.euler.set(reduced ? 0 : Math.sin(this.time*1.6)*.012*approach,0,0));
      t.mixRotation(robot.body,this.rotation,c.weight);
      this.rotation.setFromEuler(this.euler.set(.18*c.reach*(1-approach),-facingSide*.18*(1-approach),
        (owner ? -.035 : .045)+(reduced ? 0 : Math.sin(this.time*.85)*.025*approach)));
      t.mixRotation(robot.head,this.rotation,c.weight);
      for(const [armIndex,arm] of robot.arms.entries()) {
        const sway=reduced ? 0 : Math.sin(this.time*2.5+index)*(.1*Math.sin(go*Math.PI)+.025*c.offer);
        this.rotation.setFromEuler(this.euler.set(-.12-sway,0,(armIndex ? 1 : -1)*.12));
        t.mixRotation(arm,this.rotation,c.weight);
        arm.scale.lerp(this.point.set(1,1,1),c.weight);
      }
      if (owner) {
        robot.group.updateWorldMatrix(true,true);
        // Carry the same physical grip from the prop to the offered keepsake.
        this.target.set((this.armIndex ? 1.05 : -1.05),this.flower.visible ? 1.1 : .7,1.05+c.offer*.65);
        robot.group.localToWorld(this.target);
        this.target.lerp(this.contact,(1-c.lift)*c.reach);
        t.aimHand(robot.arms[this.armIndex],robot.handTip,this.target,c.reach);
        robot.group.updateWorldMatrix(true,true);
        robot.arms[this.armIndex].localToWorld(this.hand.copy(robot.handTip));
        const touch=c.reach*(1-c.lift);
        robot.group.position.addScaledVector(this.point.copy(this.contact).sub(this.hand),touch);
      }
    }
    if (this.time>=3.3 && !this.reacted) {
      this.reacted=true;this.app.scene3d.seasonalProps.reactProp(prop,false);
      this.app.wallE.triggerHeartBounce(.5);
      this.app.eve.setEmotion('heart');
    }
    if (c.approach>.2) document.body.classList.add('is-gift-close');
    this.updateGift(c.lift,reduced);
    if (this.time>=6.8) this.showLetter();
  }

  updateGift(weight,reduced) {
    const owner=this.robots[this.ownerIndex];
    owner.group.updateWorldMatrix(true,true);
    owner.arms[this.armIndex].localToWorld(this.gift.position.copy(owner.handTip));
    this.gift.quaternion.copy(owner.group.quaternion);
    this.gift.rotateX(-.12);this.gift.rotateZ(this.side*.12);
    this.gift.scale.setScalar(owner.group.scale.x*(this.flower.visible ? 1.1 : .7));
    this.gift.visible=weight>.001;
    for(const {material,opacity} of this.materials)material.opacity=opacity*weight;
    const offer=this.cue?.offer || 0;
    this.flap.rotation.x=offer*2.5;
    this.note.position.y=.6+offer*.65;
    this.sparkles.forEach((mesh,index)=>{
      const phase=index*2.4+(reduced ? 0 : this.time*.4);
      mesh.visible=!reduced;
      mesh.position.set(Math.sin(phase)*(.6+index%3*.12),.5+Math.cos(phase*.7)*.65,Math.cos(phase)*.3);
    });
  }
}
