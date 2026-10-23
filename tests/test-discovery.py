"""Exercise the first-visit actions with real controls and a deterministic scene clock."""
import json
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('output/discovery-review')
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--viewport', choices=['desktop','mobile','tiny','landscape'])
args = parser.parse_args()
CLOCK = '''(() => {
 const nativeFrame=window.requestAnimationFrame.bind(window);
 window.paintMediaChange=()=>new Promise(resolve=>nativeFrame(()=>nativeFrame(resolve)));
 let callbacks=[],time;
 window.requestAnimationFrame=f=>(callbacks.push(f),callbacks.length);
 window.advance=n=>{for(let i=0;i<n;i++){
   time=(time??performance.now())+1000/30;const fs=callbacks;callbacks=[];fs.forEach(f=>f(time));
 }};
})()'''

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-unsafe-swiftshader'])
    results = []
    for name, width, height in [('desktop',1440,900),('mobile',390,844),('tiny',320,568),('landscape',844,390)]:
        if args.viewport and args.viewport != name:
            continue
        page = browser.new_page(viewport={'width':width,'height':height}, has_touch=True)
        page.set_default_timeout(12000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script(CLOCK)
        page.goto('http://127.0.0.1:3000/', wait_until='networkidle')
        page.wait_for_function('() => (window.appInstance?.roseGift)')
        page.wait_for_timeout(220)
        page.evaluate('advance(45)')
        assert page.locator('#rose-moment').is_visible(), 'First visitors need a visible flower action'
        assert page.locator('#prop-discover').is_visible(), 'The 3D object needs an explicit tap label'
        for selector in ['#rose-moment', '#pair-moment', '#prop-discover']:
            assert page.locator(selector).bounding_box()['height'] >= 44, (name, selector)

        def check_layout(stage):
            page.evaluate('paintMediaChange()')
            state = page.evaluate('''() => {
                const box=document.getElementById('prop-discover').getBoundingClientRect().toJSON();
                const blockers=['narrative-box','vinyl-dock','season-stepper','lyric-hud'].map(id=>document.getElementById(id))
                  .filter(e=>getComputedStyle(e).display!=='none' && getComputedStyle(e).opacity!=='0')
                  .map(e=>({id:e.id,...e.getBoundingClientRect().toJSON()}));
                return {box,blockers};
            }''')
            box=state['box']
            assert box['width'] and box['x'] >= 0 and box['x']+box['width'] <= width, (name, stage, box)
            assert box['y'] >= 0 and box['y']+box['height'] <= height, (name, stage, box)
            for blocker in state['blockers']:
                assert not (box['x'] < blocker['x']+blocker['width'] and box['x']+box['width'] > blocker['x']
                    and box['y'] < blocker['y']+blocker['height'] and box['y']+box['height'] > blocker['y']), (name, stage, box, blocker)

        check_layout(1)
        page.screenshot(path=str(OUT/f'{name}-first-visit.png'))
        # The first flower must beat the other idle gestures, even while the pointer moves.
        page.evaluate('advance(180)')
        assert page.evaluate('!appInstance.roseGift.active && !appInstance.pairMoments.active')
        page.evaluate('for(let i=0;i<30;i++){appInstance.wallE.setPointer(0,0);appInstance.eve.setPointer(0,0);advance(1)}')
        assert page.evaluate('appInstance.roseGift.active && appInstance.roseGift.time < 1'), name
        page.evaluate('advance(342)')
        assert page.evaluate('appInstance.roseGift.cue.kiss > .95 && appInstance.roseGift.cue.owner === "eve"'), name
        page.screenshot(path=str(OUT/f'{name}-kiss.png'))
        page.evaluate('advance(280)')
        assert page.evaluate('!appInstance.roseGift.active'), name
        # Activate the replay with keyboard on desktop and a real touchscreen tap elsewhere.
        if name == 'desktop':
            page.locator('#rose-moment').focus()
            page.locator('#rose-moment').press('Enter')
        else:
            page.locator('#rose-moment').tap()
        page.evaluate('advance(60)')
        assert page.evaluate('appInstance.roseGift.active && appInstance.stage === 1'), name
        assert page.locator('#pair-moment').is_disabled()

        # Reduced motion also provides a quick, real navigation path through all six scenes.
        page.emulate_media(reduced_motion='reduce')
        # Native media-query events need a real paint, independently of the scene clock.
        page.evaluate('paintMediaChange()')
        page.wait_for_function('() => (appInstance.motionQuery.matches && !appInstance.roseGift.active)', polling=50)
        page.evaluate('advance(1)')
        assert not page.evaluate('appInstance.roseGift.active')
        assert page.locator('#rose-moment').is_disabled()
        for stage, label in enumerate(['ngôi sao','chuông gió','lồng đèn','hạc giấy','cầu tuyết','đèn trời'], 1):
            page.locator(f'.step-node[data-stage="{stage}"]').click()
            page.wait_for_timeout(250)
            page.evaluate('advance(45)')
            assert page.evaluate('(s)=>appInstance.stage===s && !appInstance.sceneTransition.active', stage)
            if stage == 6:
                assert page.locator('#prop-discover').is_hidden(), 'Keep the closing wish as the main action'
                page.locator('#finale-wish').click()
                page.evaluate('advance(2)')
                assert page.locator('#prop-discover').is_hidden(), 'The finale intentionally hides the seasonal lantern'
                assert page.locator('#wishes-stream-container').is_visible()
                page.screenshot(path=str(OUT/f'{name}-stage6.png'))
                results.append({'viewport': name, 'stage': 6, 'discovery': 'closing wish'})
                print(f'{name}: closing wish and reading PASS', flush=True)
                continue
            check_layout(stage)
            assert label in page.locator('#prop-discover').inner_text(), (name, stage)
            page.screenshot(path=str(OUT/f'{name}-stage{stage}.png'))
            page.locator('#prop-discover').tap()
            page.evaluate('advance(1)')
            assert page.evaluate('(s)=>appInstance.stage===s', stage), 'A discovery click must never advance the scene'
            assert page.locator('#prop-letter').is_visible(), (name, stage)
            assert page.evaluate('(s)=>appInstance.propDelivery.prop.stage===s', stage)
            page.locator('#prop-letter').press('Escape')
            page.evaluate('advance(60)')
            assert page.evaluate('!appInstance.propDelivery.active && !appInstance.sceneTransition.active')
            assert page.evaluate('document.activeElement.id === "prop-discover"'), 'Return keyboard focus to the visible action'
            results.append({'viewport': name, 'stage': stage, 'discovery': True})
            print(f'{name}: stage {stage} label, tap and layout PASS', flush=True)
        assert not errors, (name, errors)
        page.close()
    browser.close()
    (OUT/'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'PASS: early flower, replay, keyboard/touch, reduced motion and {len(results)} scene layouts')
