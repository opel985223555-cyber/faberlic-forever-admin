# Faberlic Forever SYNC-04: YouTube error 153

## Причина
YouTube блокирует встроенный проигрыватель с ошибкой 153, если в запросе нет `HTTP Referer` или аналогичной идентификации. У старого iframe родительская HTML-страница открывалась по `file:///android_asset/www/index.html`, откуда браузер не передаёт корректный HTTPS Referer.

## Изолированное исправление
- `MainActivity.java`: добавлен `WebViewAssetLoader` для **одной дополнительной локальной HTTPS-страницы плеера**. Главная HTML-страница приложения по-прежнему открывается через `file:///android_asset/www/index.html`.
- `modules/lesson.js`: iframe урока теперь показывает локальную страницу `https://tj.faberlic.forever/assets/www/player/index.html?v=YOUTUBE_ID`, а не сразу видео YouTube.
- `player/index.html` (**новый файл**): локальная обёртка, которая из HTTPS-origin `tj.faberlic.forever` вставляет YouTube iframe с `referrerpolicy="strict-origin-when-cross-origin"`. Это идентификатор установленного приложения и виртуальный адрес, локально обслуживаемый WebViewAssetLoader, а не внешний сайт.
- `app/build.gradle`: добавлена зависимость AndroidX WebKit 1.16.0 и увеличен `versionCode` до 4 (`0.9.3-player153`).

**Данные избранного, языка и истории:** из-за того, что origin главного экрана `file://` **не меняется**, существующие `localStorage`-настройки сохраняют прежнюю область хранения.

## Что НЕ менялось
`modules/categories.js`, `modules/firebase-lessons.js`, `core/navigation.js`, другие вкладки, CSS, Firebase-bridge, экран запуска/анимация, иконка, шрифты, все трёхъязычные строки и расположение элементов остались прежними.

## Проверка на Android
1. Открой ZIP как проект в Android Studio, дождись Gradle Sync, собери APK (Build → Build APK(s)).
2. Установи поверх предыдущей версии, **не удаляя данные** (package `tj.faberlic.forever`).
3. Открой «Категории» → «Новичку» → видео «Реклама». Оно должно воспроизводиться внутри приложения без ошибки 153.
4. Проверь «Продукция», «Продажи», «Рекрутинг», «Избранное», языки RU/TJ/UZ, «Назад» и короткую заставку.
5. Если видео всё ещё не играет, приложи скрин ошибки и logcat WebView/Chromium. Не всякое видео разрешено для встраивания (ошибки 101/150).

## Важно
Код проверен статически и регрессионными тестами экрана урока/категорий. **Работу YouTube внутри Android WebView в реальной сети пока нельзя считать подтверждённой**: в этой среде нет Android SDK/эмулятора.

Официальные источники:
https://developers.google.com/youtube/terms/required-minimum-functionality
https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader
