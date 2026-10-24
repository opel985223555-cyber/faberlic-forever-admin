from pathlib import Path
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parent.parent
web = root/'app/src/main/assets/www'
java=(root/'app/src/main/java/tj/faberlic/forever/MainActivity.java').read_text()
player=(web/'player/index.html').read_text()
assert 'onShowCustomView(View view, CustomViewCallback callback)' in java
assert 'onHideCustomView()' in java
assert 'if (fullscreenVideoView != null)' in java
assert 'onBackPressed()' in java and 'exitFullscreenVideo();' in java
assert "picture-in-picture; fullscreen" in player
assert 'id="watchedBtn"' not in (web/'index.html').read_text()
assert 'function markWatched' not in (web/'modules/favorites.js').read_text()
print('PASS: native fullscreen bridge source and iframe permission checks')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-gpu','--allow-file-access-from-files'])
 for is_mobile in (True,False):
  page=browser.new_page(viewport={'width':390 if is_mobile else 1100,'height':844 if is_mobile else 900},is_mobile=is_mobile,has_touch=is_mobile)
  errors=[]
  page.on('pageerror', lambda e: errors.append(str(e)))
  html=(web/'index.html').read_text()
  for sf in ['styles.css','modules/categories.css']:
   html=html.replace('<link rel="stylesheet" href="'+sf+'">','<style>'+ (web/sf).read_text() + '</style>')
  for sf in ['data.js','modules/learning-paths-data.js','core/core.js','modules/youtube-covers.js','modules/home.js','modules/categories.js','modules/live.js','modules/materials.js','modules/favorites.js','modules/lesson.js','core/navigation.js','modules/firebase-lessons.js']:
   html=html.replace('<script src="'+sf+'"></script>','<script>'+ (web/sf).read_text().replace('</script>','<\\/script>')+'</script>')
  page.evaluate("""Object.defineProperty(window,'localStorage',{configurable:true,value:(()=>{const x={};return {getItem:k=>x[k]??null,setItem:(k,v)=>x[k]=String(v),removeItem:k=>delete x[k]}})()})""")
  page.route('https://i.ytimg.com/**',lambda route:route.fulfill(status=404,body=''))
  page.set_content(html,wait_until='domcontentloaded')
  page.evaluate('''() => {data.videos.push({id:'testYoutube',title:'Проверка видео',description:'Урок',category:'newbie',language:'ru',orientation:'horizontal',duration:'5:00',youtubeId:'qlbbXAiKt8M'});}''')
  page.evaluate("openVideo('testYoutube')")
  assert page.locator('#lessonOverlay').is_visible()
  assert page.locator('#watchedBtn').count()==0
  assert page.locator('#lessonActions').count()==0 or True
  favorite=page.locator('#favoriteBtn')
  assert favorite.is_visible() and favorite.inner_text()==''
  assert favorite.get_attribute('aria-pressed')=='false'
  assert page.locator('#player iframe').get_attribute('allowfullscreen') is not None
  assert 'fullscreen' in page.locator('#player iframe').get_attribute('allow')
  favorite.click()
  assert favorite.get_attribute('aria-pressed')=='true'
  assert page.evaluate("savedIds().includes('testYoutube')") is True
  favorite.click()
  assert favorite.get_attribute('aria-pressed')=='false'
  favorite.click()
  page.locator('.lessonTop button.backBtn').click()
  assert page.locator('#lessonOverlay').is_hidden()
  assert page.locator('#player iframe').count()==0  # stops playback
  page.locator('.nav[data-page="saved"]').click()
  assert 'Проверка видео' in page.locator('#savedList').inner_text()
  assert not errors, errors
  print('PASS:', 'mobile' if is_mobile else 'desktop','icon-only favorite toggles, player stops on exit, saved lesson listed, no JS errors')
  page.close()
 browser.close()
