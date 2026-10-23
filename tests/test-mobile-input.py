"""Use native touch input to exercise scene taps, swipes, reading and real audio."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(tempfile.gettempdir()) / '20-10-mobile-input'
out.mkdir(exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--viewport', choices=['mobile','tiny','landscape'])
args = parser.parse_args()
SCHEDULER = '''(() => {
 let callbacks=[],time;
 window.requestAnimationFrame=f=>(callbacks.push(f),callbacks.length);
 window.advance=n=>{for(let i=0;i<n;i++){
   time=(time??performance.now())+1000/30; const fs=callbacks; callbacks=[]; fs.forEach(f=>f(time));
 }};
})()'''


def swipe(session, start, end):
    session.send('Input.dispatchTouchEvent', {'type':'touchStart', 'touchPoints':[{'x':start[0],'y':start[1]}]})
    for i in range(1, 9):
        session.send('Input.dispatchTouchEvent', {'type':'touchMove', 'touchPoints':[{
            'x':start[0]+(end[0]-start[0])*i/8, 'y':start[1]+(end[1]-start[1])*i/8}]})
    session.send('Input.dispatchTouchEvent', {'type':'touchEnd', 'touchPoints':[]})


def settle(page):
    page.evaluate('advance(175)')
    page.wait_for_timeout(250)
    page.evaluate('advance(20);appInstance.ambientTimer=appInstance.pairMoments.wait=appInstance.roseGift.wait=1e6')


def go(page, stage):
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_function('() => (appInstance.motionQuery.matches)', polling=50)
    page.evaluate('(s)=>{appInstance.goToStage(s);advance(1)}', stage)
    page.wait_for_timeout(250)
    page.emulate_media(reduced_motion='no-preference')
    page.wait_for_function('() => (!appInstance.motionQuery.matches)', polling=50)
    page.evaluate('advance(40);appInstance.ambientTimer=appInstance.pairMoments.wait=appInstance.roseGift.wait=1e6')


def point(page, expression):
    return page.evaluate('''()=>{
      const a=appInstance, p='''+expression+''';
      p.project(a.scene3d.camera);return [(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2];
    }''')


results = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True,
        args=['--enable-webgl','--enable-unsafe-swiftshader'])
    for name, width, height in [('mobile',390,844),('tiny',320,568),('landscape',844,390)]:
        if args.viewport and args.viewport != name:
            continue
        context = browser.new_context(viewport={'width':width,'height':height}, is_mobile=True, has_touch=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script(SCHEDULER)
        page.goto('http://127.0.0.1:3000/', wait_until='networkidle')
        page.wait_for_function('() => (window.appInstance?.touchNavigation)', polling=50)
        page.evaluate('advance(40)')
        page.evaluate('''()=>{
          window.inputEvents=[];
          for(const type of ['pointerdown','pointerup','pointercancel'])window.addEventListener(type,
            e=>inputEvents.push([type,e.clientX,e.clientY,e.target.id,e.isPrimary]));
        }''')
        assert page.locator('#dock-track-title').inner_text() == 'Mashup In Love (5 in 1)'
        assert page.evaluate('appInstance.audioManager.playlist.length') == 2
        page.locator('#audio-toggle').tap()
        page.wait_for_function('() => (appInstance.audioManager.audioElement.currentTime > .1)', polling=50)
        assert page.evaluate('appInstance.stage===1 && appInstance.audioManager.audioElement.readyState>=2')
        page.locator('#btn-next-track').tap()
        page.wait_for_function('() => (appInstance.audioManager.currentIndex===1 && appInstance.audioManager.audioElement.currentTime>.05)', polling=50)
        page.locator('#btn-next-track').tap()
        page.wait_for_function('() => (appInstance.audioManager.currentIndex===0 && appInstance.audioManager.audioElement.currentTime>.05)', polling=50)
        page.locator('#btn-play-pause').tap()
        assert page.evaluate('!appInstance.audioManager.isPlaying && appInstance.audioManager.audioElement.paused')
        page.locator('#btn-play-pause').tap()
        page.wait_for_function('() => (appInstance.audioManager.isPlaying && !appInstance.audioManager.audioElement.paused)', polling=50)
        # A trusted fingertip tap on WALL-E must react once without advancing the scene.
        xy = point(page, 'a.wallE.body.getWorldPosition(new THREE.Vector3())')
        page.touchscreen.tap(*xy)
        assert page.evaluate('appInstance.wallE.clickStreak===1 && appInstance.stage===1 && !appInstance.sceneTransition.active'), (name,xy)
        # EVE retains her direct touch interaction.
        xy = point(page, 'a.eve.head.getWorldPosition(new THREE.Vector3())')
        page.touchscreen.tap(*xy)
        assert page.evaluate('appInstance.eve.isHoldingHands && appInstance.stage===1'), (name,xy)
        page.evaluate('appInstance.pairMoments.start();advance(50)')
        xy = point(page, 'a.wallE.body.getWorldPosition(new THREE.Vector3())')
        page.touchscreen.tap(*xy)
        assert page.evaluate('appInstance.pairMoments.returning && appInstance.stage===1'), 'Ambient choreography must yield to a tap'
        page.evaluate('advance(40)')
        page.screenshot(path=str(out/f'{name}-opening.png'))
        session = context.new_cdp_session(page)
        # The landscape discovery button occupies the old swipe start at 65% height.
        swipe_y = height * (.5 if width > height else .65)
        assert page.evaluate('([x,y]) => !document.elementFromPoint(x,y)?.closest("button, a, .vinyl-dock, #prop-toast")',
                             [width*.8, swipe_y]), 'Start the navigation swipe on the scene, away from controls'
        swipe(session, (width*.8,swipe_y), (width*.2,swipe_y))
        assert page.evaluate('appInstance.destinationStage===2 && appInstance.sceneTransition.direction===1'), name
        settle(page)
        assert page.evaluate('appInstance.stage===2 && !appInstance.sceneTransition.active')
        card = page.locator('#narrative-box').bounding_box()
        assert card['width'] <= (600 if width>768 else width-47)
        assert card['height'] <= (height-155 if width>height else min(280,height*.34))+.1
        assert page.locator('#dialogue-text').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)') >= 13
        page.screenshot(path=str(out/f'{name}-spring.png'))
        text = page.locator('#dialogue-text')
        box = text.bounding_box()
        assert text.evaluate('e=>e.scrollHeight>e.clientHeight'), (name,box)
        # Vertical gestures scroll the wish; horizontal gestures on the same card navigate.
        start = (box['x']+box['width']*.5, box['y']+box['height']*.85)
        swipe(session, start, (start[0],box['y']+3))
        page.wait_for_timeout(250)
        assert text.evaluate('e=>e.scrollTop')>0, (name,box)
        assert page.evaluate('appInstance.stage===2 && !appInstance.sceneTransition.active')
        y = box['y']+box['height']*.5
        swipe(session, (card['x']+card['width']*.8,y), (card['x']+card['width']*.2,y))
        assert page.evaluate('appInstance.destinationStage===3'), name
        settle(page)
        # Right and down move backwards; up moves forward on the 3D canvas.
        canvas_x = width*(.89 if width>height else .97)
        for start,end,stage in [((width*(.62 if width>height else .2),height*.65),(width*.88,height*.65),2),
            ((canvas_x,height*.7),(canvas_x,height*.4),3),
            ((canvas_x,height*.4),(canvas_x,height*.7),2)]:
            page.wait_for_timeout(500)
            page.evaluate('inputEvents=[]')
            swipe(session,start,end)
            if not page.evaluate('(s)=>appInstance.destinationStage===s',stage):
                page.screenshot(path=str(out/f'{name}-failed-swipe.png'))
                raise AssertionError((name,stage,page.evaluate('''()=>({stage:appInstance.stage,
                  destination:appInstance.destinationStage,queued:appInstance.queuedStage,
                  reduced:appInstance.motionQuery.matches,events:inputEvents})''')))
            settle(page)
        # A prop tap keeps the current scene and starts delivery, then its native close button works.
        for stage in [2,4]:
            go(page,stage)
            xy = point(page,'a.scene3d.seasonalProps.props[a.stage-1].group.position.clone()')
            page.touchscreen.tap(*xy)
            assert page.evaluate('appInstance.propDelivery.active'), (name,stage,xy)
            page.evaluate('advance(210)')
            page.wait_for_timeout(950)
            assert page.locator('#prop-letter').is_visible()
            assert page.locator('.letter-body p').first.inner_text() == 'Gửi các bạn nữ,'
            assert not page.locator('.letter-body').evaluate('e=>/(?<!\\p{L})(anh|em|tớ|cậu)(?!\\p{L})/iu.test(e.textContent)')
            page.locator('.letter-close').tap()
            page.evaluate('advance(55)')
            assert page.evaluate('(s)=>appInstance.stage===s && !appInstance.propDelivery.active',stage)
        assert not errors, errors
        results.append({'viewport':name,'springCard':card,'nativeTapSwipeReadingAudio':'PASS'})
        print(f'{name}: native taps, horizontal/vertical swipes, card reading, props and both audio files PASS',flush=True)
        context.close()
    browser.close()
(out/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
