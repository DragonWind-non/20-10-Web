"""Exercise the real meshes and render the directional liquid handoff in Chrome."""
import argparse
import json
import math
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(tempfile.gettempdir()) / '20-10-liquid-passage'))
parser.add_argument('--viewport', choices=['desktop', 'mobile', 'tiny', 'landscape'])
args = parser.parse_args()
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)

SCHEDULER = '''(() => {
  let callbacks=[], time;
  window.requestAnimationFrame=fn=>(callbacks.push(fn),callbacks.length);
  window.stepFrame=()=>{
    time=(time??performance.now())+1000/60;
    const frame=callbacks; callbacks=[]; frame.forEach(fn=>fn(time));
  };
})()'''
PROBE = '''() => {
  const a=appInstance, c=a.scene3d.camera;
  const bounds=robot=>{
    const box={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
    robot.group.updateWorldMatrix(true,true);
    robot.model.traverseVisible(mesh=>{
      if(!mesh.geometry || mesh.material?.visible===false || mesh.name==='hit-proxy')return;
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      const {min,max}=mesh.geometry.boundingBox;
      for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
        const p=new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).project(c);
        const px=(p.x+1)*innerWidth/2, py=(1-p.y)*innerHeight/2;
        box.left=Math.min(box.left,px);box.right=Math.max(box.right,px);
        box.top=Math.min(box.top,py);box.bottom=Math.max(box.bottom,py);
      }
    });
    return box;
  };
  const robots=[a.wallE,a.eve].map(robot=>{
    robot.group.updateWorldMatrix(true,true);
    const root=robot.group.position.clone().project(c);
    return {root:[(root.x+1)*innerWidth/2,(1-root.y)*innerHeight/2],
      quaternion:robot.group.quaternion.toArray(),scale:robot.group.scale.x,
      joints:[robot.head,...robot.arms].map(node=>node.getWorldQuaternion(new THREE.Quaternion()).toArray()),
      arms:robot.arms.flatMap(arm=>arm.scale.toArray())};
  });
  return {stage:a.stage, time:a.sceneTransition.time, grip:a.sceneTransition.grip,
    active:a.sceneTransition.active, liquid:a.liquidTransition.active, robots,
    gap:a.wallE.arms[1].localToWorld(a.wallE.handTip.clone()).distanceTo(
      a.eve.arms[0].localToWorld(a.eve.handTip.clone())),
    bounds:[bounds(a.wallE),bounds(a.eve)]};
}'''

