"""Exercise real Three.js contact, story controls, interruption and responsive framing."""
import argparse
import json
import math
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--viewport', choices=['desktop', 'mobile', 'tiny', 'landscape'])
parser.add_argument('--output', default=str(Path(tempfile.gettempdir())/'20-10-couple-story'))
args = parser.parse_args()
out = Path(args.output); out.mkdir(parents=True, exist_ok=True)
SCHEDULER = '''(() => {
 let callbacks=[],time;
 window.requestAnimationFrame=f=>(callbacks.push(f),callbacks.length);
 window.advance=n=>{for(let i=0;i<n;i++){
   time=(time??performance.now())+1000/30; const fs=callbacks; callbacks=[]; fs.forEach(f=>f(time));
   if(window.recordCouple){const a=appInstance,c=a.scene3d.camera;
     window.coupleFrames.push([a.wallE,a.eve].map(r=>{
       const p=r.group.position.clone().project(c);
       return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,
         wrists:r.arms.map(arm=>arm.getWorldQuaternion(new THREE.Quaternion()).toArray())};
     }));}
 }};
})()'''
PROBE = '''()=>{
 const a=appInstance,c=a.scene3d.camera;
 const screen=p=>{p.project(c);return [(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2];};
 const bounds=root=>{
   root.updateWorldMatrix(true,true);const box={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
   root.traverseVisible(mesh=>{
     if(!mesh.geometry || mesh.name==='hit-proxy' || mesh.material?.visible===false)return;
     if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
     const {min,max}=mesh.geometry.boundingBox;
     for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
       const p=screen(new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld));
       box.left=Math.min(box.left,p[0]);box.right=Math.max(box.right,p[0]);
       box.top=Math.min(box.top,p[1]);box.bottom=Math.max(box.bottom,p[1]);
     }
   });return box;
 };
 const w=a.wallE,e=a.eve,m=a.pairMoments;
 const hand=(r,i)=>r.arms[i].localToWorld(r.handTip.clone());
 return {robots:[bounds(w.model),bounds(e.model)], stage:a.stage,
   positions:[screen(w.group.position.clone()),screen(e.group.position.clone())],
   starGap:m.item.position.distanceTo(hand(w,1)),
   joinedGap:hand(w,1).distanceTo(hand(e,0)),
   petalGap:m.item.position.distanceTo(e.head.localToWorld(new THREE.Vector3(-.65,.35,.5))),
   flower:a.finaleManager.bloom.flower.visible, phase:a.finaleManager.bloom.phase,
   bloomBounds:a.finaleManager.bloom.flower.visible?bounds(a.finaleManager.bloom.flower):null};
}'''

