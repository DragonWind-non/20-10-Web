"""Read seasonal poems and long wishes without losing access to the 3D scene."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(tempfile.gettempdir()) / '20-10-season-wishes'))
out = Path(parser.parse_args().output)
out.mkdir(parents=True, exist_ok=True)

POEMS = {
    2: 'Xuân về hoa nở đầu thềm,\nChúc em cười nhẹ, lòng êm dịu dàng.',
    3: 'Hạ sang nắng rót mênh mang,\nCó anh che nắng, em càng rạng ngời.',
    4: 'Thu về gió nhẹ chơi vơi,\nLá vàng đầu ngõ, em ơi, bình yên.',
    5: 'Đông sang gió lạnh triền miên,\nTay anh ủ ấm cho duyên mình dài.'
}

ENDS = {
    2: 'sẽ nở dần theo từng ngày.',
    3: 'Phần nắng còn lại, anh xin che giúp em.',
    4: 'dù ngoài kia có ồn ào đến đâu.',
    5: 'em chưa bao giờ phải đi một mình.'
}


def overlap(a,b):
    return a['left']<b['right'] and a['right']>b['left'] and a['top']<b['bottom'] and a['bottom']>b['top']

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome',headless=True)
    page = browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce',has_touch=True)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:3000/',wait_until='networkidle')
    page.wait_for_function('() => (window.appInstance?.eve)')
    page.locator('.step-node[data-stage="2"]').click()
    page.wait_for_timeout(250)
    assert page.locator('#dialogue-text .season-poem').count()==1, 'Seasonal poem is missing'
    assert page.locator('#dialogue-text .season-wish').count()==1, 'Long seasonal wish is missing'
    results=[]
    for name,width,height in [('desktop',1440,900),('small-desktop',1024,768),('mobile',390,844),('tiny',320,568),('landscape',844,390),('small-landscape',667,375)]:
        page.set_viewport_size({'width':width,'height':height})
        for stage in range(2,6):
            page.locator(f'.step-node[data-stage="{stage}"]').click()
            page.wait_for_timeout(350)
            assert page.locator('.season-poem').inner_text()==POEMS[stage],(name,stage)
            assert page.locator('.season-wish').inner_text().endswith(ENDS[stage]),(name,stage)
            assert page.locator('.season-wish').count()==1
            box=page.locator('#narrative-box').evaluate('el=>el.getBoundingClientRect().toJSON()')
            blockers=page.locator('#season-stepper, .top-hud, #vinyl-dock').evaluate_all('els=>els.map(e=>e.getBoundingClientRect().toJSON())')
            assert 0<=box['left']<box['right']<=width and 0<=box['top']<box['bottom']<height,(name,stage,box)
            assert not any(overlap(box,b) for b in blockers),(name,stage,'Card blocks controls',box,blockers)
            if name=='desktop':
                assert 560<=box['width']<=600,box
            if name in ['mobile','tiny']:
                assert width-50<=box['width']<=width-40 and box['height']<=height*.35,box
            text=page.locator('#dialogue-text')
            assert text.evaluate('el=>el.clientHeight>=parseFloat(getComputedStyle(el).lineHeight)*2'),('Wish reading area is too short',name,stage)
            assert text.evaluate('el=>el.scrollWidth<=el.clientWidth+1'),'Text overflows horizontally'
            assert text.evaluate('el=>el.scrollTop')==0,'New season must start at the top'
            page.screenshot(path=str(out/f'{name}-{stage}.png'))
            if text.evaluate('el=>el.scrollHeight>el.clientHeight+2'):
                text.hover()
                page.mouse.wheel(0,500)
                page.wait_for_timeout(180)
                assert page.evaluate('appInstance.stage')==stage,'Reading with the wheel changed the season'
                assert text.evaluate('el=>el.scrollTop')>0,'Long wish cannot be scrolled'
                text.focus()
                page.keyboard.press('Home')
                page.keyboard.press('ArrowDown')
                page.wait_for_timeout(100)
                assert page.evaluate('appInstance.stage')==stage,'Arrow-key reading changed the season'
                page.keyboard.press('PageDown')
                page.wait_for_timeout(120)
                assert page.evaluate('appInstance.stage')==stage,'Keyboard reading changed the season'
                assert text.evaluate('el=>el.scrollTop')>0,'Keyboard cannot scroll the wish'
            text.click(position={'x':8,'y':8})
            assert page.evaluate('appInstance.stage')==stage,'Selecting wish text changed the season'
            page.locator('#dialogue-title').hover()
            page.mouse.wheel(0,100)
            page.wait_for_timeout(120)
            assert page.evaluate('appInstance.stage')==stage,'Wheel near the card heading changed the season'
            if name=='mobile':
                text.evaluate('el=>el.scrollTop=0')
                rect=text.bounding_box()
                cdp=page.context.new_cdp_session(page)
                x=rect['x']+rect['width']/2
                y=rect['y']+rect['height']-10
                cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
                for step in range(1,5):
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-step*20}]})
                    page.wait_for_timeout(30)
                cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                page.wait_for_timeout(180)
                assert page.evaluate('appInstance.stage')==stage,'Swiping the wish changed the season'
                assert text.evaluate('el=>el.scrollTop')>0,'Touch cannot scroll the wish'
                cdp.detach()
            point=page.evaluate('''()=>{
                const a=appInstance,v=a.wallE.body.getWorldPosition(new THREE.Vector3()).project(a.scene3d.camera);
                return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
            }''')
            assert not (box['left']<=point['x']<=box['right'] and box['top']<=point['y']<=box['bottom']),(name,stage,'Robot behind the wish')
            last_click=page.evaluate('appInstance.wallE.lastClickTime')
            page.touchscreen.tap(point['x'],point['y'])
            assert page.evaluate('appInstance.stage')==stage,'Card prevents interaction with WALL-E'
            assert page.evaluate('appInstance.wallE.lastClickTime')>last_click,('WALL-E did not receive the touch',name,stage,point)
            results.append({'viewport':name,'stage':stage,'width':round(box['width']),'height':round(box['height']),'readingAndRobotTouch':True})
        page.locator('.step-node[data-stage="1"]').click()
        page.wait_for_timeout(250)
        assert page.locator('.season-poem, .season-wish').count()==0,'Seasonal additions leaked into the opening'
        assert not page.locator('#narrative-box').evaluate('el=>el.classList.contains("season-wishes")')
        page.locator('.step-node[data-stage="6"]').click()
        assert not page.locator('#narrative-box').is_visible()
        for poem in POEMS.values():
            assert poem not in page.locator('#wishes-stream-container').inner_text(),'Seasonal additions leaked into the finale'
    assert not errors,errors
    (out/'results.json').write_text(json.dumps({'cases':results,'errors':errors},indent=2),encoding='utf-8')
    print(json.dumps(results))
    browser.close()
