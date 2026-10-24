"""Browser smoke tests for SYNC-06 thumbnails; offline Firestore/YouTube fixtures."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
web=root/'app/src/main/assets/www'
lesson={'id':'FFThumbnailTest001','title':'Реклама','youtubeId':'qlbbXAiKt8M','categoryId':'newbie','language':'ru','description':'Тест обложки','status':'published','order':1,'orientation':'vertical','createdAt':1791721285000}
inline=(web/'index.html').read_text(encoding='utf-8')
for css in ('styles.css','modules/categories.css'):
    inline=inline.replace(f'<link rel="stylesheet" href="{css}">','<style>'+(web/css).read_text(encoding='utf-8')+'</style>')
for script in ('data.js','modules/learning-paths-data.js','core/core.js','modules/youtube-covers.js','modules/home.js','modules/categories.js','modules/live.js','modules/materials.js','modules/favorites.js','modules/lesson.js','core/navigation.js','modules/firebase-lessons.js'):
    inline=inline.replace(f'<script src="{script}"></script>','<script>'+(web/script).read_text(encoding='utf-8').replace('</script>','<\\/script>')+'</script>')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-gpu','--allow-file-access-from-files'])
    for mobile in (True,False):
        page=browser.new_page(viewport={'width':390 if mobile else 1080,'height':844 if mobile else 880},is_mobile=mobile,has_touch=mobile)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.route('https://i.ytimg.com/**',lambda route:route.fulfill(status=404,body=''))
        page.evaluate("""Object.defineProperty(window,'localStorage',{configurable:true,value:(()=>{const x={};return {getItem:k=>x[k]??null,setItem:(k,v)=>x[k]=String(v),removeItem:k=>delete x[k]}})()})""")
        page.evaluate('''() => { window.FaberlicLessonsAndroid={subscribe(){queueMicrotask(()=>window.FFRemoteLessons.receive(JSON.stringify('''+json.dumps([lesson],ensure_ascii=False)+''')))}}; }''')
        page.set_content(inline,wait_until='domcontentloaded')
        page.wait_for_function('window.FF_DATA.videos.length===1',timeout=5000)
        expected=f'https://i.ytimg.com/vi/{lesson["youtubeId"]}/hqdefault.jpg'
        assert page.locator('#heroWrap .bannerThumbnail').get_attribute('src')==expected
        assert page.locator('#videoGrid .youtubeThumb').get_attribute('src')==expected
        assert page.locator('.continue .continueThumb').get_attribute('src')==expected
        assert page.locator('#videoGrid .time').count()==0 # Duration not provided in Firestore
        page.locator('.nav[data-page="categories"]').click()
        page.locator('#categoryList button[onclick="openCategory(\'newbie\')"]').click()
        assert page.locator('#learningDirectory .itemThumb').get_attribute('src')==expected
        page.locator('#learningDirectory button.item').click()
        assert page.locator('#lessonTitle').inner_text()=='Реклама'
        page.locator('#favoriteBtn').click()
        page.locator('.backBtn').click()
        page.locator('.nav[data-page="saved"]').click()
        assert page.locator('#savedList .itemThumb').get_attribute('src')==expected
        assert page.evaluate("FFCovers.url({youtubeId:'not-valid'})")==''
        assert 'i.ytimg.com' not in (web/'data.js').read_text(encoding='utf-8')
        assert not errors,errors
        print('PASS', 'mobile' if mobile else 'desktop','banner + new + continue + category + favorites + player + invalid ID + no JS errors')
        page.close()
    browser.close()
