import os, shutil
"""Exercise the exact built portable HTML in Chromium's in-memory document.
Navigation to any HTTP/file URL is prohibited by this runner's admin policy.
This is UI/in-memory integration evidence, NOT hosted/PWA/storage certification.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time,traceback
ROOT=Path(__file__).resolve().parents[1]; OUT=Path(__file__).resolve().parents[1] / 'qa-evidence'
HTML=(ROOT/'dist/Word-to-the-Nations.html').read_text()
results=[];screens=[]

def check(name,fn):
    started=time.monotonic()
    try:
        detail=fn()
        results.append({'name':name,'passed':True,'seconds':round(time.monotonic()-started,2),'detail':detail})
        print('PASS',name,flush=True)
    except Exception as e:
        results.append({'name':name,'passed':False,'error':str(e),'trace':traceback.format_exc()[-2000:]})
        print('FAIL',name,str(e)[:300],flush=True)
        try: main.evaluate('document.querySelectorAll("dialog[open]").forEach(d => d.close())')
        except Exception: pass

def must(value,msg):
    if not value: raise AssertionError(msg)


OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('WTTN_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    def page_for(w=1440,h=1000):
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        page.set_default_timeout(10000)
        page.errors=[]; page.requests=[]
        page.on('pageerror',lambda e:page.errors.append(str(e)))
        page.on('request',lambda r:page.requests.append(r.url))
        page.set_content(HTML,wait_until='load');page.wait_for_function('window.WTTN_READY === true');page.wait_for_timeout(700)
        return page
    def menu(page):
        if page.viewport_size['width']<=760 and not page.locator('#topActions').is_visible(): page.locator('#mobileMenuButton').click()
    def fixture(page,name):
        menu(page);page.locator('#importBtn').click();page.locator('#importText').fill((ROOT/'tests/fixtures/v2.4'/f'{name}.json').read_text());page.locator('#importTextBtn').click()
        page.locator('#confirmDialog[open]').wait_for();page.locator('#acceptConfirmBtn').click();page.wait_for_timeout(100)
        if page.locator('#confirmDialog').evaluate('(el)=>el.open'): page.locator('#acceptConfirmBtn').click()
        page.wait_for_function('!document.querySelector("#importDialog").open');page.wait_for_timeout(200)
    def tab(page,name):
        page.locator(f'[data-tab="{name}"]').click();page.wait_for_timeout(90)
    def no_overflow(page):
        data=page.evaluate('''() => ({w:innerWidth, body:document.body.scrollWidth, root:document.documentElement.scrollWidth, offenders:[...document.querySelectorAll('main *')].filter(e=>e.getClientRects().length && getComputedStyle(e).position!=='fixed' && e.getBoundingClientRect().right>innerWidth+2).slice(0,10).map(e=>e.id||e.className)})''')
        must(data['body']<=data['w']+1 and data['root']<=data['w']+1,str(data));return data
    main=page_for()
    def basic():
        must(not main.errors,str(main.errors));must(len(main.requests)==0,str(main.requests))
        must(main.locator('[data-quick-producer="scribe"]').count()==1,'missing first direct action')
        must(main.locator('#storageWarning').is_visible(),'storage failure should not be hidden')
        return {'networkRequests':main.requests,'runtimeErrors':main.errors,'firstAction':main.locator('[data-quick-producer]').bounding_box()}
    check('exact portable artifact boots without any external requests',basic)
    def purchase():
        main.wait_for_function('!document.querySelector("[data-quick-producer=scribe]").disabled',timeout=12000)
        main.locator('[data-quick-producer="scribe"]').click()
        must('1 owned' in main.locator('#producer-scribe .count').inner_text(),'first producer was not purchased')
        return main.locator('#workDecisionCockpit').inner_text()
    check('fresh campaign first purchase works from next-step card',purchase)
    def stable():
        fixture(main,'first-run')
        main.locator('#producer-scribe .producer-detail summary').click()
        btn=main.locator('[data-producer="scribe"]');btn.focus();btn.evaluate('(e)=>window.__focusedControl=e')
        main.wait_for_timeout(1600)
        must(main.evaluate('window.__focusedControl === document.querySelector("[data-producer=scribe]")'),'control replaced')
        must(main.evaluate('document.activeElement === window.__focusedControl'),'focus lost')
        must(main.locator('#producer-scribe details').evaluate('(e)=>e.open'),'reading detail collapsed')
        btn.click();main.wait_for_timeout(800)
        must(main.evaluate('window.__focusedControl === document.querySelector("[data-producer=scribe]")'),'purchase replaced control')
        must(main.locator('#producer-scribe details').evaluate('(e)=>e.open'),'purchase closed detail')
        return 'Node identity, focus and open detail survive repeated ticks and purchase.'
    check('stable rendering preserves keyboard focus and open reading details',stable)
    def quantities():
        main.locator('[data-buy-amount="10"]').click()
        must(main.locator('[data-producer="scribe"]').inner_text()=='Buy up to 10','bulk semantics misleading')
        before=int(main.locator('#producer-scribe .count').inner_text().split()[0]);main.locator('[data-producer="scribe"]').click()
        after=int(main.locator('#producer-scribe .count').inner_text().split()[0]);must(after-before==10,f'quantity {after-before}')
        return {'before':before,'after':after}
    check('quantity control and bulk purchase',quantities)
    def help_dialog():
        main.locator('#helpBtn').click();must(main.locator('#helpDialog').evaluate('(e)=>e.open'),'help not open')
        for _ in range(9):
            main.keyboard.press('Tab');must(main.evaluate('document.querySelector("#helpDialog").contains(document.activeElement)'),'native dialog focus escaped')
        main.keyboard.press('Escape');must(not main.locator('#helpDialog').evaluate('(e)=>e.open'),'help did not close')
        must(main.evaluate('document.activeElement.id === "helpBtn"'),'help did not restore focus')
    check('native guide dialog focus containment and restoration',help_dialog)
    def keyboard_tabs():
        main.locator('[data-tab="work"]').focus();main.keyboard.press('ArrowDown')
        must(main.locator('[data-tab="projects"]').get_attribute('aria-selected')=='true','ArrowDown does not switch tab')
        must(main.locator('#projectGrid .project-card').count()>0,'active tab did not hydrate')
        main.keyboard.press('End');must(main.locator('[data-tab="system"]').get_attribute('aria-selected')=='true','End not selecting last tab')
    check('keyboard tab navigation and active-screen hydration',keyboard_tabs)
    def export_fallback():
        menu(main);main.locator('#exportBtn').click();text=main.locator('#exportText').input_value();data=json.loads(text)
        must(data['kind']=='word-to-the-nations-save' and 'checksum' in data,'invalid envelope')
        main.locator('#copySaveBtn').click();main.wait_for_timeout(100)
        must(main.locator('#exportFeedback').inner_text()!='','clipboard failure has no fallback')
        main.keyboard.press('Escape');return {'gameVersion':data['gameVersion'],'schema':data['schema'],'chars':len(text)}
    check('checksummed export and clipboard-denied text fallback',export_fallback)
    def invalid_import():
        menu(main);main.locator('#importBtn').click();main.locator('#importText').fill('{bad JSON');main.locator('#importTextBtn').click()
        must('not applied' in main.locator('#importFeedback').inner_text(),'invalid data was not rejected')
        must(not main.locator('#confirmDialog').evaluate('(e)=>e.open'),'invalid import prompted for overwrite')
        main.keyboard.press('Escape')
    check('malformed import is rejected without replacing progress',invalid_import)
    def cancel_reset():
        tab(main,'system');main.locator('#resetBtn').click();must(main.locator('#confirmDialog').evaluate('(e)=>e.open'),'reset no confirmation')
        main.locator('#cancelConfirmBtn').click();tab(main,'work');must(int(main.locator('#producer-scribe .count').inner_text().split()[0])>0,'cancel reset lost state')
    check('reset cancellation leaves progress intact',cancel_reset)
    def atlas_basic():
        main.locator('#atlasOverviewBtn').click();must(main.locator('#atlasDialog').evaluate('(e)=>e.open'),'atlas not open')
        main.locator('#atlasZoomInBtn').click();must('115%'==main.locator('#atlasViewStatus').inner_text(),'zoom wrong')
        main.locator('#atlasResetViewBtn').click();must('100%'==main.locator('#atlasViewStatus').inner_text(),'reset zoom wrong')
        main.screenshot(path=str(OUT/'atlas-open.png'));main.keyboard.press('Escape');main.wait_for_timeout(100)
        must(main.locator('#campaignOverview #missionAtlas').count()==1,'Atlas not restored')
        no_overflow(main)
    check('full Atlas opens, zooms, resets and returns to preview',atlas_basic)
    def advanced():
        fixture(main,'advanced')
        for name in ['work','projects','translation','insight','network','fields','legacy','scripture','stats','system']:
            tab(main,name);no_overflow(main);must(not main.errors,str(main.errors))
            main.screenshot(path=str(OUT/f'advanced-{name}-desktop.png'))
        return {'visibleTabs':main.locator('.tab:not(.hidden)').count(),'runtimeErrors':main.errors}
    check('completed campaign all ten screens',advanced)
    def atlas_field():
        main.locator('#atlasOverviewBtn').click();node=main.locator('[data-atlas-field]').first;node.focus();node.press('Enter');main.wait_for_timeout(300)
        must(not main.locator('#atlasDialog').evaluate('(e)=>e.open'),'field node does not close Atlas')
        must(main.locator('[data-tab="fields"]').get_attribute('aria-selected')=='true','field did not open')
        must(main.locator('.field-card').count()>0,'fields not rendered')
    check('keyboard Atlas field node opens field briefing',atlas_field)
    def accessibility():
        tab(main,'system')
        main.locator('#motionPreference').select_option('reduce');main.locator('#textScale').select_option('120');main.locator('#contrastPreference').select_option('high')
        must(main.evaluate('document.documentElement.dataset.motion')=='reduce','preference not applied');no_overflow(main)
        main.emulate_media(reduced_motion='reduce',forced_colors='active');no_overflow(main)
        main.screenshot(path=str(OUT/'forced-colors.png'));main.emulate_media(reduced_motion='reduce',forced_colors='none')
        return main.evaluate('({motion:document.documentElement.dataset.motion,text:document.documentElement.dataset.textScale,contrast:document.documentElement.dataset.contrast})')
    check('120 percent text, reduced motion and forced colors',accessibility)
    def names():
        bad=[]
        for name in ['work','projects','translation','insight','network','fields','legacy','scripture','stats','system']:
            tab(main,name)
            bad+=main.evaluate('''() => [...document.querySelectorAll('button,[role=button]')].filter(e=>e.getClientRects().length && !e.closest('[hidden],.hidden') && !e.textContent.trim() && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).map(e=>e.outerHTML.slice(0,200))''')
        must(not bad,str(bad));return {'unnamedVisibleButtons':len(bad)}
    check('accessible names on visible buttons across all screens',names)
    def hidden_atlas_refresh():
        page=page_for();tab(page,'system');fixture(page,'advanced');page.locator('#atlasOverviewBtn').click()
        must(page.locator('[data-atlas-field]').count()>=9,'hidden Atlas rendered stale campaign')
        page.keyboard.press('Escape');page.close()
    check('Atlas refreshes after importing from an inactive workspace',hidden_atlas_refresh)
    viewports=[(320,568),(360,640),(390,844),(412,915),(430,932),(600,960),(768,1024),(820,1180),(1024,768),(1280,720),(1366,768),(1440,900),(1920,1080),(2560,1440),(844,390)]
    for w,h in viewports:
        def responsive(w=w,h=h):
            page=page_for(w,h);data=no_overflow(page)
            must(not page.errors,str(page.errors))
            action=page.locator('[data-quick-producer]').bounding_box();must(action['width']>0,'no playable action')
            if w in (320,390,768,1366,1920):
                page.screenshot(path=str(OUT/f'fresh-{w}x{h}.png'))
            if w<=760:
                menu(page);must(page.locator('#exportBtn').is_visible(),'mobile actions unreachable');page.locator('#mobileMenuButton').click()
            tab(page,'projects');no_overflow(page);tab(page,'system');no_overflow(page)
            page.close();return data
        check(f'fresh layout and navigation {w}x{h}',responsive)
    def mobile_advanced():
        page=page_for(390,844);fixture(page,'advanced')
        for name in ['work','projects','translation','insight','network','fields','legacy','scripture','stats','system']:
            tab(page,name);no_overflow(page);page.screenshot(path=str(OUT/f'advanced-{name}-mobile.png'));must(not page.errors,str(page.errors))
        page.locator('#atlasOverviewBtn').click();no_overflow(page)
        for control in ['atlasZoomInBtn','atlasZoomOutBtn','atlasResetViewBtn']:
            box=page.locator('#'+control).bounding_box();must(box and box['x']>=0 and box['x']+box['width']<=390 and box['y']+box['height']<=844,'Atlas control not reachable: '+control)
        fit=page.locator('#atlasSvg').bounding_box();must(fit['width']<=page.locator('#atlasViewport').bounding_box()['width']+1,'Atlas does not fit by default')
        page.locator('#atlasZoomInBtn').click();must(page.locator('#atlasViewStatus').inner_text()=='115%','mobile zoom failed');page.locator('#atlasResetViewBtn').click()
        must(page.locator('#atlasFieldPicker option').count()>=9,'missing field alternative')
        page.screenshot(path=str(OUT/'advanced-atlas-mobile.png'));page.locator('#openAtlasSelectedFieldBtn').click();must(page.locator('[data-tab=fields]').get_attribute('aria-selected')=='true','Field selector navigation failed')
        page.set_viewport_size({'width':844,'height':390});no_overflow(page);tab(page,'network');no_overflow(page)
        page.close()
    check('advanced campaign ten mobile screens, Atlas and rotation',mobile_advanced)
    main.close();browser.close()
summary={'environment':'Chromium in-memory document, exact portable build bytes; no HTTP navigation or persistent browser origin','checks':results,'passed':sum(x['passed'] for x in results),'failed':sum(not x['passed'] for x in results)}
(OUT/'browser-results.json').write_text(json.dumps(summary,indent=2))
print('TOTAL',summary['passed'],'PASS',summary['failed'],'FAIL',flush=True)
