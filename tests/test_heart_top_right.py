"""Check favorite layout and green fill in the actual web UI at mobile/desktop sizes."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
web = ROOT/'app/src/main/assets/www'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-gpu','--allow-file-access-from-files'])
    for width,height in [(360,780),(390,844),(520,900),(1100,900)]:
        page = browser.new_page(viewport={'width':width,'height':height})
        # Inline local assets for testing; this sandbox blocks file:// navigation.
        html=(web/'index.html').read_text()
        for sf in ['styles.css','modules/categories.css']:
            html=html.replace('<link rel="stylesheet" href="'+sf+'">','<style>'+ (web/sf).read_text() + '</style>')
        for sf in ['data.js','modules/learning-paths-data.js','core/core.js','modules/youtube-covers.js','modules/home.js','modules/categories.js','modules/live.js','modules/materials.js','modules/favorites.js','modules/lesson.js','core/navigation.js','modules/firebase-lessons.js']:
            html=html.replace('<script src="'+sf+'"></script>','<script>'+ (web/sf).read_text().replace('</script>','<\\/script>')+'</script>')
        page.evaluate("""Object.defineProperty(window,'localStorage',{configurable:true,value:(()=>{const x={};return {getItem:k=>x[k]??null,setItem:(k,v)=>x[k]=String(v),removeItem:k=>delete x[k]}})()})""")
        page.route('https://i.ytimg.com/**',lambda route:route.fulfill(status=404,body=''))
        page.set_content(html,wait_until='domcontentloaded')
        page.evaluate("""() => {data.videos.push({id:'heart_test',title:'Проверка сердечка',category:'newbie',language:'ru',orientation:'horizontal',duration:'5:00',youtubeId:''}); openVideo('heart_test'); }""")
        fav=page.locator('#favoriteBtn')
        back=page.locator('.lessonTop .backBtn')
        header=page.locator('#lessonHeader')
        assert fav.is_visible() and back.is_visible() and header.is_visible()
        rect_fav=fav.bounding_box();rect_back=back.bounding_box()
        assert abs((rect_fav['y']+rect_fav['height']/2)-(rect_back['y']+rect_back['height']/2)) < 1, (width,rect_fav,rect_back)
        assert abs(rect_fav['width']-rect_back['width']) < 1, (width,rect_fav,rect_back)
        assert rect_fav['x'] > width/2, (width,rect_fav)
        def styles():
            return fav.evaluate('''el=>({ fill:getComputedStyle(el.querySelector('svg path')).fill,
              buttonBackground:getComputedStyle(el).backgroundColor,
              pressed:el.getAttribute('aria-pressed')})''')
        off=styles(); assert off['pressed']=='false' and off['fill']=='none', (width,off)
        fav.click();on=styles()
        assert on['pressed']=='true' and on['fill']=='rgb(212, 255, 57)',(width,on)
        assert on['buttonBackground']==off['buttonBackground'],(width,on,off)
        fav.click();off2=styles();assert off2['pressed']=='false' and off2['fill']=='none', (width,off2)
        assert page.locator('.lessonActions button').count()==0
        print('PASS',width,'px: right-aligned; symmetrical with back; heart fill toggles; background unchanged')
        page.close()
    browser.close()
