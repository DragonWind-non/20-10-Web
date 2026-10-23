"""Check wrist rotation every frame, including twists that leave the hand tip stationary."""
import argparse
import json
import math
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--viewport', choices=['desktop', 'mobile'], default='desktop')
parser.add_argument('--diagnose', action='store_true')
args = parser.parse_args()
out = Path(tempfile.gettempdir())/'20-10-eve-arms'; out.mkdir(exist_ok=True)
SCHEDULER = '''(() => {
 let callbacks=[],time;
 window.requestAnimationFrame=f=>(callbacks.push(f),callbacks.length);
 window.advance=n=>{const frames=[];for(let i=0;i<n;i++){
   time=(time??performance.now())+1000/60;const fs=callbacks;callbacks=[];fs.forEach(f=>f(time));
   if(window.sampleArms)frames.push(sampleArms());
 }return frames;};
})()'''
PROBE = '''()=>{
 const a=appInstance,e=a.eve;e.group.updateWorldMatrix(true,true);
 return {time:a.pairMoments.active?a.pairMoments.time:a.propDelivery.active?a.propDelivery.time:a.roseGift.active?a.roseGift.time:a.finaleManager.isActive?a.finaleManager.bloom.time:a.sceneTransition.time,
   arms:e.arms.map(arm=>({local:arm.quaternion.toArray(),world:arm.getWorldQuaternion(new THREE.Quaternion()).toArray()}))};
}'''

def angle(a,b):
 return 2*math.acos(min(1,abs(sum(x*y for x,y in zip(a,b)))))

results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-webgl','--enable-unsafe-swiftshader'])
 width,height=(1440,900) if args.viewport=='desktop' else (390,844)
 page=browser.new_page(viewport={'width':width,'height':height})
 page.add_init_script(SCHEDULER)
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto('http://127.0.0.1:3000/',wait_until='networkidle')
 page.wait_for_function('() => (window.appInstance?.pairMoments)')
 page.evaluate('''()=>{
  window.sampleArms='''+PROBE+''';advance(1);
  const renderer=appInstance.scene3d.renderer;
  window.drawFrame=renderer.render.bind(renderer);
  // Keep the real animation loop; omit GPU draws while sampling joint transforms.
  renderer.render=()=>{};
 }''')
 for name,stage,trigger,seconds in [
  ('star',1,"a.pairMoments.start('star')",11.5),
  ('petal',2,"a.pairMoments.start('petal')",10.5),
  ('crane',4,"a.pairMoments.start('crane')",12.5),
  ('spring-delivery',2,'a.propDelivery.start(a.scene3d.seasonalProps.props[1])',9),
  ('winter-delivery',5,'a.propDelivery.start(a.scene3d.seasonalProps.props[4])',9),
  ('rose',2,'a.roseGift.start()',21.5),
  ('hold-hands',2,'a.wallE.triggerHoldHands(3.5)',5.5),
  ('finale-growth',6,'a.finaleManager.bloom.sendWish()',18.5),
  ('passage',2,'a.goToStage(3)',5.7)
 ]:
  page.emulate_media(reduced_motion='reduce');page.wait_for_function('() => (appInstance.motionQuery.matches)')
  page.evaluate('(stage)=>{const a=appInstance;if(a.propDelivery.active)a.propDelivery.cancel(true);a.goToStage(stage);advance(1)}',stage)
  page.wait_for_timeout(230)
  page.emulate_media(reduced_motion='no-preference');page.wait_for_function('() => (!appInstance.motionQuery.matches)')
  page.evaluate('const a=appInstance;a.ambientTimer=Infinity;a.roseGift.wait=Infinity;a.pairMoments.wait=Infinity;advance(100)')
  started=page.evaluate('()=>{const a=appInstance;return '+trigger+';}')
  assert started is not False,(name,'Did not start')
  frames=page.evaluate('advance',math.ceil(seconds*60))
  jumps=[]
  for i,(before,after) in enumerate(zip(frames,frames[1:])):
   for arm,(a,b) in enumerate(zip(before['arms'],after['arms'])):
    jumps.append({'frame':i+1,'time':after['time'],'arm':arm,
      'degrees':math.degrees(angle(a['local'],b['local'])),
      'worldDegrees':math.degrees(angle(a['world'],b['world']))})
  worst=sorted(jumps,key=lambda x:x['degrees'],reverse=True)[:6]
  world_worst=max(jumps,key=lambda x:x['worldDegrees'])
  result={'case':name,'viewport':args.viewport,'worst':worst,'worldWorst':world_worst}
  results.append(result)
  print(json.dumps(result) if args.diagnose else f'{name}: wrist {worst[0]["degrees"]:.2f} deg/frame, world {world_worst["worldDegrees"]:.2f} deg/frame',flush=True)
  if not args.diagnose:
   assert worst[0]['degrees']<18,(name,'EVE wrist snaps',worst)
   assert world_worst['worldDegrees']<20,(name,'Arm snaps in world space',world_worst)
  page.evaluate('drawFrame(appInstance.scene3d.scene,appInstance.scene3d.camera)')
  page.screenshot(path=str(out/f'{args.viewport}-{name}.png'))
 assert not errors,errors
 browser.close()
(out/f'{args.viewport}.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
