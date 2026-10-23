"""Exercise the real Wall-E inside the existing six-stage experience."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(tempfile.gettempdir()) / '20-10-season-polish'))
args = parser.parse_args()
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
results = []


def robot_points(page):
    return page.evaluate('''() => {
        const w=appInstance.wallE, camera=appInstance.scene3d.camera;
        const screen = object => {
            const p=object.getWorldPosition(new THREE.Vector3()).project(camera);
            return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
        };
        return {head:screen(w.head),body:screen(w.body)};
    }''')


def check_visibility(page, width, height):
    points = robot_points(page)
    bounds = page.evaluate('''() => {
        const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
        const point=new THREE.Vector3();
        appInstance.wallE.group.traverseVisible(mesh => {
            const positions=mesh.geometry?.attributes.position;
            if (!positions) return;
            for (let i=0;i<positions.count;i++) {
                point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).project(appInstance.scene3d.camera);
                const x=(point.x+1)*innerWidth/2,y=(1-point.y)*innerHeight/2;
                bounds.left=Math.min(bounds.left,x); bounds.right=Math.max(bounds.right,x);
                bounds.top=Math.min(bounds.top,y); bounds.bottom=Math.max(bounds.bottom,y);
            }
        });
        return bounds;
    }''')
    assert bounds['left'] >= 0 and bounds['right'] <= width, bounds
    assert bounds['top'] >= 0 and bounds['bottom'] <= height, bounds
    blockers = page.locator('#narrative-box, #vinyl-dock, .top-hud > div').evaluate_all('''elements =>
        elements.filter(e => getComputedStyle(e).display !== 'none').map(e => {
            const r=e.getBoundingClientRect();
            return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
        })''')
    for part, point in points.items():
        assert 0 < point['x'] < width and 0 < point['y'] < height, (part, point)
        assert not any(r['left'] <= point['x'] <= r['right'] and
                       r['top'] <= point['y'] <= r['bottom'] for r in blockers), (part, point, blockers)
    if page.evaluate('appInstance.stage === 6'):
        for point in points.values():
            assert not page.locator('.grassy-hill-svg path').evaluate_all('''(paths, point) =>
                paths.some(path => path.isPointInFill(new DOMPoint(point.x,point.y).matrixTransform(path.getScreenCTM().inverse())))''', point), 'Hill must not hide Wall-E'
    return points


def touch_robot(page, points, stage, mobile):
    body = points['body']
    page.evaluate('window.robotClick = null')
    if mobile:
        page.touchscreen.tap(body['x'], body['y'])
    else:
        page.mouse.click(body['x'], body['y'])
    response = page.evaluate('window.robotClick')
    assert response and response['stage'] == stage, ('Touching Wall-E must not skip the scene', response)
    assert response['waveTime'] == 0, ('Wall-E must wave back', response)


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for name, width, height in [('desktop', 1440, 900), ('mobile', 390, 844), ('small-mobile', 360, 640),
                                ('tiny-mobile', 320, 568), ('landscape', 844, 390)]:
        context = browser.new_context(viewport={'width': width, 'height': height},
                                      is_mobile=name != 'desktop', has_touch=name != 'desktop')
        page = context.new_page()
        errors = []
        startup_warnings = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: startup_warnings.append(message.text) if message.type in ['error','warning'] else None)
        page.goto('http://127.0.0.1:3000/', wait_until='networkidle')
        try:
            page.wait_for_function('() => (!!window.appInstance?.wallE)', timeout=5000)
        except Exception:
            print(json.dumps({'viewport':name,'startupWarnings':startup_warnings,'errors':errors,
                              'fallback':page.locator('#greeting-fallback').is_visible()}),flush=True)
            raise
        page.evaluate('''window.addEventListener('click', () => {
            window.robotClick = {stage:appInstance.stage,waveTime:appInstance.wallE.waveTime};
        })''')
        assert page.locator('.sky-layer').count() == 6
        assert page.locator('#narrative-box').is_visible()
        assert 'Tiny' not in page.locator('body').inner_text()
        page.wait_for_timeout(600)
        points = check_visibility(page, width, height)
        page.screenshot(path=str(out / f'{name}-cosmic.png'))

        if name == 'desktop':
            page.mouse.move(250, 430)
            page.wait_for_timeout(500)
            left = page.evaluate('appInstance.wallE.head.rotation.y')
            page.mouse.move(1160, 430)
            page.wait_for_timeout(500)
            right = page.evaluate('appInstance.wallE.head.rotation.y')
            assert right - left > 0.2, 'Head must follow the real pointer'
            points = check_visibility(page, width, height)
        touch_robot(page, points, 1, name != 'desktop')

        for stage in range(2, 7):
            page.wait_for_timeout(750)
            page.mouse.wheel(0, 400)
            page.wait_for_function(f'appInstance.stage === {stage}')
            page.wait_for_function('() => (!appInstance.sceneTransition.active)')
            assert page.evaluate('appInstance.wallE.group.visible')
            points = check_visibility(page, width, height)
            if stage < 6:
                touch_robot(page, points, stage, name != 'desktop')
            if stage == 2:
                world = page.evaluate('''() => ({name:appInstance.scene3d.seasonWorld.groups[0].name,
                    opacity:appInstance.scene3d.seasonWorld.groups[0].material.opacity,
                    assets:[...document.querySelectorAll('.season-scenery img')].every(i=>i.complete&&i.naturalWidth>0)})''')
                assert world['name'] == 'spring' and world['opacity'] > 0.9 and world['assets'], world
                page.wait_for_timeout(2600)
                assert page.evaluate('appInstance.wallE.attention') == 'butterfly'
                page.screenshot(path=str(out / f'{name}-spring.png'))
            if stage == 5:
                assert page.evaluate('appInstance.scene3d.seasonWorld.groups[3].material.opacity > 0.9')
                page.screenshot(path=str(out / f'{name}-winter.png'))
        assert page.evaluate('appInstance.wallE.emotion') == 'sleep'
        assert page.evaluate('!appInstance.wallE.heartMesh.visible')
        page.screenshot(path=str(out / f'{name}-finale.png'))
        if name == 'desktop':
            # Interrupt the phase handoff; only the latest scene may own the text/world.
            page.evaluate('appInstance.goToStage(2)')
            page.wait_for_timeout(100)
            page.evaluate('appInstance.goToStage(5)')
            page.wait_for_timeout(100)
            page.evaluate('appInstance.goToStage(3)')
            page.wait_for_function('() => (appInstance.stage===3 && !appInstance.sceneTransition.active)')
            assert 'MÙA HẠ' in page.locator('#dialogue-title').inner_text().upper()
            assert page.evaluate('appInstance.scene3d.seasonWorld.currentStage') == 3
            assert page.evaluate('appInstance.scene3d.targetCameraLookAt.y') == 0
            page.evaluate('appInstance.goToStage(4)')
            page.wait_for_function('() => (appInstance.stage===4)')
            page.wait_for_timeout(220)
            assert page.evaluate('''(() => {const g=appInstance.scene3d.seasonWorld.groups;
                return g[1].material.opacity>0.05 && g[2].material.opacity>0.05 && g[2].material.opacity<0.92;})()''')
            page.wait_for_function('() => (!appInstance.sceneTransition.active)')
            page.mouse.wheel(0, -400)
            page.wait_for_function('() => (appInstance.stage===3 && !appInstance.sceneTransition.active)')
            assert 'MÙA HẠ' in page.locator('#dialogue-title').inner_text().upper()
        assert not errors, errors
        results.append({'viewport': name, 'sixStages': True, 'modelBounds': True, 'pageErrors': errors})
        context.close()

    context = browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    page = context.new_page()
    page.goto('http://127.0.0.1:3000/', wait_until='networkidle')
    page.wait_for_function('() => (!!window.appInstance?.wallE)')
    page.mouse.move(50, 400)
    page.wait_for_timeout(150)
    before = page.evaluate('appInstance.wallE.head.rotation.y')
    page.mouse.move(1400, 400)
    page.wait_for_timeout(200)
    assert page.evaluate('appInstance.wallE.head.rotation.y') == before
    assert page.evaluate('appInstance.wallE.motion.roll') == 0
    old = page.evaluate('appInstance.scene3d.seasonWorld.time')
    page.evaluate('appInstance.goToStage(4)')
    page.wait_for_timeout(400)
    assert page.evaluate('appInstance.scene3d.seasonWorld.time') == old
    assert page.evaluate('appInstance.scene3d.camera.position.z') == 25
    results.append({'robotReducedMotion': True})
    context.close()
    browser.close()

(out / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))
