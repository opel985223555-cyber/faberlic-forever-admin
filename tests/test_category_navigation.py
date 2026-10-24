from playwright.sync_api import sync_playwright
from pathlib import Path
from threading import Thread
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import json
root=Path(__file__).resolve().parent.parent/'app/src/main/assets/www'
lesson={'id':'PJ2XxVqozb6EFyk6bsDo','title':'Реклама','youtubeId':'qlbbXAiKt8M','categoryId':'newbie','groupId':None,'topicId':None,'language':'ru','description':'В этом уроке ты узнаешь','status':'published','order':1,'orientation':'vertical','createdAt':1791721285000}
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-gpu','--allow-file-access-from-files'])
 for mobile in [True,False]:
  page=browser.new_page(viewport={'width':390 if mobile else 1000,'height':844 if mobile else 850},is_mobile=mobile,has_touch=mobile)
  errs=[]
  page.on('pageerror',lambda e:errs.append(str(e)))
  payload=json.dumps([lesson],ensure_ascii=False)
  page.evaluate('window.FaberlicLessonsAndroid={subscribe(){queueMicrotask(()=>window.FFRemoteLessons.receive(JSON.stringify('+payload+')))}}')
  page.evaluate("""Object.defineProperty(window,'localStorage',{configurable:true,value:(()=>{const x={};return {getItem:k=>x[k]??null,setItem:(k,v)=>x[k]=String(v),removeItem:k=>delete x[k]}})()})""")
  html=(root/'index.html').read_text(encoding='utf8')
  for c in ['styles.css','modules/categories.css']:
   html=html.replace('<link rel="stylesheet" href="'+c+'">','<style>'+ (root/c).read_text(encoding='utf8') + '</style>')
  for sf in ['data.js','modules/learning-paths-data.js','core/core.js','modules/youtube-covers.js','modules/home.js','modules/categories.js','modules/live.js','modules/materials.js','modules/favorites.js','modules/lesson.js','core/navigation.js','modules/firebase-lessons.js']:
   html=html.replace('<script src="'+sf+'"></script>','<script>'+ (root/sf).read_text(encoding='utf8').replace('</script>','<'+chr(92)+'/script>')+'</script>')
  page.route('https://i.ytimg.com/**', lambda route: route.fulfill(status=404, body=''))
  page.set_content(html,wait_until='domcontentloaded')
  page.wait_for_function('window.FF_DATA && window.FF_DATA.videos.some(v=>v.title==="Реклама")',timeout=3000)
  assert 'Реклама' in page.locator('#videoGrid').inner_text()
  results.append(('mobile' if mobile else 'desktop')+' Firebase injected: Реклама visible')
  page.locator('.nav[data-page="categories"]').click()
  assert page.evaluate('currentPage')=='categories'
  for cat in ['newbie','product','sales','recruit','health','cabinet','team']:
   page.locator(f'#categoryList button[onclick="openCategory(\'{cat}\')"]').click()
   assert page.evaluate('currentPage')=='categories',cat
   assert page.locator('#categories').evaluate('(e)=>e.classList.contains("active")'),cat
   assert page.locator('#learningDirectory').is_visible(),cat
   assert page.locator('.nav[data-page="categories"]').evaluate('(e)=>e.classList.contains("active")'),cat
   if cat=='newbie':
    assert 'Реклама' in page.locator('#learningDirectory').inner_text()
    page.locator('#learningDirectory button.item').click()
    assert page.locator('#lessonOverlay').evaluate('(e)=>e.classList.contains("show")')
    assert page.locator('#lessonTitle').inner_text()=='Реклама'
    page.locator('.lessonTop button.backBtn').click()
   else:
    assert 'Здесь будут уроки' in page.locator('#learningDirectory').inner_text(),cat
   # Android back handler returns to Categories root, not Home
   assert page.evaluate('window.ffHandleBack()') is True
   assert page.evaluate('currentPage')=='categories'
   assert page.locator('#categoryList').is_visible()
  results.append(('mobile' if mobile else 'desktop')+' seven conventional categories stay in Categories; back & lesson playback')
  for group in ['social','ranks']:
   page.locator(f'#categoryList button[onclick="openCategory(\'{group}\')"]').click()
   assert page.evaluate('currentPage')=='categories'
   page.locator('#learningDirectory button.item').first.click()
   assert page.evaluate('currentPage')=='categories'
   assert page.locator('#learningDirectory .directoryTitle').is_visible()
   page.evaluate('window.ffHandleBack()')
   assert page.locator('#learningDirectory button.item').count()>=1
   page.evaluate('window.ffHandleBack()')
   assert page.locator('#categoryList').is_visible()
  results.append(('mobile' if mobile else 'desktop')+' ranks/social two-level directory works')
  for dest in ['live','materials','saved','home','categories']:
   page.locator(f'.nav[data-page="{dest}"]').click()
   assert page.evaluate('currentPage')==dest,dest
   assert page.locator('#'+dest).evaluate('(e)=>e.classList.contains("active")')
  results.append(('mobile' if mobile else 'desktop')+' all five bottom tabs navigate')
  # switch language inside a category and ensure we stay in it
  page.locator('#categoryList button').first.click()
  page.locator('#langButtonSection').click()
  page.locator('.langOption[data-lang="tj"]').click()
  assert page.evaluate('currentPage')=='categories'
  assert 'Барои навкор' in page.locator('#learningDirectory').inner_text()
  page.locator('#langButtonSection').click()
  page.locator('.langOption[data-lang="ru"]').click()
  assert 'Реклама' in page.locator('#learningDirectory').inner_text()
  results.append(('mobile' if mobile else 'desktop')+' RU/TJ language switch, retains category')
  assert not errs,errs
  results.append(('mobile' if mobile else 'desktop')+' no JS errors')
  page.close()
 browser.close()
print('\n'.join('PASS: '+x for x in results))
