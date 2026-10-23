"""Observe full model bounds throughout actual inertial rolls, resize and motion preference changes."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(tempfile.gettempdir()) / '20-10-season-motion'))
out = Path(parser.parse_args().output)
out.mkdir(parents=True, exist_ok=True)
results = []


def bounds(page):
    return page.evaluate('''() => {
        const b={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
        const p=new THREE.Vector3();
        appInstance.wallE.group.traverseVisible(mesh=>{
            const a=mesh.geometry?.attributes.position;if(!a)return;
            for(let i=0;i<a.count;i++){
                p.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld).project(appInstance.scene3d.camera);
                const x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;
                b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);
                b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);
            }
        });return b;
    }''')


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for name, width, height in [('desktop',1440,900),('tiny',320,568),('landscape',844,390)]:
        page = browser.new_page(viewport={'width':width,'height':height})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:3000/', wait_until='networkidle')
        page.evaluate('appInstance.goToStage(2)')
        page.wait_for_function('() => (appInstance.stage===2 && !appInstance.sceneTransition.active)')
        page.evaluate('appInstance.ambientTimer=appInstance.roseGift.wait=Infinity;appInstance.wallE.motion.spinWait=0.01')
        max_roll = 0
        for frame in range(24):
            page.wait_for_timeout(750)
            b = bounds(page)
            assert b['left'] >= 0 and b['right'] <= width and b['top'] >= 0 and b['bottom'] <= height, (name,frame,b)
            card = page.locator('#narrative-box').bounding_box()
            assert b['top'] > card['y'] + card['height'] or b['left'] > card['x'] + card['width'], (name,frame,b,card)
            roll = abs(page.evaluate('appInstance.wallE.motion.roll'))
            max_roll = max(max_roll,roll)
            if 2.5 < roll < 4:
                page.screenshot(path=str(out / f'{name}-full-roll.png'))
            if max_roll > 5.5:
                break
        state = page.evaluate('({time:appInstance.wallE.time,holding:appInstance.wallE.handHoldProgress,spin:appInstance.wallE.motion.spinTime,wait:appInstance.wallE.motion.spinWait,duration:appInstance.wallE.motion.spinDuration,gift:appInstance.roseGift.active,emotion:appInstance.wallE.emotion})')
        assert max_roll > 5.5, (name,max_roll,state)
        page.evaluate('appInstance.wallE.motion.spinWait=0.01')
        page.wait_for_timeout(1800)
        page.set_viewport_size({'width':390,'height':844})
        page.wait_for_timeout(1100)
        b = bounds(page)
        assert b['left'] >= 0 and b['right'] <= 390 and b['top'] >= 0 and b['bottom'] <= 844, b
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_timeout(200)
        assert page.evaluate('appInstance.wallE.motion.roll') == 0
        assert page.evaluate('appInstance.wallE.motion.position.x') == 0
        before = page.evaluate('appInstance.scene3d.seasonWorld.time')
        page.wait_for_timeout(180)
        assert page.evaluate('appInstance.scene3d.seasonWorld.time') == before
        assert not errors, errors
        results.append({'viewport':name,'rollMaxRadians':round(max_roll,3),'boundsAndCardClear':True,'resizeAndReducedMotion':True})
        page.close()
    browser.close()
(out/'motion-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
