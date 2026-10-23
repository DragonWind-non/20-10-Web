"""Measure the rendered vinyl through camera motion, resizing and playback controls."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(tempfile.gettempdir()) / '20-10-vinyl'))
out = Path(parser.parse_args().output)
out.mkdir(parents=True, exist_ok=True)

MEASURE = """() => {
    const a=appInstance, camera=a.scene3d.camera;
    const bounds=root=>{
        const box={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
        root.updateWorldMatrix(true,true);
        root.traverseVisible(mesh=>{
            if(mesh.material?.visible===false || mesh.name==='hit-proxy')return;
            const vertices=mesh.geometry?.attributes.position;if(!vertices)return;
            for(let i=0;i<vertices.count;i++){
                const p=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld).project(camera);
                const x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;
                box.left=Math.min(box.left,x);box.right=Math.max(box.right,x);
                box.top=Math.min(box.top,y);box.bottom=Math.max(box.bottom,y);
            }
        });return box;
    };
    const blockers=[...document.querySelectorAll('#narrative-box, #season-stepper, #vinyl-dock, #lyric-hud, .top-hud')]
        .filter(el=>getComputedStyle(el).display!=='none').map(el=>({name:el.id||el.className,box:el.getBoundingClientRect().toJSON()}));
    for(const [name,root] of [['wall',a.wallE.model],['eve',a.eve.model],['prop',a.scene3d.seasonalProps.props[4].group]])
        blockers.push({name,box:bounds(root)});
    return {vinyl:bounds(a.vinylDock.vinyl3DMesh),visible:a.vinylDock.vinyl3DMesh.visible,blockers};
}"""


def check_layout(page):
    data = page.evaluate(MEASURE)
    box = data['vinyl']
    width, height = page.viewport_size['width'], page.viewport_size['height']
    assert data['visible'], 'Winter vinyl must be visible'
    assert 8 <= box['left'] < box['right'] <= width - 8, ('Vinyl clips a side', box)
    assert 8 <= box['top'] < box['bottom'] <= height - 8, ('Vinyl clips vertically', box)
    assert box['right'] - box['left'] >= 24, ('Vinyl is too small to see', box)
    for blocker in data['blockers']:
        b = blocker['box']
        overlap = box['left'] < b['right'] and box['right'] > b['left'] and box['top'] < b['bottom'] and box['bottom'] > b['top']
        assert not overlap, ('Vinyl overlaps', blocker['name'], box, b)
    return data


results, failures = [], []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for name, width, height in [('desktop',1440,900),('mobile',390,844),('tiny',320,568),('landscape',844,390),('tablet',768,1024)]:
        page = browser.new_page(viewport={'width':width,'height':height})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto('http://127.0.0.1:3000/', wait_until='networkidle')
            page.locator('.step-node[data-stage="5"]').click()
            page.wait_for_function('() => (appInstance.stage===5 && !appInstance.sceneTransition.active)')
            page.screenshot(path=str(out / f'{name}-winter.png'))
            boxes = check_layout(page)
            # Cover a full rotation and both pointer extremes while the camera moves.
            start_angle = page.evaluate('appInstance.vinylDock.vinyl3DMesh.rotation.y')
            for step in range(20):
                page.mouse.move(width - 1 if step < 10 else 1, 1 if step < 10 else height - 1)
                page.wait_for_timeout(250)
                check_layout(page)
            assert page.evaluate('appInstance.vinylDock.vinyl3DMesh.rotation.y') - start_angle >= 6.28, 'Full vinyl rotation was not observed'
            page.locator('#btn-play-pause').click()
            page.wait_for_function('() => (!appInstance.audioManager.isPlaying)')
            rotation = page.evaluate('appInstance.vinylDock.vinyl3DMesh.rotation.y')
            page.wait_for_timeout(300)
            assert rotation == page.evaluate('appInstance.vinylDock.vinyl3DMesh.rotation.y'), 'Paused vinyl keeps spinning'
            check_layout(page)
            page.locator('#btn-play-pause').click()
            page.wait_for_function('() => (appInstance.audioManager.isPlaying)')
            page.wait_for_timeout(300)
            assert rotation != page.evaluate('appInstance.vinylDock.vinyl3DMesh.rotation.y'), 'Resumed vinyl does not spin'
            page.emulate_media(reduced_motion='reduce')
            page.set_viewport_size({'width':390,'height':844})
            page.wait_for_timeout(700)
            check_layout(page)
            for stage in [6, 4, 5]:
                page.locator(f'.step-node[data-stage="{stage}"]').click()
                page.wait_for_timeout(700)
                assert page.evaluate('appInstance.vinylDock.vinyl3DMesh.visible') == (stage == 5)
            check_layout(page)
            page.emulate_media(reduced_motion='no-preference')
            for _ in range(8):
                page.wait_for_timeout(200)
                check_layout(page)
            assert not errors, errors
            results.append({'viewport':name,'bounds':boxes['vinyl'],'rotationAndPointer':True,'playback':True,'resizeAndReentry':True})
        except AssertionError as error:
            failures.append(f'{name}: {error}')
        finally:
            page.close()
    browser.close()
(out / 'vinyl-results.json').write_text(json.dumps({'results':results,'failures':failures},indent=2),encoding='utf-8')
assert not failures, '\n'.join(failures)
print(f'PASS: vinyl layout, playback and transitions across {len(results)} viewports')
