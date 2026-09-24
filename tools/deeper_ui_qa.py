import os, shutil
"""Additional real DOM checks against exact delivered HTML, with no storage mock."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time
root=Path(__file__).resolve().parents[1]; out=Path(__file__).resolve().parents[1] / 'qa-evidence'; HTML=(root/'dist/Word-to-the-Nations.html').read_text(); results=[]
def check(name,fn):
    try: detail=fn(); results.append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True)
    except Exception as e: results.append({'name':name,'passed':False,'error':str(e)});print('FAIL',name,str(e),flush=True)

out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('WTTN_CHROMIUM') or shutil.which('chromium'),args=['--no-sandbox'])
    def make(w,h=1000):
        page=browser.new_page(viewport={'width':w,'height':h});page.set_default_timeout(10000);page.set_content(HTML,wait_until='load');page.wait_for_function('window.WTTN_READY');page.wait_for_timeout(800);return page
    def menu(page):
        if page.viewport_size['width']<=760 and not page.locator('#topActions').is_visible():page.locator('#mobileMenuButton').click()
    def advanced(page):
        menu(page);page.locator('#importBtn').click();page.locator('#importText').fill((root/'tests/fixtures/v2.4/advanced.json').read_text());page.locator('#importTextBtn').click();page.locator('#acceptConfirmBtn').click();page.wait_for_timeout(80)
        if page.locator('#confirmDialog').evaluate('(d)=>d.open'):page.locator('#acceptConfirmBtn').click()
        page.wait_for_function('!document.querySelector("#importDialog").open');page.wait_for_timeout(800)
    for w in [320,390,768,1440]:
        def geometry(w=w):
            page=make(w,844 if w<768 else 1000);advanced(page)
            for tab,selector,icon in [('scripture','.scripture-card','.library-crest'),('fields','.field-card','.field-emblem')]:
                page.locator(f'[data-tab="{tab}"]').click();page.wait_for_timeout(800)
                defects=page.evaluate('''({selector,icon})=>[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length).flatMap(e=>{let a=e.querySelector(icon)?.getBoundingClientRect(),b=e.querySelector('header')?.getBoundingClientRect();return a&&b&&Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1?[e.id||e.dataset.fieldId]:[]})''',{'selector':selector,'icon':icon})
                assert not defects,defects
                page.locator(selector).first.scroll_into_view_if_needed();page.screenshot(path=str(out/f'cards-{tab}-{w}.png'))
            page.close();return 'No artwork/header overlap in any visible collection or Field card.'
        check(f'card artwork and headings at {w}px',geometry)
    for w,h in [(320,568),(390,844),(1440,900)]:
        def zoom_dialog(w=w,h=h):
            page=make(w,h);page.locator('[data-tab=system]').click();page.wait_for_timeout(100)
            before=page.locator('#tab-system h2').first.bounding_box()['height'];page.locator('#textScale').select_option('120');page.wait_for_timeout(100)
            after=page.locator('#tab-system h2').first.bounding_box()['height'];assert after>before*1.1,(before,after)
            menu(page);page.locator('#exportBtn').click();page.wait_for_timeout(100)
            box=page.locator('#exportDialog').bounding_box();assert box['x']>=-1 and box['x']+box['width']<=w+1,box
            for i in range(10):
                page.keyboard.press('Tab');assert page.evaluate('document.querySelector("#exportDialog").contains(document.activeElement)')
            page.keyboard.press('Escape');page.wait_for_timeout(100)
            if w<768: assert page.evaluate('document.activeElement.id')=='mobileMenuButton'
            page.close();return {'headingHeightBefore':before,'headingHeightAfter':after,'exportDialog':box}
        check(f'actual 120 percent scaling and dialog keyboard flow {w}x{h}',zoom_dialog)
    def performance():
        page=make(1440);advanced(page);page.wait_for_timeout(1600)
        page.evaluate("window.__tasks=[];window.__observer=new PerformanceObserver(list=>window.__tasks.push(...list.getEntries().map(e=>e.duration)));window.__observer.observe({type:'longtask'});")
        page.wait_for_timeout(5000)
        durations=page.evaluate('window.__observer.disconnect();window.__tasks');page.close()
        # A measurement, not a fragile pass/fail promise about real devices.
        return {'windowSeconds':5,'longTasks':len(durations),'durationsMs':durations,'maxMs':max(durations,default=0)}
    check('advanced screen five-second long-task observation (runner only)',performance)
    browser.close()
(out/'deeper-ui-results.json').write_text(json.dumps({'method':'Exact bundled HTML, Chromium in-memory DOM; no storage shim','passed':sum(x['passed'] for x in results),'failed':sum(not x['passed'] for x in results),'checks':results},indent=2));print('TOTAL',sum(x['passed'] for x in results),sum(not x['passed'] for x in results))
