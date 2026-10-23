"""Observe the real idle clock, then interrupt the gesture using actual mouse/touch input."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(tempfile.gettempdir()) / '20-10-rose-input'))
out = Path(parser.parse_args().output)
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome',headless=True)
    page = browser.new_page(viewport={'width':1440,'height':900},has_touch=True)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:3000/',wait_until='networkidle')
    page.wait_for_function('() => (window.appInstance?.roseGift)')
    page.evaluate('''()=>{
        window.live={started:false,complete:false,waves:0,dualGreeting:false,trace:[]};
        const a=appInstance;let previousWave=a.wallE.waveTime;
        const sample=()=>{
            const g=a.roseGift,w=a.wallE,e=a.eve;
            if(w.waveTime<previousWave-.5 && w.time>4)live.waves++;
            if(w.time>4 && !g.active && !w.handHoldProgress && w.swimState==='none'
                && w.waveTime<2.4 && w.arms.every(arm=>arm.rotation.x<-.65))live.dualGreeting=true;
            previousWave=w.waveTime;
            if(g.active){
                live.started=true;
                w.group.updateWorldMatrix(true,true);e.group.updateWorldMatrix(true,true);
                const project=p=>{p.project(a.scene3d.camera);return [(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2];};
                const tip=g.rose.localToWorld(new THREE.Vector3(0,.8,0));
                live.trace.push({t:g.time,wall:project(w.head.getWorldPosition(new THREE.Vector3())),
                    eve:project(e.head.getWorldPosition(new THREE.Vector3())),rose:project(tip),
                    wallBlush:w.blushOpacity,eveBlush:e.blushOpacity,owner:g.cue.owner,
                    kiss:g.cue.kiss,joy:g.cue.joy,visible:g.rose.visible});
            }else if(live.started){live.complete=true;return;}
            requestAnimationFrame(sample);
        };requestAnimationFrame(sample);
    }''')
    page.wait_for_function('() => (live.started)',timeout=65000)
    for time,label in [(5.8,'offer'),(8.2,'accepted'),(11.9,'kiss'),(16,'joy')]:
        page.wait_for_function('time=>appInstance.roseGift.time>=time',arg=time,timeout=25000)
        page.screenshot(path=str(out/f'natural-{label}.png'))
    page.wait_for_function('() => (live.complete)',timeout=15000)
    live=page.evaluate('live')
    assert live['waves']>=1, 'WALL-E never repeated his greeting while idle'
    assert live['dualGreeting'], 'Periodic greeting never raised both arms'
    assert any(s['visible'] and s['owner']=='eve' for s in live['trace']), 'EVE never received the rose'
    assert max(s['wallBlush'] for s in live['trace'])>.95 and max(s['eveBlush'] for s in live['trace'])>.95
    assert any(s['kiss']>.99 for s in live['trace']) and any(s['joy']>.99 for s in live['trace'])
    speeds={}
    for key in ['wall','eve','rose']:
        speeds[key]=max(sum((a-b)**2 for a,b in zip(right[key],left[key]))**.5/(right['t']-left['t'])
            for left,right in zip(live['trace'],live['trace'][1:]) if .008<right['t']-left['t']<.12)
        assert speeds[key]<650, ('Live motion discontinuity',key,speeds[key])
    page.wait_for_timeout(800)
    assert page.evaluate('!appInstance.roseGift.rose.visible && !appInstance.wallE.giftPose && !appInstance.eve.giftPose')
    assert page.evaluate('!appInstance.wallE.isHoldingHands && !appInstance.eve.isScanning'), 'Return must leave a quiet interval before the next ambient gesture'
    assert page.evaluate('appInstance.scene3d.scene.children.filter(o=>o.name==="gift-rose").length===1')

    def prepare_gift(time):
        page.emulate_media(reduced_motion='reduce')
        page.locator('.step-node[data-stage="1"]').click()
        page.locator('.step-node[data-stage="2"]').click()
        page.wait_for_timeout(150)
        page.emulate_media(reduced_motion='no-preference')
        page.evaluate('''time=>{
            const a=appInstance,g=a.roseGift;
            a.ambientTimer=g.wait=Infinity;
            a.wallE.motion.spinWait=a.eve.motion.spinWait=Infinity;
            if(!g.start())throw Error('Cannot restart gift from rest');
            for(let t=0;t<time;t+=1/60){g.prepare(1/60);a.wallE.update(1/60);a.eve.update(1/60);g.apply(1/60);}
        }''',time)

    interruptions=[]
    for time in [4,7.8,11.9,16]:
        prepare_gift(time)
        point=page.evaluate('''()=>{
            const a=appInstance,v=a.wallE.body.getWorldPosition(new THREE.Vector3()).project(a.scene3d.camera);
            window.cancelTrace=[];const started=performance.now();
            const sample=()=>{
                cancelTrace.push({t:a.wallE.time,points:[a.wallE,a.eve].map(r=>{
                    const p=r.head.getWorldPosition(new THREE.Vector3()).project(a.scene3d.camera);
                    return [(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2];
                })});
                if(performance.now()-started<1400 || (a.roseGift.active && a.roseGift.cancelled))requestAnimationFrame(sample);
            };sample();
            return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2];
        }''')
        page.touchscreen.tap(*point)
        assert page.evaluate('appInstance.stage===2 && appInstance.roseGift.cancelled && appInstance.wallE.clickStreak>0'),time
        page.wait_for_function('() => (!appInstance.roseGift.active && !appInstance.roseGift.rose.visible)',timeout=4000)
        assert page.evaluate('!appInstance.roseGift.active && !appInstance.roseGift.rose.visible'),time
        assert page.evaluate('appInstance.roseGift.cancelTime>=1.2 && appInstance.roseGift.cancelTime<1.31'), 'Gift cancellation must take 1.2 seconds of animation time'
        trace=page.evaluate('cancelTrace')
        (out/f'cancel-{time}.json').write_text(json.dumps(trace),encoding='utf-8')
        speed=max(sum((a-b)**2 for a,b in zip(right['points'][i],left['points'][i]))**.5/(right['t']-left['t'])
            for left,right in zip(trace,trace[1:]) for i in range(2) if .008<right['t']-left['t']<.12)
        assert speed<650,('Touch cancellation jumps',time,speed)
        interruptions.append({'time':time,'maxPixelsPerSecond':speed})

    for time in [7.8,11.9]:
        prepare_gift(time)
        point=page.evaluate('''()=>{
            const a=appInstance,v=a.eve.body.getWorldPosition(new THREE.Vector3()).project(a.scene3d.camera);
            return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2];
        }''')
        page.mouse.click(*point)
        assert page.evaluate('appInstance.stage===2 && appInstance.roseGift.cancelled && appInstance.eve.isHoldingHands'),time
        page.wait_for_function('() => (!appInstance.roseGift.active)',timeout=4000)
        assert page.evaluate('!appInstance.roseGift.active && appInstance.eve.isHoldingHands'),time
        assert page.evaluate('appInstance.roseGift.cancelTime>=1.2 && appInstance.roseGift.cancelTime<1.31'), 'Gift cancellation must take 1.2 seconds of animation time'

    prepare_gift(11.9)
    page.locator('.step-node[data-stage="6"]').click()
    page.wait_for_function('() => (appInstance.stage===6 && !appInstance.sceneTransition.active)')
    assert page.evaluate('!appInstance.roseGift.active && !appInstance.roseGift.rose.visible && appInstance.wallE.emotion==="sleep" && appInstance.eve.emotion==="sleep"')
    prepare_gift(8)
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_timeout(150)
    assert page.evaluate('!appInstance.roseGift.active && !appInstance.wallE.giftPose && !appInstance.eve.giftPose')

    # Both arms keep waving during the actual repeated-touch escape.
    page.emulate_media(reduced_motion='no-preference')
    page.wait_for_timeout(100)
    for _ in range(4):
        point=page.evaluate('''()=>{
            const a=appInstance,v=a.wallE.body.getWorldPosition(new THREE.Vector3()).project(a.scene3d.camera);
            return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2];
        }''')
        page.mouse.click(*point)
        page.wait_for_timeout(90)
    assert page.evaluate('appInstance.wallE.swimState==="shoo" && appInstance.stage===2')
    page.wait_for_timeout(900)
    arms=[]
    for index in range(12):
        arms.append(page.evaluate('appInstance.wallE.arms.map(a=>[a.rotation.x,a.rotation.y,a.rotation.z])'))
        page.wait_for_timeout(100)
        if index==4:page.screenshot(path=str(out/'two-hand-escape.png'))
    for index in range(2):
        assert max(s[index][2] for s in arms)-min(s[index][2] for s in arms)>.05, ('Hand stops waving',index)
        assert min(s[index][0] for s in arms)<-.65, ('Hand never raised',index)
    assert not errors,errors
    report={'unforcedCycle':True,'greetings':live['waves'],'dualGreeting':live['dualGreeting'],'samples':len(live['trace']),
        'maxPixelsPerSecond':speeds,'touchInterruptions':interruptions,'sleepAndReducedMotion':True,'bothHandsWave':True,'errors':errors}
    (out/'live-trace.json').write_text(json.dumps(live),encoding='utf-8')
    (out/'input-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))
    browser.close()
