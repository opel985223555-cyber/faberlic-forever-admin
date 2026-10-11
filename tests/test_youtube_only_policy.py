"""Static safety checks: no custom thumbnail upload feature remains."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
index=(root/'index.html').read_text()
video_js=(root/'assets/js/modules/videos.js').read_text()
android=(root.parent/'Faberlic_Forever_CMS07_AndroidStudio/app/src/main/assets/www/modules/youtube-covers.js').read_text()
for name in ['lesson-cover-mode','banner-cover-mode','lesson-cover-file','banner-cover-file']:
    assert name not in index and name not in video_js, name
assert 'youtube-cover-preview' in index and 'i.ytimg.com' in video_js
assert 'coverData' not in video_js and 'bannerCoverData' not in video_js
assert 'coverData' not in android and 'bannerCoverData' not in android
assert 'data-move=' in video_js and 'data-delta=' in video_js
assert 'data-module="categories"' in index
print('PASS: YouTube-only UI + renderer; manual ordering and editable categories remain')
