"""Check temporal continuity; screenshots and endpoint contact alone miss snapping."""
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(tempfile.gettempdir()) / '20-10-v2'
out.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:3000/', wait_until='networkidle')
    page.evaluate('appInstance.goToStage(2)')
    page.wait_for_function('() => (appInstance.stage===2 && !appInstance.sceneTransition.active)')
    page.mouse.move(250,480)
    page.wait_for_timeout(650)
    left = page.evaluate('appInstance.eve.head.rotation.y')
    page.mouse.move(1250,480)
    page.wait_for_timeout(650)
    right = page.evaluate('appInstance.eve.head.rotation.y')
    assert right-left > .2, 'Ambient butterflies must not override EVE responding to the pointer'
    page.evaluate('''() => {
        window.motionSamples=[];
        const a=appInstance;
        a.wallE.triggerHoldHands(1.3);
        const sample=time=>{
            const project=object=>{
                const p=object.getWorldPosition(new THREE.Vector3()).project(a.scene3d.camera);
                return [(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2];
            };
            motionSamples.push({t:time,wallClock:performance.now(),w:a.wallE.handHoldProgress,e:a.eve.handHoldProgress,
                wall:project(a.wallE.body),eve:project(a.eve.body),spin:a.eve.spinAngle});
            if(motionSamples.length<320)requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
    }''')
    page.wait_for_function('() => (motionSamples.length===320)', timeout=15000)
    samples = page.evaluate('motionSamples')
    (out/'continuity-samples.json').write_text(json.dumps(samples),encoding='utf-8')
    max_speed, max_step, max_gesture_speed = 0, 0, 0
    release_frames = 0
    for previous, current in zip(samples,samples[1:]):
        dt = (current['t']-previous['t']) / 1000
        if dt <= 0:
            continue
        assert current['w'] == current['e'], 'The two robot poses must share a gesture clock'
        step = abs(current['e']-previous['e'])
        max_step = max(max_step,step)
        max_gesture_speed = max(max_gesture_speed,step/dt)
        if current['e'] < previous['e'] and current['e'] > 0:
            release_frames += 1
        for robot in ['wall','eve']:
            distance = sum((a-b)**2 for a,b in zip(current[robot],previous[robot]))**0.5
            max_speed = max(max_speed,distance/dt)
    assert release_frames > 20, 'Letting go must take a visible sequence of frames'
    assert max_gesture_speed < 7, ('Gesture progress snaps relative to elapsed frame time',max_gesture_speed)
    assert max_speed < 900, ('A robot teleports on approach or release',max_speed)

    page.evaluate('appInstance.wallE.triggerHoldHands(5)')
    page.wait_for_timeout(900)
    for _ in range(4):
        body = page.evaluate('''()=>{const a=appInstance,p=a.wallE.body.getWorldPosition(new THREE.Vector3()).project(a.scene3d.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};}''')
        page.mouse.click(body['x'],body['y'])
    assert page.evaluate('appInstance.wallE.isHoldingHands && appInstance.wallE.swimState==="none"'), 'Repeated touches must not fight a partnered gesture'
    page.evaluate('appInstance.eve.triggerAcrobaticSpin()')
    assert page.evaluate('appInstance.eve.pendingSpin && !appInstance.eve.isHoldingHands')
    page.evaluate('appInstance.eve.triggerScan()')
    assert page.evaluate('appInstance.eve.isScanning && !appInstance.eve.pendingSpin && !appInstance.eve.spinTime'), 'A new scan must cancel queued acrobatics'
    page.evaluate('appInstance.goToStage(6)')
    page.wait_for_function('() => (appInstance.stage===6 && !appInstance.sceneTransition.active)')
    assert page.evaluate('appInstance.eve.emotion==="sleep" && !appInstance.eve.isScanning && !appInstance.eve.pendingSpin')
    assert not errors, errors
    result={'samples':len(samples),'releaseFrames':release_frames,'maxGestureStep':round(max_step,4),'maxGestureSpeed':round(max_gesture_speed,3),
            'maxScreenSpeed':round(max_speed,1),'interruptionAndRepeatedTouch':True,'errors':errors}
    (out/'continuity-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
    browser.close()
