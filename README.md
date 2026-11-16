# Hisobly — Telegram Mini App

Личный учёт доходов и расходов в UZS. Рабочее название: **Hisobly**. В BotFather допустимый username: `hisobly_bot` (если свободен); запасные варианты: `hisoblyapp_bot`, `myhisob_bot`.

## Что реализовано в исходниках

- серверная HMAC-проверка Telegram `initData`, cookie-сессия, роли USER/ADMIN/OWNER;
- изоляция финансов по владельцу, подписка и бан на каждом финансовом API;
- операции UZS с зафиксированным курсом USD, категории только расходов, аналитика;
- админские подписки, бан, аудит и рассылка без доступа к чужим финансам;
- Mini App интерфейс с 5 вкладками, темой Telegram, RU/UZ/EN;
- Prisma-схема PostgreSQL и бот с `/start`.

## Быстрый запуск

1. `Copy-Item .env.example .env` и заполните значения без кавычек.
2. Создайте PostgreSQL базу `hisobly`.
3. `npm install`
4. `npm run db:generate`
5. `npm run db:migrate -- --name init`
6. `npm run dev`

Web: `http://localhost:5173`, API: `http://localhost:3000`. Для реального Telegram нужен HTTPS URL: задайте его в `WEB_APP_URL`, настройте Menu Button в BotFather и webhook/long polling бота. Перед production также нужны ID владельца, контакт администратора, карта, тарифы, домен и политика конфиденциальности — в ТЗ их нет.

`initData` не хранится в логах и никогда не доверяется с фронтенда без проверки сервером.