results = []
with sync_playwright() as p:
 browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-webgl', '--enable-unsafe-swiftshader'])
 for name,width,height in [('desktop',1440,900),('mobile',390,844),('tiny',320,568),('landscape',844,390)]:
  if args.viewport and args.viewport != name: continue
  page = browser.new_page(viewport={'width':width,'height':height},has_touch=True)
  page.set_default_timeout(15000)
  errors=[]; page.on('pageerror', lambda error: errors.append(str(error)))
  page.on('console',lambda m: errors.append(m.text) if m.type=='error' and 'THREE.WebGL' in m.text else None)
  page.add_init_script(SCHEDULER)
  page.goto('http://127.0.0.1:3000/',wait_until='networkidle')
  page.wait_for_function('() => (window.appInstance?.pairMoments)')
  page.evaluate('advance(1)')
  for stage,kind in [(1,'star'),(2,'petal'),(4,'crane')]:
   page.emulate_media(reduced_motion='reduce')
   page.wait_for_function('() => (appInstance.motionQuery.matches)')
   page.evaluate('(s)=>{appInstance.goToStage(s);advance(1)}',stage)
   page.wait_for_timeout(250)
   page.emulate_media(reduced_motion='no-preference')
   page.wait_for_function('() => (!appInstance.motionQuery.matches)')
   page.evaluate('advance(45)')
   page.evaluate('window.recordCouple=true;window.coupleFrames=[]')
   page.locator('#pair-moment').click()
   assert page.evaluate('(k)=>appInstance.pairMoments.active && appInstance.pairMoments.kind===k',kind)
   frames=[]
   for stop in [30,105,135,150,168,225,255]:
    page.evaluate('(n)=>advance(n)',stop-(frames[-1][0] if frames else 0))
    measured=page.evaluate(PROBE);frames.append((stop,measured))
    for box in measured['robots']:
     assert all(math.isfinite(v) for v in box.values()),(name,kind,box,errors)
     assert box['left'] >= 0 and box['right'] <= width and box['top'] >= 45 and box['bottom'] <= height,(name,kind,stop,box)
    if kind=='star' and stop==150: assert measured['joinedGap']<.001,(name,measured)
    if kind=='star' and stop==225: assert measured['starGap']<.001,(name,measured)
    if kind=='crane' and stop==255: assert measured['starGap']<.001,(name,measured)
    if kind=='petal' and stop==105: assert measured['petalGap']<.001,(name,measured)
    if stop in [135,225]: page.screenshot(path=str(out/f'{name}-{kind}-{stop}.png'))
   page.evaluate('advance(120)')
   motion=page.evaluate('window.recordCouple=false;coupleFrames')
   speed=max(math.hypot(x['x']-y['x'],x['y']-y['y']) for before,after in zip(motion,motion[1:]) for x,y in zip(before,after))
   assert speed<24,(name,kind,'Root jumps between frames',speed)
   wrist_turn=max(2*math.acos(min(1,abs(sum(x*y for x,y in zip(a,b)))))
     for before,after in zip(motion,motion[1:]) for a,b in zip(before[1]['wrists'],after[1]['wrists']))
   assert wrist_turn<math.radians(20),(name,kind,'EVE wrist jumps between rendered frames',math.degrees(wrist_turn))
   assert page.evaluate('!appInstance.pairMoments.active && !appInstance.sceneTransition.active')
   results.append({'viewport':name,'moment':kind,'contact':frames[3][1]['joinedGap'] if kind=='star' else None})
   print(f'{name}: {kind} contact and framing PASS',flush=True)
  # A scene request interrupts a paired moment, then preserves the normal liquid passage.
  page.locator('#pair-moment').click(); page.evaluate('advance(90);appInstance.goToStage(6);advance(210)')
  page.wait_for_timeout(250)
  page.evaluate('advance(190)')
  assert page.evaluate('appInstance.stage===6 && !appInstance.sceneTransition.active')
  page.evaluate('advance(200)')
  assert page.evaluate('appInstance.finaleManager.bloom.phase==="ready"')
  assert page.locator('.wishes-stream-column').evaluate('e=>e.inert')
  page.screenshot(path=str(out/f'{name}-finale-ready.png'))
  print(f'{name}: finale ready',flush=True)
  page.locator('#finale-wish').focus(); page.keyboard.press('Enter')
  assert page.evaluate('appInstance.finaleManager.bloom.phase==="growing"')
  page.evaluate('advance(120)')
  print(f'{name}: charge and planting PASS',flush=True)
  frozen=page.evaluate('''()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));return appInstance.finaleManager.bloom.time;}''')
  page.evaluate('advance(40)')
  assert page.evaluate('appInstance.finaleManager.bloom.time')==frozen
  page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));advance(1)")
  print(f'{name}: visibility pause PASS',flush=True)
  page.evaluate('advance(180)')
  assert page.evaluate('appInstance.finaleManager.bloom.flower.visible')
  bloom=page.evaluate(PROBE)['bloomBounds']
  assert 0<=bloom['left']<bloom['right']<=width and 45<=bloom['top']<bloom['bottom']<=height,(name,bloom)
  print(f'{name}: bloom PASS',flush=True)
  page.screenshot(path=str(out/f'{name}-finale-bloom.png'))
  page.evaluate('advance(110)')
  page.screenshot(path=str(out/f'{name}-finale-climax.png'))
  page.evaluate('advance(150)')
  assert page.evaluate('appInstance.finaleManager.bloom.phase==="settled"')
  assert not page.locator('.wishes-stream-column').evaluate('e=>e.inert')
  assert page.locator('#finale-ritual').is_hidden()
  print(f'{name}: closing and reading PASS',flush=True)
  assert page.locator('#wishes-stream-container').evaluate('e=>e===document.activeElement')
  page.wait_for_timeout(1250)
  page.screenshot(path=str(out/f'{name}-finale-settled.png'))
  # Reflow during the story must keep its state and ground contact.
  page.set_viewport_size({'width':max(300,width-20),'height':height})
  page.wait_for_timeout(150);page.evaluate('advance(3)')
  assert page.evaluate('appInstance.finaleManager.bloom.phase==="settled"')
  page.set_viewport_size({'width':width,'height':height})
  page.wait_for_timeout(150);page.evaluate('advance(3)')
  # Once settled, it stays settled; a fresh visit resets the interaction.
  page.evaluate('advance(100)')
  assert page.evaluate('appInstance.finaleManager.bloom.time===18')
  page.emulate_media(reduced_motion='reduce'); page.wait_for_function('() => (appInstance.motionQuery.matches)')
  page.evaluate('appInstance.goToStage(2);advance(1);appInstance.goToStage(6);advance(1)')
  assert page.evaluate('appInstance.finaleManager.bloom.phase==="ready"')
  static=page.evaluate('[appInstance.wallE,appInstance.eve].map(r=>r.head.quaternion.toArray())')
  page.evaluate('advance(45)')
  assert static==page.evaluate('[appInstance.wallE,appInstance.eve].map(r=>r.head.quaternion.toArray())'),'Reduced-motion heads must stay still'
  page.locator('#finale-wish').click();page.evaluate('advance(1)')
  assert page.evaluate('appInstance.finaleManager.bloom.phase==="settled" && !appInstance.finaleManager.bloom.sparks.visible')
  page.evaluate('appInstance.goToStage(1);advance(1);appInstance.goToStage(6);advance(1)')
  page.locator('#finale-read').click();page.evaluate('advance(1)')
  assert page.evaluate('appInstance.finaleManager.bloom.phase==="settled" && !document.querySelector(".wishes-stream-column").inert')
  if name=='desktop':
   page.evaluate('appInstance.goToStage(1);advance(1);appInstance.goToStage(6);advance(1)')
   page.emulate_media(reduced_motion='no-preference');page.wait_for_function('() => (!appInstance.motionQuery.matches)')
   page.locator('#finale-wish').click();page.evaluate('advance(250)')
   interrupted=page.evaluate('appInstance.finaleManager.bloom.time')
   page.evaluate('appInstance.goToStage(2);advance(30)')
   assert page.evaluate('appInstance.finaleManager.bloom.flower.visible')
   assert page.evaluate('appInstance.finaleManager.bloom.time')==interrupted
   page.evaluate('advance(150)')
   assert page.evaluate('appInstance.stage===2 && !appInstance.sceneTransition.active && !appInstance.finaleManager.scenery3D.visible')
   print('desktop: departure during bloom PASS',flush=True)
  assert not errors,(name,errors)
  page.close()
 browser.close()
(out/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
