# Локальные проверки админки и правил
Из корня проекта установите тестовые зависимости в отдельной копии: `npm install --no-save playwright firebase firebase-admin @firebase/rules-unit-testing firebase-tools@13.35.1`. Нужны Node.js, Java 17+ и Edge (или FF_BROWSER_PATH).

Браузер: `node verification/test_admin_browser.cjs` — полностью поддельный SDK, без сети Firebase.

Правила: `npx firebase emulators:exec --config firebase.test.json --only firestore --project demo-ff-full-update "node verification/test_access_rules.cjs && node verification/test_catalog_publication.cjs"`.
Оба теста правил отказываются запускаться без локального FIRESTORE_EMULATOR_HOST. Не подставляйте рабочий projectId. Фикстура — только каталог категорий для регрессии формы полей, без аккаунтов и промокодов. Остальные JSON — отчёт всей проверки комплекта, а не native device тесты.
