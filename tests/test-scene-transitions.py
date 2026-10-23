"""Verify the visible handoff and moving glass selection, not just final classes."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--output',default=str(Path(tempfile.gettempdir())/'20-10-v2'))
out=Path(parser.parse_args().output)
out.mkdir(parents=True,exist_ok=True)
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome',headless=True)
    for name,width,height in [('desktop',1440,900),('mobile',390,844),('tiny',320,568)]:
        page = browser.new_page(viewport={'width':width,'height':height})
        errors = []
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:3000/',wait_until='networkidle')
        page.wait_for_function('() => (window.appInstance?.eve && document.querySelectorAll(".scene-backdrop").length===6)')
        assert page.locator('.scene-backdrop').evaluate_all('images=>images.length===6 && images.every(image=>image.complete && image.naturalWidth>=1280)')
        page.evaluate('appInstance.goToStage(2)')
        page.wait_for_function('() => (appInstance.stage===2 && !appInstance.sceneTransition.active)')
        page.screenshot(path=str(out/f'review-{name}.png'))
        old_selection = page.locator('#season-stepper').evaluate('el=>getComputedStyle(el,"::before").transform')
        page.locator('.step-node[data-stage="3"]').click()
        page.wait_for_function('() => (appInstance.stage===3)')
        swap_opacity = page.evaluate('''()=>{
            const animation=appInstance.phaseAnimation;
            animation.pause();
            animation.currentTime=180;
            const opacity=Number(getComputedStyle(document.getElementById('narrative-box')).opacity);
            animation.play();
            // Inspect an actual middle frame without depending on compositor startup speed.
            for(const layer of appInstance.animeSky.layers)if(layer.passageAnimation){
                layer.passageAnimation.pause();layer.passageAnimation.currentTime=400;
            }
            return opacity;
        }''')
        assert swap_opacity < .02, 'Story content must change while its card is faded out'
        page.wait_for_timeout(240)
        midpoint = page.evaluate('''()=>({
            outgoing:Number(getComputedStyle(document.querySelector('.sky-stage-2')).opacity),
            incoming:Number(getComputedStyle(document.querySelector('.sky-stage-3')).opacity),
            coverage:1-appInstance.animeSky.layers.reduce((alpha,layer)=>{
                const style=getComputedStyle(layer);
                return style.visibility==='hidden'?alpha:alpha*(1-Number(style.opacity));
            },1),
            transform:getComputedStyle(document.querySelector('.sky-stage-3')).transform,
            filter:getComputedStyle(document.querySelector('#webgl-canvas')).filter,
            canvasOpacity:Number(getComputedStyle(document.querySelector('#webgl-canvas')).opacity),
            selection:getComputedStyle(document.querySelector('#season-stepper'),'::before').transform
        })''')
        assert 0 < midpoint['outgoing'] <= 1 and 0 < midpoint['incoming'] < 1, midpoint
        assert midpoint['coverage']>.99, ('The dissolve exposes the dark base',midpoint)
        assert midpoint['transform'] not in ['none','matrix(1, 0, 0, 1, 0, 0)'], midpoint
        assert midpoint['filter']=='none' and midpoint['canvasOpacity']>.99, midpoint
        card=page.locator('#narrative-box').bounding_box()
        assert 0<=card['x'] and card['x']+card['width']<=width+.1,('Story must retain its horizontal centering',card)
        assert midpoint['selection'] != old_selection, 'The selection must travel between seasons'
        page.screenshot(path=str(out/f'review-{name}-transition.png'))
        page.evaluate('appInstance.goToStage(5);appInstance.goToStage(2);appInstance.goToStage(4)')
        page.wait_for_function('() => (appInstance.stage===4 && !appInstance.sceneTransition.active)')
        assert page.evaluate('appInstance.stage===4 && document.body.dataset.stage==="4"')
        assert page.locator('.sky-layer.active').count() == 1
        assert page.locator('.sky-stage-4').evaluate('el=>Number(getComputedStyle(el).opacity)>.99')
        assert page.locator('.sky-stage-3').evaluate('el=>getComputedStyle(el).visibility==="hidden"')
        page.emulate_media(reduced_motion='reduce')
        page.evaluate('appInstance.goToStage(5)')
        page.wait_for_timeout(450)
        assert page.locator('.sky-stage-5').evaluate('el=>Number(getComputedStyle(el).opacity)>.99 && getComputedStyle(el).filter==="none"')
        page.screenshot(path=str(out/f'review-{name}-winter.png'))
        assert not errors, errors
        results.append({'viewport':name,'directionalCrossfade':True,'clearCharacters':True,'movingSelection':True,'rapidInput':True,'reducedMotion':True})
        page.close()
    browser.close()
(out/'transition-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
