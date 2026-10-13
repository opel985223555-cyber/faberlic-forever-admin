"""Offline UI regression: mocked Firestore adapter, real JS/HTML/CSS in Chromium.
Run: python tests/test_admin_browser.py
No network or Firebase credentials required; NOT a replacement for testing live Firebase.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
errors=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1200,'height':840})
  page.on('pageerror',lambda e:errors.append(str(e)))
  # Run the real page structure and real JS without requesting localhost/external network.
  html=(ROOT/'index.html').read_text(encoding='utf8')
  html=re.sub(r'<script src="[^"]+"></script>','',html)
  html=re.sub(r'<link rel="stylesheet"[^>]+>','',html)
  page.set_content(html,wait_until='domcontentloaded')
  for css in ['base.css','overview.css','videos.css','categories.css','live.css','settings.css','branding.css']:
   page.add_style_tag(content=(ROOT/'assets/css'/css).read_text(encoding='utf8'))
  page.evaluate('window.FF_FIREBASE_CONFIG={};')
  for script in ['core/state.js','core/catalog-seed.js','core/firebase.js','core/repository.js','core/shell.js','modules/overview.js','modules/videos.js','modules/categories.js','modules/ranks.js','modules/live.js','modules/materials.js','modules/settings.js','main.js']:
   page.add_script_tag(content=(ROOT/'assets/js'/script).read_text(encoding='utf8'))
  page.evaluate('document.dispatchEvent(new Event("DOMContentLoaded"));')
  page.wait_for_selector('#login-form')
  assert page.locator('#admin-shell').is_hidden(),'App shell must stay hidden without authentication'
  page.evaluate('''async () => {
   const a=window.FFAdmin;
   const initial={id:'lesson-advert',title:'Реклама',youtubeId:'dQw4w9WgXcQ',youtubeUrl:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',categoryId:'newbie',leafCategoryId:'newbie',language:'ru',status:'published',order:1,orientation:'vertical',createdAt:1};
   window.__ffDB={lessons:[initial],catalog:null};
   a.firebase.listLessons=async()=>structuredClone(window.__ffDB.lessons);
   a.firebase.listCatalog=async()=>window.__ffDB.catalog?structuredClone(window.__ffDB.catalog):null;
   a.firebase.readSnapshot=async()=>({lessons:await a.firebase.listLessons(),catalog:await a.firebase.listCatalog(),catalogRevision:0,orderRevisions:{}});
   a.firebase.putCatalog=async(items)=>{window.__ffDB.catalog=structuredClone(items)};
   a.firebase.upsertLesson=async(data,id)=>{const db=window.__ffDB.lessons; if(id){const i=db.findIndex(v=>v.id===id);db[i]={...db[i],...structuredClone(data)};return id;}const key='lesson-'+(db.length+1);db.push({id:key,...structuredClone(data),createdAt:Date.now()});return key};
   a.firebase.reorderLessons=async(ids)=>{ids.forEach((id,i)=>{const v=window.__ffDB.lessons.find(v=>v.id===id);v.order=i+1;});};
   a.firebase.deleteLesson=async(id)=>{window.__ffDB.lessons=window.__ffDB.lessons.filter(v=>v.id!==id)};
   await a.setMode('firebase',{email:'tester@example.invalid',uid:'test'});
  }''')
  assert page.locator('#metric-published').inner_text()=='1','Mock published lesson loaded'
  page.locator('.nav-button[data-page="categories"]').click()
  assert page.locator('#catalog-init-note').is_visible()
  page.locator('#catalog-init').click()
  page.wait_for_function('!!window.__ffDB.catalog')
  assert page.locator('#catalog-init-note').is_hidden()
  count=page.evaluate('window.__ffDB.catalog.length')
  assert count>=21, ('missing original category taxonomy',count)
  # Existing title and status editable while keeping ID.
  page.locator('[data-category-edit="social__target"]').click()
  assert page.locator('#category-name-ru').input_value()=='Таргетированная реклама'
  page.locator('#category-name-ru').fill('Таргет — настройка рекламы')
  page.locator('#category-status').select_option('soon')
  page.locator('#category-form').evaluate('(form)=>form.requestSubmit()')
  page.wait_for_function('window.__ffDB.catalog.some(x=>x.id==="social__target" && x.name.ru==="Таргет — настройка рекламы")')
  assert page.locator('[data-category-edit="social__target"]').count()==1
  # Create a nested new category.
  page.locator('#category-new').click()
  page.locator('#category-parent').select_option('social')
  page.locator('#category-name-ru').fill('Продвижение в Instagram')
  page.locator('#category-form').evaluate('(form)=>form.requestSubmit()')
  page.wait_for_function('window.__ffDB.catalog.some(x=>x.name.ru==="Продвижение в Instagram")')
  # Reparenting populated category is blocked.
  page.locator('[data-category-edit="newbie"]').click()
  page.locator('#category-parent').select_option('social')
  page.locator('#category-form').evaluate('(form)=>form.requestSubmit()')
  assert 'есть видео' in page.locator('#toast').inner_text()
  assert page.evaluate('window.__ffDB.catalog.find(x=>x.id==="newbie").parentId') is None
  # New lesson auto-appends; no manual order control in the form.
  page.locator('.nav-button[data-page="videos"]').click()
  assert page.locator('#lesson-order').count()==0
  page.locator('#lesson-title').fill('Второй урок')
  page.locator('#lesson-url').fill('https://youtu.be/dQw4w9WgXcQ')
  assert page.locator('#youtube-cover-preview').is_visible()
  page.locator('#lesson-category').select_option('newbie')
  page.locator('#lesson-form').evaluate('(form)=>form.requestSubmit()')
  page.wait_for_function('window.__ffDB.lessons.length===2')
  assert page.evaluate('window.__ffDB.lessons.find(x=>x.title==="Второй урок").order')==2
  # Up arrow changes ordering across the same language and section.
  page.locator('[data-lesson="lesson-2"] [data-delta="-1"]').click()
  page.wait_for_function('window.__ffDB.lessons.find(x=>x.id==="lesson-2").order===1')
  assert page.evaluate('window.__ffDB.lessons.find(x=>x.id==="lesson-advert").order')==2
  # Editing a lesson assigned to a hidden category must retain its category.
  page.locator('.nav-button[data-page="categories"]').click()
  page.locator('[data-category-edit="newbie"]').click()
  page.locator('#category-status').select_option('hidden')
  page.locator('#category-form').evaluate('(form)=>form.requestSubmit()')
  page.wait_for_function('window.__ffDB.catalog.find(x=>x.id==="newbie").status==="hidden"')
  page.locator('.nav-button[data-page="videos"]').click()
  page.locator('[data-lesson="lesson-advert"] [data-edit]').click()
  assert page.locator('#lesson-category').input_value()=='newbie'
  assert 'Скрыт' in page.locator('#lesson-category option:checked').inner_text()
  page.locator('#lesson-title').fill('Реклама: обновлено')
  page.locator('#lesson-form').evaluate('(form)=>form.requestSubmit()')
  page.wait_for_function('window.__ffDB.lessons.find(x=>x.id==="lesson-advert").title==="Реклама: обновлено"')
  assert page.evaluate('window.__ffDB.lessons.find(x=>x.id==="lesson-advert").leafCategoryId')=='newbie'
  # Confirm mobile menu remains available, without changing frozen shell design.
  page.set_viewport_size({'width':390,'height':844})
  page.locator('#open-sidebar').click()
  assert 'open' in page.locator('#sidebar').get_attribute('class')
  page.locator('.nav-button[data-page="overview"]').click()
  assert page.locator('#metric-all').inner_text()=='2'
  assert not errors, errors
  page.screenshot(path=str(ROOT/'tests/CMS08_browser_check.png'),full_page=True)
  print('PASS: login gate, seed, rename, soon/hidden, nested category, reparent guard, YouTube preview, create/order, hidden-category edit, mobile nav')
  browser.close()
finally:
 pass
