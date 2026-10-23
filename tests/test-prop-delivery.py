"""Click actual seasonal props, measure the grip and approach, and read the letter."""
import argparse
import json
import math
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--viewport',choices=['desktop','mobile','tiny','landscape'])
parser.add_argument('--output',default=str(Path(tempfile.gettempdir())/'20-10-prop-delivery'))
args=parser.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
SCHEDULER='''(() => {
 let callbacks=[],time;
 window.requestAnimationFrame=f=>(callbacks.push(f),callbacks.length);
 window.stepFrame=()=>{time=(time??performance.now())+1000/60;const fs=callbacks;callbacks=[];fs.forEach(f=>f(time));};
 window.advance=n=>{const frames=[];for(let i=0;i<n;i++){stepFrame();if(window.probe)frames.push(probe());}return frames;};
})()'''
PROBE='''()=>{
 const a=appInstance,d=a.propDelivery,c=a.scene3d.camera;
 const project=point=>{point.project(c);return [(point.x+1)*innerWidth/2,(1-point.y)*innerHeight/2];};
 const robots=[a.wallE,a.eve].map(r=>{
   r.group.updateWorldMatrix(true,true);
   return {root:project(r.group.position.clone()),scale:r.group.scale.x,
     quaternion:r.group.quaternion.toArray(),depth:r.group.position.clone().sub(c.position).dot(new THREE.Vector3(0,0,-1).applyQuaternion(c.quaternion))};
 });
 const owner=d.robots[d.ownerIndex??0],arm=owner.arms[d.armIndex??0];
 const hand=arm.localToWorld(owner.handTip.clone());
 return {time:d.time,active:d.active,stage:a.stage,robots,gift:d.gift.visible,
   gripGap:hand.distanceTo(d.gift.position),contactGap:d.contact.distanceTo(hand),
   letter:d.dialog.open,returning:d.returning};
}'''
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 for name,width,height in [('desktop',1440,900),('mobile',390,844),('tiny',320,568),('landscape',844,390)]:
  if args.viewport and args.viewport!=name:continue
  page=browser.new_page(viewport={'width':width,'height':height},has_touch=True)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'THREE.WebGL' in m.text else None)
  page.add_init_script(SCHEDULER)
  page.goto('http://127.0.0.1:3000/',wait_until='networkidle')
  page.wait_for_function('() => (window.appInstance?.propDelivery)',polling=50)
  page.evaluate(f'window.probe={PROBE};stepFrame();advance(60)')
  for stage in [1,2,3,4,5]:
   page.emulate_media(reduced_motion='reduce')
   page.wait_for_function('() => (appInstance.motionQuery.matches)',polling=50)
   page.evaluate('(s)=>{appInstance.goToStage(s);advance(1)}',stage)
   page.wait_for_timeout(220)
   page.emulate_media(reduced_motion='no-preference')
   page.wait_for_function('() => (!appInstance.motionQuery.matches)',polling=50)
   page.evaluate('advance(60)')
   point=page.evaluate('''()=>{const a=appInstance,p=a.scene3d.seasonalProps.props[a.stage-1].group.position.clone().project(a.scene3d.camera);return [(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2];}''')
   if name=='desktop':page.mouse.click(*point)
   else:page.touchscreen.tap(*point)
   assert page.evaluate('appInstance.propDelivery.active && appInstance.sceneTransition.delivery===appInstance.propDelivery'),('No delivery from prop click',name,stage,point,errors)
   before=page.evaluate(PROBE)
   frames=[];previous=0
   for stop in [1,42,156,195,230,312,414]:
    frames.extend(page.evaluate('advance',stop-previous));previous=stop
    if stop==195:
     contact=page.evaluate(PROBE)
     assert contact['contactGap']<.001,('Hand misses the prop',name,stage,contact)
    if stop==414:page.wait_for_timeout(950)
    if (stage in [2,4] and stop in [156,195,312,414]) or (stage in [3,5] and stop==414):
     page.screenshot(path=str(out/f'{name}-{stage}-{stop}.png'))
   assert max(f['gripGap'] for f in frames if f['gift'])<1e-6,('Keepsake floats away from the hand',name,stage)
   assert all(math.isfinite(value) for f in frames for r in f['robots'] for value in r['root']+r['quaternion']+[r['depth'],r['scale']])
   after=page.evaluate(PROBE)
   owner=page.evaluate('appInstance.propDelivery.ownerIndex')
   assert after['robots'][owner]['depth']<before['robots'][owner]['depth']/1.05,('The actor does not approach the camera',name,stage,before,after)
   assert after['letter'] and after['stage']==stage
   body=page.locator('.letter-body')
   assert body.evaluate('e=>e.scrollTop')==0,'Every new letter starts at its first paragraph'
   assert len(body.inner_text().split())>=300 and '20/10' in body.inner_text()
   rect=page.locator('#prop-letter').bounding_box()
   assert 0<=rect['x'] and rect['x']+rect['width']<=width+.1 and 0<=rect['y'] and rect['y']+rect['height']<=height+.1,('Letter outside viewport',name,rect)
   boxes=page.evaluate('''()=>{
    const a=appInstance,c=a.scene3d.camera;
    return [a.wallE.model,a.eve.model,a.propDelivery.gift].map(group=>{
      const box={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
      group.updateWorldMatrix(true,true);
      group.traverseVisible(mesh=>{
        if(!mesh.geometry || mesh.material?.visible===false || mesh.name==='hit-proxy')return;
        if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
        const {min,max}=mesh.geometry.boundingBox;
        for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
          const p=new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).project(c);
          const px=(p.x+1)*innerWidth/2,py=(1-p.y)*innerHeight/2;
          box.left=Math.min(box.left,px);box.right=Math.max(box.right,px);
          box.top=Math.min(box.top,py);box.bottom=Math.max(box.bottom,py);
        }
      });return box;
    });
   }''')
   for box in boxes:
    assert box['left']>=0 and box['right']<=width and box['top']>=52 and box['bottom']<=height,('Close-up clips a model or keepsake',name,stage,box)
    assert not (box['left']<rect['x']+rect['width'] and box['right']>rect['x'] and box['top']<rect['y']+rect['height'] and box['bottom']>rect['y']),('Letter covers the close-up',name,stage,box,rect)
   body.hover();page.mouse.wheel(0,500);page.wait_for_timeout(150)
   assert body.evaluate('e=>e.scrollTop')>0,('Long letter cannot scroll',name,stage)
   assert page.evaluate('(s)=>appInstance.stage===s && !appInstance.queuedStage',stage)
   page.keyboard.press('Escape')
   returned=page.evaluate('advance(100)')
   assert page.evaluate('!appInstance.propDelivery.active && !appInstance.sceneTransition.active && !appInstance.propDelivery.gift.visible && !appInstance.propDelivery.dialog.open')
   assert max(math.dist(a['root'],b['root']) for a,b in zip(after['robots'],returned[0]['robots']))<12,('Return pose jumps',name,stage)
   results.append({'viewport':name,'stage':stage,'gripGap':max(f['gripGap'] for f in frames if f['gift']),
     'closeDepth':after['robots'][owner]['depth'],'originalDepth':before['robots'][owner]['depth'],'letterWords':len(body.inner_text().split())})
  # Navigation can request a new scene at any point in the pickup.
  page.evaluate('appInstance.propDelivery.start(appInstance.scene3d.seasonalProps.props[appInstance.stage-1]);advance(90);appInstance.goToStage(3);advance(440)')
  assert page.evaluate('appInstance.stage===3 && !appInstance.sceneTransition.active && !appInstance.propDelivery.dialog.open')
  # Hidden pages freeze the new choreography too.
  page.evaluate('appInstance.propDelivery.start(appInstance.scene3d.seasonalProps.props[2]);advance(100)')
  frozen=page.evaluate('''()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));return appInstance.propDelivery.time;}''')
  page.evaluate('advance(40)')
  assert page.evaluate('appInstance.propDelivery.time')==frozen
  page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));advance(1)")
  page.emulate_media(reduced_motion='reduce')
  page.wait_for_function('() => (appInstance.motionQuery.matches)',polling=50)
  page.evaluate('advance(2)')
  assert page.evaluate('appInstance.propDelivery.dialog.open')
  static=page.evaluate(PROBE);page.evaluate('advance(20)');still=page.evaluate(PROBE)
  assert static['time']==still['time'] and all(math.dist(a['root'],b['root'])<1e-6 and abs(a['depth']-b['depth'])<1e-6
    for a,b in zip(static['robots'],still['robots'])),('Reduced motion must retain a static presentation',static,still)
  page.locator('.letter-receive').click()
  assert page.evaluate('!appInstance.propDelivery.active && !appInstance.sceneTransition.active')
  assert page.evaluate('appInstance.scene3d.scene.children.filter(o=>o.name==="delivered-keepsake").length===1')
  assert not errors,errors
  print(json.dumps({'viewport':name,'letters':5,'navigation':True,'pause':True,'reducedMotion':True,'errors':errors}),flush=True)
  page.close()
 browser.close()
(out/f'results-{args.viewport or "all"}.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps({'deliveries':len(results),'maxGripGap':max(r['gripGap'] for r in results)}))
