"""Keep the greeting readable when Three.js or WebGL is unavailable."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(tempfile.gettempdir()) / '20-10-fallback'))
out = Path(parser.parse_args().output)
out.mkdir(parents=True, exist_ok=True)

NO_WEBGL = """(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return /webgl/i.test(type) ? null : getContext.call(this, type, ...args);
    };
})();"""

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    results = []
    failures = []
    for mode in ['engine', 'webgl', 'normal']:
        for name, width, height in [('desktop',1440,900), ('mobile',390,844),
                                    ('tiny',320,568), ('landscape',844,390)]:
            context = browser.new_context(viewport={'width':width,'height':height},
                                          reduced_motion='reduce', has_touch=True)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            if mode == 'engine':
                page.route('**/three.min.js', lambda route: route.abort())
            elif mode == 'webgl':
                page.add_init_script(NO_WEBGL)
            try:
                page.goto('http://127.0.0.1:3000/', wait_until='networkidle')
                fallback = page.locator('#greeting-fallback')
                if mode == 'normal':
                    expect(page.locator('#btn-start-journey')).to_be_visible()
                    page.locator('#btn-start-journey').click()
                    page.wait_for_function('() => (appInstance.stage === 2)')
                    for stage in range(3,7):
                        page.locator(f'.step-node[data-stage="{stage}"]').click()
                        page.wait_for_function('(stage) => appInstance.stage === stage', arg=stage)
                    expect(page.locator('#wishes-stream-container .wish-item').first).to_be_visible()
                    expect(fallback).to_be_hidden()
                    page.screenshot(path=str(out / f'{mode}-{name}.png'))
                else:
                    expect(fallback).to_be_visible()
                    expect(page.locator('#ui-container')).to_be_hidden()
                    expect(page.locator('#webgl-canvas')).to_be_hidden()
                    expect(page.locator('#finale-layer')).to_be_hidden()
                    expect(page.locator('#fallback-title')).to_be_focused()
                    expect(page.locator('#fallback-status')).to_contain_text('thiệp')
                    config = page.evaluate("async () => (await import('/config.js')).CONFIG")
                    expect(page.locator('#fallback-recipient')).to_have_text(f"Gửi {config['recipientName']},")
                    assert page.locator('#fallback-wishes p').all_text_contents() == config['wishesStream']
                    page.screenshot(path=str(out / f'{mode}-{name}-top.png'))
                    page.keyboard.press('PageDown')
                    if fallback.evaluate('el => el.scrollHeight > el.clientHeight'):
                        assert fallback.evaluate('el => el.scrollTop > 0'), 'Keyboard cannot scroll the greeting'
                    page.locator('#fallback-retry').scroll_into_view_if_needed()
                    page.screenshot(path=str(out / f'{mode}-{name}-bottom.png'))
                    assert fallback.evaluate('el => el.scrollWidth <= el.clientWidth'), 'Horizontal clipping'
                    retry = page.locator('#fallback-retry')
                    box = retry.bounding_box()
                    assert -1 <= box['x'] and box['x']+box['width'] <= width+1, box
                    assert -1 <= box['y'] and box['y']+box['height'] <= height+1, box
                    page.keyboard.press('Tab')
                    expect(retry).to_be_focused()
                    if mode == 'engine':
                        page.unroute('**/three.min.js')
                    with page.expect_navigation(wait_until='networkidle'):
                        page.keyboard.press('Enter')
                    if mode == 'engine':
                        expect(fallback).to_be_hidden()
                        page.locator('#btn-start-journey').click()
                        page.wait_for_function('() => (appInstance.stage === 2)')
                    else:
                        expect(fallback).to_be_visible()
                    page.set_viewport_size({'width':390,'height':844})
                    assert fallback.evaluate('el => el.hidden || el.scrollWidth <= el.clientWidth')
                assert not errors, errors
                results.append({'mode':mode,'viewport':name,'passed':True})
            except Exception as error:
                failures.append(f'{mode}/{name}: {error}; page errors: {errors}')
            finally:
                context.close()
    browser.close()
    (out / 'fallback-results.json').write_text(json.dumps({'results':results,'failures':failures},indent=2),encoding='utf-8')
    print(json.dumps({'results':results,'failures':failures},indent=2))
    assert not failures, '\n'.join(failures)
