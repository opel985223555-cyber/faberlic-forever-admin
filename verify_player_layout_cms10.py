from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent/'app/src/main/assets/www'
html=(root/'index.html').read_text()
css=(root/'styles.css').read_text()+(root/'modules/categories.css').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for w,h in [(360,760),(390,844),(430,932)]:
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  page.set_content(html,wait_until='domcontentloaded')
  page.add_style_tag(content=css)
  page.evaluate('''() => {
    document.querySelector('#lessonOverlay').classList.add('show');
    document.querySelector('#lessonTitle').textContent='Как скачать приложение Фаберлик';
    document.querySelector('#lessonCat').textContent='НОВИЧКУ · RU';
    document.querySelector('#player').className='player vertical';
    document.querySelector('#player').innerHTML='';
    document.querySelector('#favoriteBtn').textContent='♡';
  }''')
  a=page.locator('#player').bounding_box();b=page.locator('#lessonCat').bounding_box();c=page.locator('#lessonFullscreenBtn').bounding_box();heart=page.locator('#favoriteBtn').bounding_box()
  assert a and b and c and heart
  assert b['y']>=a['y']+a['height']+8, (w,'caption touches player')
  assert abs(b['y']-c['y'])<15, (w,'caption and button are not on same row')
  assert c['x']>b['x']+b['width']-2, (w,'button overlaps text')
  assert c['x']+c['width']<=w, (w,'fullscreen button clipped')
  assert heart['x']>w/2, (w,'heart moved left')
  if w==390:page.screenshot(path=str(Path(__file__).parent/'player_layout_cms10.png'))
  print(f'PASS viewport {w}x{h}: caption below video, button beside caption, heart right')
  page.close()
 browser.close()
