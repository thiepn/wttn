import os, shutil
"""Integration with an explicit Map-backed storage mock, NOT real localStorage.
The final portable HTML is unmodified. The mock isolates failure/recovery paths.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time,traceback
root=Path(__file__).resolve().parents[1]; out=Path(__file__).resolve().parents[1] / 'qa-evidence'; HTML=(root/'dist/Word-to-the-Nations.html').read_text()
KEY='wttn.phase6.save.v6'; BACKUP='wttn.phase6.backup.v6'; results=[]
def check(name,fn):
    try: detail=fn();results.append({'name':name,'passed':True,'detail':detail});print('PASS',name,flush=True)
    except Exception as e: results.append({'name':name,'passed':False,'error':str(e)});print('FAIL',name,str(e),flush=True)

out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('WTTN_CHROMIUM') or shutil.which('chromium'),args=['--no-sandbox'])
    def page_for(data=None,limit=None):
        page=browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(10000)
        page.evaluate('''({data,limit}) => { const store=new Map(Object.entries(data)); window.__storage=store; window.__storageLimit=limit;
          Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store.get(k) ?? null,removeItem:k=>store.delete(k),setItem:(k,v)=>{if(window.__storageLimit!==null && String(v).length>window.__storageLimit)throw new DOMException('Mock quota','QuotaExceededError'); store.set(k,String(v));}}}); }''', {'data':data or {},'limit':limit})
        page.set_content(HTML,wait_until='load');page.wait_for_function('window.WTTN_READY===true');page.wait_for_timeout(200)
        if page.locator('#offlineModal:not(.hidden)').count(): page.keyboard.press('Escape')
        return page
    def valid_start():
        page=page_for();assert page.locator('#storageWarning').is_hidden();assert page.locator('#saveStatus').inner_text()=='Saved'
        stored=page.evaluate('(key)=>localStorage.getItem(key)',KEY);assert json.loads(stored)['gameVersion']==6
        page.close();return 'Initial save actually written to the simulated adapter.'
    check('fresh game writes a valid checksummed save to the mock adapter',valid_start)
    def corrupt():
        primary='{damaged primary'; backup='{damaged backup';page=page_for({KEY:primary,BACKUP:backup});page.locator('#saveBtn').click();page.wait_for_timeout(1100)
        assert page.evaluate('(k)=>localStorage.getItem(k)',KEY)==primary
        assert page.evaluate('(k)=>localStorage.getItem(k)',BACKUP)==backup
        assert 'paused' in page.locator('#storageWarning').inner_text()
        page.close();return 'Neither unreadable copy was overwritten.'
    check('two corrupted saves are quarantined instead of overwritten',corrupt)
    def recover():
        good=(root/'tests/fixtures/v2.4/first-run.json').read_text();page=page_for({KEY:'{bad',BACKUP:good})
        stored=json.loads(page.evaluate('(k)=>localStorage.getItem(k)',KEY));assert stored['state']['records']['saveRecoveries']>=1
        assert stored['state']['producers']['scribe']>0
        assert page.evaluate('(k)=>localStorage.getItem(k)',BACKUP)==good
        page.close();return 'Validated backup restored; original valid backup preserved.'
    check('invalid primary recovers from a validated backup',recover)
    def quota():
        page=page_for(limit=8) # Tiny probe succeeds; a full save does not.
        assert page.locator('#storageWarning').is_visible();assert page.locator('#saveStatus').inner_text()=='Export-only'
        assert page.evaluate('(k)=>localStorage.getItem(k)',KEY) is None
        page.locator('#exportBtn').click();assert json.loads(page.locator('#exportText').input_value())['kind']=='word-to-the-nations-save'
        page.close();return 'Successful small probe cannot hide a failed full save; export still works.'
    check('quota failure remains visible even when the tiny storage probe succeeds',quota)
    def import_backup():
        page=page_for({KEY:(root/'tests/fixtures/v2.4/first-run.json').read_text()})
        before=json.loads(page.evaluate('(k)=>localStorage.getItem(k)',KEY))['state']['producers']['scribe']
        page.locator('#importBtn').click();page.locator('#importText').fill((root/'tests/fixtures/v2.4/advanced.json').read_text());page.locator('#importTextBtn').click();page.locator('#acceptConfirmBtn').click()
        page.wait_for_function('!document.querySelector("#importDialog").open')
        backup=json.loads(page.evaluate('(k)=>localStorage.getItem(k)',BACKUP));primary=json.loads(page.evaluate('(k)=>localStorage.getItem(k)',KEY))
        assert backup['state']['producers']['scribe']==before;assert primary['state']['legacies']==4
        page.close();return 'Current pre-import state is backed up, not a stale autosave.'
    check('validated import keeps the actual previous campaign as the recovery snapshot',import_backup)
    def preferences():
        page=page_for();page.locator('[data-tab=system]').click();page.locator('#motionPreference').select_option('reduce');page.locator('#textScale').select_option('120')
        data=page.evaluate('Object.fromEntries(window.__storage)');page.close();second=page_for(data)
        assert second.evaluate('document.documentElement.dataset.motion')=='reduce';assert second.evaluate('document.documentElement.dataset.textScale')=='120'
        second.close();return 'Preferences restored in a second document from a simulated store snapshot.'
    check('accessibility preferences round-trip through the simulated adapter',preferences)
    browser.close()
summary={'method':'Chromium with explicit Map-backed storage mock; not browser persistence or an origin bypass','passed':sum(x['passed'] for x in results),'failed':sum(not x['passed'] for x in results),'checks':results}
(out/'storage-mock-results.json').write_text(json.dumps(summary,indent=2));print('TOTAL',summary['passed'],summary['failed'])
