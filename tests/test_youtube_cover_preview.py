"""YouTube ID parsing and image preview under Chromium without Firebase/network."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda route:route.abort())
    html=(root/'index.html').read_text(encoding='utf8')
    html=re.sub(r'<script src="[^"]+"></script>','',html)
    html=re.sub(r'<link rel="stylesheet"[^>]+>','',html)
    page.set_content(html,wait_until='domcontentloaded')
    page.evaluate('window.FF_FIREBASE_CONFIG={};')
    for script in ['core/state.js','core/catalog-seed.js','core/firebase.js','core/repository.js','core/shell.js','modules/overview.js','modules/videos.js','modules/categories.js','modules/ranks.js','modules/live.js','modules/materials.js','modules/settings.js','main.js']:
        page.add_script_tag(content=(root/'assets/js'/script).read_text(encoding='utf8'))
    page.evaluate('document.dispatchEvent(new Event("DOMContentLoaded"));')
    page.wait_for_function('document.querySelector("#lesson-category").options.length>0')
    assert page.locator('#youtube-cover-preview').is_hidden()
    for link in ['https://youtu.be/qlbbXAiKt8M','https://www.youtube.com/watch?v=qlbbXAiKt8M','https://www.youtube.com/shorts/qlbbXAiKt8M','https://www.youtube.com/live/qlbbXAiKt8M']:
        page.evaluate('link => { const e = document.querySelector("#lesson-url");e.value=link;e.dispatchEvent(new Event("input",{bubbles:true}));}', link)
        assert page.locator('#youtube-cover-preview').get_attribute('hidden') is None
        assert page.locator('#youtube-cover-preview-img').get_attribute('src')=='https://i.ytimg.com/vi/qlbbXAiKt8M/hqdefault.jpg'
    page.evaluate('link => { const e = document.querySelector("#lesson-url");e.value=link;e.dispatchEvent(new Event("input",{bubbles:true}));}', 'https://unsafe.example/qlbbXAiKt8M')
    assert page.locator('#youtube-cover-preview').get_attribute('hidden') is not None
    assert not errors,errors
    print('PASS: YouTube preview incl. shorts/live/watch, invalid domains blocked, no JS errors')
    browser.close()
