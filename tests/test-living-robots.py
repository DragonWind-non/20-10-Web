"""Observe unforced motion and interaction over time, not just triggered end poses."""
import argparse
import json
import tempfile
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(tempfile.gettempdir()) / '20-10-living-robots'))
out = Path(parser.parse_args().output)
out.mkdir(parents=True, exist_ok=True)

SAMPLE = """() => {
    const a=appInstance, started=performance.now();window.livingSamples=[];
    const sample=()=>{
        const robots=[a.wallE,a.eve].map(robot=>{
            const p=robot.floatPivot.getWorldPosition(new THREE.Vector3()).project(a.scene3d.camera);
            return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,
                yaw:robot.group.rotation.y,pitch:robot.group.rotation.x,roll:robot.floatPivot.rotation.z,
                driftX:robot.motion.position.x*robot.displayLayout.roamX,
                driftY:robot.motion.position.y*robot.displayLayout.roamY};
        });
        livingSamples.push({time:performance.now()-started,robots,
            holding:a.wallE.isHoldingHands,scanning:a.eve.isScanning});
        if(performance.now()-started<26000)requestAnimationFrame(sample);
    };requestAnimationFrame(sample);
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    results, failures = [], []
    for name,width,height in [('desktop',1440,900),('mobile',390,844)]:
        context = browser.new_context(viewport={'width':width,'height':height},reduced_motion='no-preference',has_touch=True)
        page = context.new_page()
        errors = []
        samples = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto('http://127.0.0.1:3000/',wait_until='networkidle')
            # Keep wander inputs independent of random weather and particle draws.
            page.evaluate('''()=>{
                for(const [i,robot] of [appInstance.wallE,appInstance.eve].entries()){
                    let seed=42+i;
                    robot.motion.random=()=>((seed=seed*48271%2147483647)/2147483647);
                }
            }''')
            page.locator('.step-node[data-stage="2"]').click()
            page.wait_for_function('() => (!appInstance.sceneTransition.active)')
            page.mouse.move(2,2)
            page.evaluate(SAMPLE)
            for index in range(4):
                page.wait_for_timeout(6500)
                page.screenshot(path=str(out/f'{name}-idle-{index}.png'))
            page.wait_for_function('() => (livingSamples.at(-1).time>=26000)',timeout=6000)
            samples = page.evaluate('livingSamples')
            spans=[]
            for index in range(2):
                idle=[s['robots'][index] for s in samples if not s['holding'] and not s['scanning']]
                span={axis:round(max(s[axis] for s in idle)-min(s[axis] for s in idle),3)
                      for axis in ['driftX','driftY','yaw','pitch','roll']}
                spans.append(span)
                assert span['driftX']>8 and span['driftY']>10, ('Whole-body drift is barely visible',index,span)
                assert span['yaw']>.8, ('Robot stays facing the camera',index,span)
            assert any(s['holding'] for s in samples), 'Robots never interact with each other while idle'
            assert any(s['scanning'] for s in samples), 'EVE never explores the seasonal object while idle'
            # User input takes priority over spontaneous actions.
            page.locator('.step-node[data-stage="1"]').click()
            page.wait_for_function('() => (!appInstance.sceneTransition.active)')
            page.mouse.move(width*.2,height*.5)
            page.wait_for_timeout(1200)
            left_yaw=page.evaluate('appInstance.eve.group.rotation.y')
            page.mouse.move(width*.8,height*.5)
            page.wait_for_timeout(1200)
            right_yaw=page.evaluate('appInstance.eve.group.rotation.y')
            assert right_yaw-left_yaw>.2,'The whole body must turn toward user input'
            page.mouse.move(width*.7,height*.5)
            page.wait_for_timeout(100)
            assert page.evaluate('appInstance.eve.pointerAge<.5')
            page.locator('.step-node[data-stage="3"]').click()
            page.wait_for_function('() => (appInstance.sceneTransition.grip>1-1e-9)')
            handoff=page.evaluate('''()=>{
                const a=appInstance,w=a.wallE,e=a.eve,style=getComputedStyle(document.querySelector('#webgl-canvas'));
                w.group.updateWorldMatrix(true,true);e.group.updateWorldMatrix(true,true);
                return {opacity:Number(style.opacity),filter:style.filter,
                    gap:w.arms[1].localToWorld(w.handTip.clone()).distanceTo(e.arms[0].localToWorld(e.handTip.clone()))};
            }''')
            assert handoff['opacity']>.99 and handoff['filter']=='none' and handoff['gap']<1e-5,handoff
            page.screenshot(path=str(out/f'{name}-transition.png'))
            page.wait_for_function('() => (appInstance.stage===3 && !appInstance.sceneTransition.active)')
            for _ in range(4):
                body=page.evaluate('''()=>{const a=appInstance,p=a.wallE.body.getWorldPosition(new THREE.Vector3()).project(a.scene3d.camera);
                    return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};}''')
                page.mouse.click(body['x'],body['y'])
                page.wait_for_timeout(80)
            assert page.evaluate('appInstance.stage===3 && appInstance.wallE.swimState==="shoo" && appInstance.wallE.blushOpacity>.5')
            page.wait_for_function('() => (appInstance.wallE.swimState==="swimming")',timeout=4000)
            assert page.evaluate('appInstance.wallE.swimState==="swimming"')
            page.screenshot(path=str(out/f'{name}-user-response.png'))
            body=page.evaluate('''()=>{const a=appInstance,p=a.eve.body.getWorldPosition(new THREE.Vector3()).project(a.scene3d.camera);
                return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};}''')
            page.touchscreen.tap(body['x'],body['y'])
            assert page.evaluate('appInstance.stage===3 && appInstance.eve.isHoldingHands')
            page.locator('.step-node[data-stage="5"]').click()
            page.locator('.step-node[data-stage="4"]').click()
            page.wait_for_function('() => (appInstance.stage===4 && !appInstance.sceneTransition.active)')
            assert page.evaluate('appInstance.stage===4 && document.body.dataset.stage==="4"')
            assert page.evaluate('!appInstance.eve.isScanning && !appInstance.wallE.isHoldingHands')
            assert page.locator('#webgl-canvas').evaluate('el=>Number(getComputedStyle(el).opacity)>.99')
            page.emulate_media(reduced_motion='reduce')
            page.wait_for_timeout(900)
            snapshot = page.evaluate('JSON.stringify([appInstance.wallE.group.rotation,appInstance.eve.group.rotation,appInstance.eve.floatPivot.rotation])')
            page.wait_for_timeout(400)
            assert snapshot==page.evaluate('JSON.stringify([appInstance.wallE.group.rotation,appInstance.eve.group.rotation,appInstance.eve.floatPivot.rotation])')
            assert not errors,errors
            results.append({'viewport':name,'spans':spans,'ambientPairAndScan':True,'rapidNavigation':True,'reducedMotion':True})
            print(json.dumps(results[-1]),flush=True)
        except Exception as error:
            failures.append(f'{name}: {error}')
            print(failures[-1],flush=True)
            print(traceback.format_exc(),flush=True)
        finally:
            (out/f'{name}-samples.json').write_text(json.dumps(samples),encoding='utf-8')
            context.close()
    browser.close()
(out/'living-results.json').write_text(json.dumps({'results':results,'failures':failures},indent=2),encoding='utf-8')
assert not failures,'\n'.join(failures)
