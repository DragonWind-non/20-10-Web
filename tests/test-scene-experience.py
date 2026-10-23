"""Exercise real geometry, interaction and transitions in Chrome, including small screens."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(tempfile.gettempdir()) / '20-10-experience'))
out = Path(parser.parse_args().output)
out.mkdir(parents=True, exist_ok=True)

GEOMETRY = """() => {
    const a=appInstance, camera=a.scene3d.camera;
    const project = p => {p.project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};};
    const bounds = root => {
        const b={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
        root.updateWorldMatrix(true,true);
        root.traverseVisible(mesh=>{
            if(mesh.material?.visible===false || mesh.name==='hit-proxy')return;
            const positions=mesh.geometry?.attributes.position;if(!positions)return;
            for(let i=0;i<positions.count;i++){
                const p=project(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld));
                b.left=Math.min(b.left,p.x);b.right=Math.max(b.right,p.x);
                b.top=Math.min(b.top,p.y);b.bottom=Math.max(b.bottom,p.y);
            }
        });return b;
    };
    return {wall:bounds(a.wallE.model),eve:bounds(a.eve.model),
        wallTorso:bounds(a.wallE.body),eveTorso:bounds(a.eve.body),holding:a.wallE.handHoldProgress>.01 || a.sceneTransition?.grip>.01,
        prop:bounds(a.scene3d.seasonalProps.props[a.stage-1].group),
        wallBody:project(a.wallE.body.getWorldPosition(new THREE.Vector3())),
        eveBody:project(a.eve.body.getWorldPosition(new THREE.Vector3()))};
}"""


def overlap(a, b):
    return a['left'] < b['right'] and a['right'] > b['left'] and a['top'] < b['bottom'] and a['bottom'] > b['top']


def check_scene(page, width, height, stage):
    geometry = page.evaluate(GEOMETRY)
    blockers = page.locator('#narrative-box, #season-stepper, #vinyl-dock, .top-hud').evaluate_all("""els=>
        els.filter(el=>getComputedStyle(el).display!=='none').map(el=>el.getBoundingClientRect().toJSON())""")
    for name in ['wall', 'eve'] + (['prop'] if stage < 6 else []):
        box = geometry[name]
        assert 0 <= box['left'] < box['right'] <= width, (stage, name, box)
        assert 0 <= box['top'] < box['bottom'] <= height, (stage, name, box)
        if stage < 6 and name in ['wall','eve']:
            assert box['bottom']-box['top'] >= 48, ('Robot shrank out of the experience',stage,name,box)
        assert not any(overlap(box, block) for block in blockers), (stage, name, box, blockers)
    if stage < 6:
        if geometry['holding']:
            assert not overlap(geometry['wallTorso'], geometry['eveTorso']), ('Bodies intersect while holding hands',stage,geometry)
        else:
            assert not overlap(geometry['wall'], geometry['eve']), ('Robots overlap', stage, geometry)
    return geometry


if __name__ == '__main__':
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        for name, width, height in [('mobile',390,844), ('tiny',320,568), ('landscape',844,390), ('desktop',1440,900)]:
            context = browser.new_context(viewport={'width':width,'height':height}, has_touch=True)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto('http://127.0.0.1:3000/', wait_until='networkidle')
            page.wait_for_function('() => (window.appInstance?.eve)')
            page.emulate_media(reduced_motion='reduce')
            for stage in range(1,7):
                page.locator(f'.step-node[data-stage="{stage}"]').click()
                page.wait_for_timeout(600)
                check_scene(page,width,height,stage)
                assert page.locator('.sky-layer.active .scene-backdrop').evaluate('image=>image.complete && image.naturalWidth>=1280'), 'Every stage must load its painted background'
                page.screenshot(path=str(out/f'{name}-{stage}.png'))
            page.locator('[data-stage="2"]').click()
            page.emulate_media(reduced_motion='no-preference')
            page.wait_for_timeout(1500)
            page.evaluate('appInstance.ambientTimer=appInstance.roseGift.wait=Infinity;appInstance.wallE.motion.spinWait=0.01')
            max_roll = 0
            for _ in range(30):
                page.wait_for_timeout(450)
                check_scene(page,width,height,2)
                max_roll = max(max_roll,abs(page.evaluate('appInstance.wallE.motion.roll')))
                if max_roll > 5.5:
                    break
            assert max_roll > 5.5, ('Full roll was not observed',name,max_roll)

            page.evaluate('appInstance.wallE.triggerHoldHands(8)')
            page.wait_for_timeout(1500)
            gap = page.evaluate('''()=>{
                const a=appInstance;a.wallE.group.updateWorldMatrix(true,true);a.eve.group.updateWorldMatrix(true,true);
                return a.wallE.arms[1].localToWorld(a.wallE.handTip.clone())
                    .distanceTo(a.eve.arms[0].localToWorld(a.eve.handTip.clone()));
            }''')
            assert gap < .03, ('Hands must meet in world space',name,gap)
            page.screenshot(path=str(out/f'{name}-hold-hands.png'))
            body = page.evaluate(GEOMETRY)['eveBody']
            page.touchscreen.tap(body['x'],body['y'])
            response = page.evaluate('({stage:appInstance.stage,pending:appInstance.eve.pendingSpin,spin:appInstance.eve.spinTime,holding:appInstance.eve.isHoldingHands})')
            assert response['stage']==2 and (response['pending'] or response['spin']>0), ('Touch must release the hands before spinning without skipping the season',response)
            page.wait_for_timeout(3300)
            check_scene(page,width,height,2)

            # Clicking a prop starts a physical gift delivery and retains the season.
            prop = page.evaluate('''()=>{
                const a=appInstance,p=a.scene3d.seasonalProps.props[1].group.getWorldPosition(new THREE.Vector3()).project(a.scene3d.camera);
                return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
            }''')
            page.mouse.click(prop['x'],prop['y'])
            page.wait_for_timeout(100)
            assert page.evaluate('appInstance.stage===2 && appInstance.propDelivery.active'), 'Click must deliver a gift without advancing'
            page.wait_for_function('() => (appInstance.propDelivery.dialog.open)')
            assert '20/10' in page.locator('.letter-body').inner_text()
            page.screenshot(path=str(out/f'{name}-gift.png'))
            page.keyboard.press('Escape')
            page.wait_for_function('() => (!appInstance.propDelivery.active)')

            # Interrupt all interaction modes and verify that no timer wakes a sleeping robot.
            page.evaluate('appInstance.wallE.startSwimAway();appInstance.eve.triggerAcrobaticSpin();appInstance.goToStage(6)')
            page.wait_for_function('() => (appInstance.stage===6 && !appInstance.sceneTransition.active)')
            assert page.evaluate('appInstance.wallE.emotion==="sleep" && appInstance.eve.emotion==="sleep" && appInstance.wallE.swimState==="none" && !appInstance.eve.isScanning')
            check_scene(page,width,height,6)
            page.keyboard.press('ArrowLeft')
            page.wait_for_function('() => (appInstance.stage===5 && !appInstance.sceneTransition.active)')
            page.evaluate('appInstance.goToStage(2);appInstance.goToStage(6);appInstance.goToStage(4);appInstance.goToStage(3)')
            page.wait_for_function('() => (appInstance.stage===3 && !appInstance.sceneTransition.active)')
            assert page.locator('.sky-layer.active').get_attribute('class') == 'sky-layer sky-stage-3 active'
            assert 'MÙA HẠ' in page.locator('#dialogue-title').inner_text().upper()
            assert page.evaluate('''()=>{for(const stage of [0,7,2.5,NaN])appInstance.goToStage(stage);return appInstance.stage===3;}''')
            assert page.locator('#narrative-box').is_visible()
            assert not page.locator('#finale-layer').is_visible()
            check_scene(page,width,height,3)
            page.emulate_media(reduced_motion='reduce')
            page.wait_for_timeout(700)
            snapshot = page.evaluate('JSON.stringify([appInstance.eve.group.position,appInstance.eve.head.rotation,appInstance.eve.arms[0].rotation,appInstance.scene3d.seasonWorld.time])')
            page.wait_for_timeout(250)
            assert snapshot == page.evaluate('JSON.stringify([appInstance.eve.group.position,appInstance.eve.head.rotation,appInstance.eve.arms[0].rotation,appInstance.scene3d.seasonWorld.time])'), 'Reduced motion must stop decorative motion'
            page.locator('#audio-toggle').click()
            page.wait_for_timeout(200)
            assert page.evaluate('!appInstance.audioManager.isPlaying && appInstance.audioManager.audioElement.paused')
            page.locator('#audio-toggle').click()
            page.wait_for_timeout(300)
            assert page.evaluate('appInstance.audioManager.isPlaying')
            assert page.locator('#audio-toggle').get_attribute('aria-pressed') == 'true'
            assert not errors, errors
            results.append({'viewport':name,'stages':6,'fullRollRadians':round(max_roll,3),'handGap':round(gap,5),
                            'touchAndDelivery':True,'interruptAndReverse':True,'reducedMotion':True,'audioControls':True,'errors':errors})
            print(json.dumps(results[-1]),flush=True)
            context.close()
        browser.close()
    (out/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps(results,indent=2))
