"""Real Three.js axle and paired gesture checks; no mocked transforms."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(tempfile.gettempdir()) / '20-10-rose-gesture'))
out = Path(parser.parse_args().output)
out.mkdir(parents=True, exist_ok=True)

GEOMETRY = '''() => {
    const a=appInstance, camera=a.scene3d.camera;
    const bounds=root=>{
        root.updateWorldMatrix(true,true);
        const box={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
        root.traverseVisible(mesh=>{
            const positions=mesh.geometry?.attributes.position;
            if(!positions || mesh.material?.visible===false || mesh.name==='hit-proxy')return;
            for(let i=0;i<positions.count;i++){
                const v=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).project(camera);
                const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;
                box.left=Math.min(box.left,x);box.right=Math.max(box.right,x);
                box.top=Math.min(box.top,y);box.bottom=Math.max(box.bottom,y);
            }
        });return box;
    };
    return {wall:bounds(a.wallE.model),eve:bounds(a.eve.model),rose:a.roseGift.rose.visible?bounds(a.roseGift.rose):null};
}'''

ADVANCE = '''target => {
    const a=appInstance,g=a.roseGift,w=a.wallE,e=a.eve,camera=a.scene3d.camera;
    const project=p=>{p.project(camera);return [(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2];};
    while(g.active && g.time<target){
        const dt=Math.min(1/60,target-g.time);
        g.prepare(dt);w.update(dt);e.update(dt);g.apply(dt);
        w.group.updateWorldMatrix(true,true);e.group.updateWorldMatrix(true,true);
        const wallHand=w.arms[1].localToWorld(w.handTip.clone()),eveHand=e.arms[0].localToWorld(e.handTip.clone());
        const cheek=w.head.localToWorld(new THREE.Vector3(.75,-.07,.25));
        const visor=e.head.localToWorld(new THREE.Vector3(0,-.05,.72));
        roseTrace.push({time:g.time,owner:g.cue.owner,active:g.active,
            wall:project(w.head.getWorldPosition(new THREE.Vector3())),eve:project(e.head.getWorldPosition(new THREE.Vector3())),
            rose:project(g.rose.position.clone()),roseWorld:g.rose.position.toArray(),
            hands:wallHand.distanceTo(eveHand),kiss:cheek.distanceTo(visor),
            wallBlush:w.blushOpacity,eveBlush:e.blushOpacity,
            opacity:g.materials[0].opacity,weight:g.cue.weight});
    }
    a.scene3d.render();return roseTrace.at(-1);
}'''


def overlap(a, b):
    return a['left'] < b['right'] and a['right'] > b['left'] and a['top'] < b['bottom'] and a['bottom'] > b['top']

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':900}, has_touch=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:3000/', wait_until='networkidle')
    page.wait_for_function('() => (window.appInstance?.eve)')
    axle = page.evaluate('''() => {
        const w=appInstance.wallE;
        for(let i=0;i<90;i++)w.update(1/60);
        return w.wheels.map(({mesh})=>{
            const axis=new THREE.Vector3(0,1,0).applyQuaternion(mesh.quaternion);
            return {tilt:Math.hypot(axis.y,axis.z),spin:mesh.rotation.x};
        });
    }''')
    assert all(wheel['tilt'] < 1e-6 for wheel in axle), ('Roller axle tilts instead of rolling in YZ plane', axle)
    assert all(abs(wheel['spin']) > .01 for wheel in axle), ('Rollers did not turn', axle)
    results = []
    for name,width,height in [('desktop',1440,900),('mobile',390,844),('tiny',320,568),('landscape',844,390)]:
        page.evaluate('delete document.hidden')
        page.set_viewport_size({'width':width,'height':height})
        page.emulate_media(reduced_motion='reduce')
        page.locator('.step-node[data-stage="2"]').click()
        page.wait_for_timeout(650)
        page.emulate_media(reduced_motion='no-preference')
        page.evaluate('''()=>{
            const a=appInstance;
            a.ambientTimer=Infinity;a.roseGift.wait=Infinity;
            for(const r of [a.wallE,a.eve])r.motion.spinWait=Infinity;
            window.roseTrace=[];
            if(!a.roseGift.start())throw Error('Gift failed to start from rest');
            // Manual fixed steps below own the clock while screenshots are captured.
            Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
        }''')
        for time,label in [(2.5,'shy'),(3.2,'behind-back'),(5.9,'offer'),(7.8,'handoff'),(9.7,'receive'),(11.9,'kiss'),(16,'joy'),(20.5,'return')]:
            state = page.evaluate(ADVANCE,time)
            box = page.evaluate(GEOMETRY)
            blockers = page.locator('#narrative-box, #season-stepper, #vinyl-dock, .top-hud').evaluate_all('''els=>
                els.filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect().toJSON())''')
            for robot,b in box.items():
                if b is None:
                    continue
                assert 0 <= b['left'] < b['right'] <= width and 0 <= b['top'] < b['bottom'] <= height, (name,label,robot,b)
                assert not any(overlap(b,block) for block in blockers), (name,label,robot,'UI overlap',b,blockers)
            if label == 'handoff':
                assert state['owner']=='eve' and state['hands']<1e-5, state
            if label == 'kiss':
                assert state['kiss']<1e-5 and state['wallBlush']>.5 and state['eveBlush']>.8,state
            page.screenshot(path=str(out/f'{name}-{label}.png'))
        page.evaluate(ADVANCE,21.1)
        assert page.evaluate('!appInstance.roseGift.active && !appInstance.roseGift.rose.visible && !appInstance.wallE.giftPose && !appInstance.eve.giftPose')
        trace=page.evaluate('roseTrace')
        speed={}
        for object_name in ['wall','eve','rose']:
            speed[object_name]=max(sum((a-b)**2 for a,b in zip(right[object_name],left[object_name]))**.5/(right['time']-left['time'])
                for left,right in zip(trace,trace[1:]) if right['time']-left['time']>.001)
            assert speed[object_name]<650,(name,'Discontinuous movement',object_name,speed[object_name])
        handoff=next(i for i,s in enumerate(trace) if s['owner']=='eve')
        jump=sum((a-b)**2 for a,b in zip(trace[handoff]['roseWorld'],trace[handoff-1]['roseWorld']))**.5
        assert jump<.04,(name,'Rose teleported during handoff',jump)
        results.append({'viewport':name,'maxPixelsPerSecond':speed,'handoffStep':jump})
        (out/f'{name}-trace.json').write_text(json.dumps(trace),encoding='utf-8')
    assert not errors, errors
    (out/'results.json').write_text(json.dumps({'axles':axle,'results':results},indent=2),encoding='utf-8')
    print(json.dumps(results))
    browser.close()
