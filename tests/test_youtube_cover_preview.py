"""Offline admin thumbnail preview regression; no Firebase account required."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-gpu','--allow-file-access-from-files'])
    page=browser.new_page()
    page.route('https://www.gstatic.com/**',lambda route:route.abort())
    page.route('https://i.ytimg.com/**',lambda route:route.fulfill(status=404,body=''))
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    html=(root/'index.html').read_text(encoding='utf-8')
    scripts=['config/firebase-config.js','assets/js/core/state.js','assets/js/core/firebase.js','assets/js/core/repository.js','assets/js/core/shell.js','assets/js/modules/overview.js','assets/js/modules/videos.js','assets/js/modules/categories.js','assets/js/modules/ranks.js','assets/js/modules/live.js','assets/js/modules/materials.js','assets/js/modules/settings.js','assets/js/main.js']
    for sc in scripts:
        html=html.replace(f'<script src="./{sc}"></script>','<script>'+(root/sc).read_text(encoding='utf-8').replace('</script>','<\\/script>')+'</script>')
    page.set_content(html,wait_until='domcontentloaded')
    page.wait_for_function("document.querySelector('#lesson-category').options.length>0",timeout=7000)
    assert page.locator('#youtube-cover-preview').is_hidden()
    page.evaluate("""() => {const e=document.querySelector('#lesson-url'); e.value='https://youtu.be/qlbbXAiKt8M';e.dispatchEvent(new Event('input',{bubbles:true}));}""")
    assert page.locator('#youtube-cover-preview').get_attribute('hidden') is None
    assert page.locator('#youtube-cover-preview-img').get_attribute('src')=='https://i.ytimg.com/vi/qlbbXAiKt8M/hqdefault.jpg'
    page.evaluate("""() => {const e=document.querySelector('#lesson-url'); e.value='https://unsafe.example/qlbbXAiKt8M';e.dispatchEvent(new Event('input',{bubbles:true}));}""")
    assert page.locator('#youtube-cover-preview').get_attribute('hidden') is not None
    assert not errors,errors
    print('PASS admin automatic YouTube thumbnail preview; invalid links hidden; no JS errors')
    browser.close()
