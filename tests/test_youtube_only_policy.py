"""Static checks: admin panel uses only YouTube thumbnail URLs, without file uploads."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
index=(root/'index.html').read_text(encoding='utf8')
video_js=(root/'assets/js/modules/videos.js').read_text(encoding='utf8')
for name in ['lesson-cover-mode','banner-cover-mode','lesson-cover-file','banner-cover-file','type="file"']:
    assert name not in index and name not in video_js, name
assert 'youtube-cover-preview' in index and 'i.ytimg.com' in video_js
assert 'coverData' not in video_js and 'bannerCoverData' not in video_js
assert 'data-move=' in video_js and 'data-delta=' in video_js
assert 'data-module="categories"' in index
assert 'id="lesson-order"' not in index
print('PASS: YouTube-only admin, no own-photo uploads, manual arrow ordering, editable categories')