results = []

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for name, width, height in [('desktop',1440,900), ('mobile',390,844), ('tiny',320,568), ('landscape',844,390)]:
        if args.viewport and args.viewport != name:
            continue
        page = browser.new_page(viewport={'width':width,'height':height})
        page.add_init_script(SCHEDULER)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' and 'THREE.WebGL' in msg.text else None)
        page.goto('http://127.0.0.1:3000/', wait_until='networkidle')
        page.wait_for_function('() => (window.appInstance?.eve)', polling=50)
        page.wait_for_function("[...document.querySelectorAll('.scene-backdrop')].length===6 && [...document.querySelectorAll('.scene-backdrop')].every(image=>image.complete && image.naturalWidth>=1280)", polling=50)
        assert page.locator('.scene-backdrop').evaluate_all('images=>images.length===6 && images.every(image=>image.complete && image.naturalWidth>=1280)')
        page.evaluate(f'window.probe={PROBE}')
        assert page.evaluate('''() => {
          const joint=new THREE.Object3D(), arcs=new Map(), axis=new THREE.Vector3(0,1,0);
          for(const [target,want] of [[170,85],[175,87.5],[180,90],[185,92.5],[190,95]]){
            joint.quaternion.identity();
            appInstance.sceneTransition.mixRotation(joint,new THREE.Quaternion().setFromAxisAngle(axis,target*Math.PI/180),.5,arcs);
            const expected=new THREE.Quaternion().setFromAxisAngle(axis,want*Math.PI/180);
            if(joint.quaternion.angleTo(expected)>1e-6)return false;
          }return true;
        }'''), 'Rotation must preserve its arc when the target passes 180 degrees'
        page.evaluate('''() => {
          const a=appInstance;
          window.handoffs=[];
          const start=a.liquidTransition.start.bind(a.liquidTransition);
          a.liquidTransition.start=(...args)=>{handoffs.push(probe());start(...args);};
          window.advance=count=>{
            const frames=[];
            for(let i=0;i<count;i++){stepFrame();frames.push(probe());}
            return frames;
          };
          stepFrame();advance(90);
        }''')
        for source, target in [(1,2), (2,3), (3,2), (5,6), (6,4), (4,1)]:
            # Set up the source through the actual reduced-motion navigation path.
            page.emulate_media(reduced_motion='reduce')
            page.wait_for_function('() => (appInstance.motionQuery.matches)', polling=50)
            page.evaluate('(stage)=>{appInstance.goToStage(stage);advance(1)}', source)
            page.wait_for_timeout(220)
            page.emulate_media(reduced_motion='no-preference')
            page.wait_for_function('() => (!appInstance.motionQuery.matches)', polling=50)
            page.evaluate('advance(60);handoffs=[]')
            before = page.evaluate(PROBE)
            selection = page.locator('#season-stepper').evaluate('el=>getComputedStyle(el,"::before").transform')
            page.evaluate('(stage)=>appInstance.goToStage(stage)', target)
            assert page.evaluate('(s)=>appInstance.stage===s && Number(document.body.dataset.stage)===s', source), \
                'The scene changes before the robots have joined hands and left the viewport'
            frames = []
            previous = 0
            for stop in [1,57,90,139,170,204,258,315]:
                frames.extend(page.evaluate('advance', stop-previous))
                previous = stop
                if stop == 139:
                    page.wait_for_timeout(220)
                    if (source,target) == (2,3):
                        opacity = page.evaluate('''() => {
                          const a=appInstance;a.phaseAnimation.pause();a.phaseAnimation.currentTime=180;
                          return Number(getComputedStyle(a.narrativeBox).opacity);
                        }''')
                        assert opacity < .02, 'Replace the story only while its card is hidden'
                if (source,target) == (2,3):
                    page.evaluate('''() => {
                      const a=appInstance, ms=Math.max(0,(a.sceneTransition.time-2.3)*1000);
                      if(a.sceneTransition.time<2.3)return;
                      for(const animation of [a.phaseAnimation,a.animeSky.glowAnimation,
                        ...a.animeSky.layers.map(layer=>layer.passageAnimation)]){
                        if(animation){animation.pause();animation.currentTime=ms;}
                      }
                    }''')
                    page.screenshot(path=str(out / f'{name}-{stop}.png'))
            contact = [frame for frame in frames if frame['grip'] > 1-1e-9]
            assert len(contact)>120 and max(frame['gap'] for frame in contact)<1e-5, \
                ('Hands separate',name,source,target,len(contact),sorted([(f['gap'],f['time']) for f in contact],reverse=True)[:4])
            assert all(abs(scale-1)<1e-6 for frame in contact for robot in frame['robots'] for scale in robot['arms'])
            assert all(math.isfinite(value) for frame in frames for robot in frame['robots']
                       for value in robot['root']+robot['quaternion']+[robot['scale']])
            max_turn = max_joint = max_step = 0
            for first, second in zip(frames,frames[1:]):
                for index, (a,b) in enumerate(zip(first['robots'],second['robots'])):
                    boxes = [first['bounds'][index],second['bounds'][index]]
                    if not all(box['right']>0 and box['left']<width for box in boxes):
                        continue  # The invisible reset belongs outside the viewport.
                    angle = lambda x,y: 2*math.acos(min(1,abs(sum(p*q for p,q in zip(x,y)))))
                    max_turn = max(max_turn,angle(a['quaternion'],b['quaternion']))
                    max_joint = max(max_joint,*(angle(x,y) for x,y in zip(a['joints'],b['joints'])))
                    max_step = max(max_step,math.dist(a['root'],b['root']))
            assert max_turn < .35 and max_joint < .6 and max_step < max(40,width*.08), \
                ('Visible pose snaps',name,source,target,max_turn,max_joint,max_step)
            assert all(frame['stage']==source and not frame['liquid'] for frame in frames if frame['time']<2.3)
            handoff = page.evaluate('handoffs')
            assert len(handoff)==1 and handoff[0]['stage']==source
            direction = 1 if target>source else -1
            for box in handoff[0]['bounds']:
                assert (box['left']>width if direction>0 else box['right']<0), ('Robot still visible at swap',name,source,target,handoff)
            assert frames[0]['robots'] and max(math.dist(a['root'],b['root']) for a,b in zip(before['robots'],frames[0]['robots']))<12
            assert page.evaluate('(s)=>appInstance.stage===s && !appInstance.sceneTransition.active && !appInstance.liquidTransition.active', target)
            assert page.locator('.sky-layer.active').count()==1
            assert page.locator('#season-stepper').evaluate('el=>getComputedStyle(el,"::before").transform') != selection
            assert page.locator('#webgl-canvas').evaluate('el=>getComputedStyle(el).filter==="none" && Number(getComputedStyle(el).opacity)>.99')
            results.append({'viewport':name,'from':source,'to':target,'gripGap':max(f['gap'] for f in contact),
                            'maxVisibleTurn':max_turn,'maxVisibleJoint':max_joint,'maxVisibleStepPx':max_step,
                            'exitBounds':handoff[0]['bounds']})
        # Last selection wins after the uninterrupted first passage.
        page.evaluate('appInstance.goToStage(2);advance(50);appInstance.goToStage(5);appInstance.goToStage(3)')
        assert page.evaluate('appInstance.stage===1 && appInstance.queuedStage===3')
        page.evaluate('advance(590)')
        assert page.evaluate('appInstance.stage===3 && !appInstance.sceneTransition.active && appInstance.queuedStage==null')
        # A hidden tab freezes both the passage and the water shader.
        page.evaluate('appInstance.goToStage(4);advance(160)')
        frozen = page.evaluate('''() => {
          Object.defineProperty(document,'hidden',{configurable:true,value:true});
          document.dispatchEvent(new Event('visibilitychange'));
          return {time:appInstance.sceneTransition.time,progress:appInstance.liquidTransition.uniforms.progress.value};
        }''')
        page.evaluate('advance(30)')
        assert page.evaluate('appInstance.sceneTransition.time')==frozen['time']
        assert page.evaluate('appInstance.liquidTransition.uniforms.progress.value')==frozen['progress']
        page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));advance(1)")
        page.set_viewport_size({'width':max(320,width-30),'height':height+20})
        page.evaluate('advance(180)')
        assert page.evaluate('appInstance.stage===4 && !appInstance.sceneTransition.active')
        page.set_viewport_size({'width':width,'height':height})
        # Reduced motion must also finish a pending navigation and remove the shader.
        page.evaluate('appInstance.goToStage(5);advance(45)')
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_function('() => (appInstance.motionQuery.matches)', polling=50)
        page.evaluate('advance(1)')
        assert page.evaluate('appInstance.stage===5 && !appInstance.sceneTransition.active && !appInstance.liquidTransition.active && !appInstance.eve.isTravelling'), \
            page.evaluate('({stage:appInstance.stage,active:appInstance.sceneTransition.active,hidden:document.hidden})')
        page.locator('.step-node[data-stage="2"]').click()
        page.evaluate('advance(1)')
        assert page.evaluate('appInstance.stage===2 && !appInstance.sceneTransition.active')
        page.wait_for_timeout(220)
        # Both dissolve directions must still retain an opaque sky below the water.
        for stage in [4,3,5,2]:
            coverage = page.evaluate('''stage=>{
              const sky=appInstance.animeSky;sky.setStage(stage);
              for(const layer of sky.layers)if(layer.passageAnimation){
                layer.passageAnimation.pause();layer.passageAnimation.currentTime=90;
              }
              return 1-sky.layers.reduce((alpha,layer)=>{
                const s=getComputedStyle(layer);
                return s.visibility==='hidden'?alpha:alpha*(1-Number(s.opacity));
              },1);
            }''',stage)
            assert coverage>.99, ('The sky exposes a dark base',name,stage,coverage)
        assert not errors, errors
        page.screenshot(path=str(out / f'{name}-reduced.png'))
        print(json.dumps({'viewport':name,'transitions':6,'queue':True,'pause':True,'reducedMotion':True}),flush=True)
        page.close()
    browser.close()
(out / 'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps({'transitions':len(results),'viewports':sorted({r['viewport'] for r in results}),
                  'maxGripGap':max(r['gripGap'] for r in results),'errors':[]}))
