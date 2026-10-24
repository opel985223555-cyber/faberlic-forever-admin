"""Static player and asset coverage. Does not certify playback on Android."""
from pathlib import Path
import re
r=Path(__file__).resolve().parents[1]
main=(r/'app/src/main/java/tj/faberlic/forever/MainActivity.java').read_text()
lesson=(r/'app/src/main/assets/www/modules/lesson.js').read_text()
player=(r/'app/src/main/assets/www/player/index.html').read_text()
grad=(r/'app/build.gradle').read_text()
assert 'webView.loadUrl("file:///android_asset/www/index.html")' in main, 'Must preserve old main origin'
assert '"file:///android_asset/www/index.html".equals(url)' in main, 'Must preserve splash callback'
assert '.setDomain("tj.faberlic.forever")' in main
assert '.addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))' in main
assert 'playerAssetLoader.shouldInterceptRequest(request.getUrl())' in main
assert 'https://tj.faberlic.forever/assets/www/player/index.html?v=' in lesson
assert 'https://www.youtube-nocookie.com/embed/' in player
assert 'strict-origin-when-cross-origin' in player
assert '/^[A-Za-z0-9_-]{11}$/' in player
assert "implementation 'androidx.webkit:webkit:1.16.0'" in grad
assert int(re.search(r'versionCode\s+(\d+)',grad).group(1))>=4
assert (r/'app/src/main/assets/www/player/index.html').is_file()
print('PASS: isolated HTTPS nested player, original WebView origin and splash preserved')
