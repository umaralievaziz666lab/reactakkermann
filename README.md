# 🚀 Akkermann Pulse — React App

Корпоративная платформа безопасности для Telegram Mini App.

## Стек
- **React 18** + Vite
- **Supabase** (PostgreSQL + Realtime + Storage + Edge Functions)
- **Telegram WebApp SDK**
- **Tailwind CSS**

---

## 📦 Структура проекта

```
src/
  lib/supabase.js          — клиент Supabase, константы, утилиты
  App.jsx                  — главное приложение
  main.jsx                 — роутинг (/ → App, /admin → Admin)
  components/
    common/                — Toast, Modal, Avatar, BottomNav, LoadingDots
    feed/                  — FeedSection, FeedCard, DetailModal, CreateModal
    feed/                  — NotifSection, NewsSection
    profile/               — ProfileSection (геймификация, достижения, рейтинг)
    admin/                 — AdminLayout, Dashboard, Requests, Users, Depts, News
  pages/
    AdminApp.jsx           — авторизация Admin (2FA через Telegram)
```

---

## 🛠️ Быстрый старт

### 1. Настройте Supabase

1. Зайдите на [supabase.com](https://supabase.com) → создайте проект
2. Откройте **SQL Editor** и выполните содержимое файла `SUPABASE_SQL.sql`
3. Скопируйте **URL** и **anon key** из Settings → API

### 2. Создайте .env файл

```bash
cp .env.example .env
```

Заполните `.env`:
```env
VITE_SUPABASE_URL=https://xxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_BOT_TOKEN=12345678:AAF...
```

### 3. Локальный запуск

```bash
npm install
npm run dev
# Откройте http://localhost:5173
# Admin панель: http://localhost:5173/admin
```

### 4. Сборка для продакшна

```bash
npm run build
# Готовые файлы в папке dist/
```

---

## 🌐 Деплой на Vercel (рекомендуется)

### Вариант A — через CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

При первом деплое Vercel спросит настройки:
- Framework: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

Добавьте переменные окружения в Vercel Dashboard → Settings → Environment Variables.

### Вариант B — через GitHub

1. Залейте код на GitHub
2. Зайдите на [vercel.com](https://vercel.com) → New Project → Import
3. Добавьте Environment Variables в настройках
4. Deploy!

После деплоя получите URL вида: `https://akkermann-pulse.vercel.app`

---

## 📱 Настройка Telegram Mini App

### 1. Создайте бота (если ещё нет)

В Telegram найдите **@BotFather**:
```
/newbot
Название: Akkermann Pulse
Username: AkkermannPulseBot
```

Сохраните токен.

### 2. Создайте Mini App

```
/newapp
→ Выберите своего бота
→ Название: Akkermann Pulse
→ Описание: Система безопасности
→ URL: https://ваш-домен.vercel.app
```

### 3. Кнопка в меню бота

```
/setmenubutton
→ Выберите бота
→ URL: https://ваш-домен.vercel.app
→ Текст кнопки: 🚀 Открыть Pulse
```

### 4. Admin панель

Admin URL: `https://ваш-домен.vercel.app/admin`

Для входа нужен табельный номер пользователя с ролью `admin` или `manager`.

---

## ⚡ Supabase Edge Functions (уведомления)

### Деплой функций

```bash
# Установите Supabase CLI
npm install -g supabase

# Войдите в аккаунт
supabase login

# Привяжите к проекту
supabase link --project-ref ВАШ_PROJECT_REF

# Установите секреты
supabase secrets set BOT_TOKEN=ВАШ_ТОКЕН_БОТА

# Деплойте функции
supabase functions deploy send-code
supabase functions deploy send-push
```

### Webhook для автоматических уведомлений

В Supabase Dashboard → Database → Webhooks:

- **Name:** notify-on-insert
- **Table:** notifications
- **Events:** INSERT
- **URL:** `https://ВАSH_ПРОЕКТ.supabase.co/functions/v1/send-push`
- **HTTP Headers:** `Authorization: Bearer ВАШ_SERVICE_ROLE_KEY`

---

## 🏗️ Таблицы базы данных

| Таблица | Описание |
|---------|----------|
| `users` | Сотрудники (табельный номер = ID) |
| `departments` | Участки (с иерархией parent_id) |
| `requests` | Заявки (идеи и риски) |
| `comments` | Комментарии к заявкам |
| `likes` | Лайки (уникальные per user) |
| `notifications` | Push-уведомления |
| `news` | Новости и объявления |
| `achievements` | Достижения для геймификации |

---

## 👤 Роли пользователей

| Роль | Доступ |
|------|--------|
| `admin` | Полный доступ к admin панели |
| `manager` | Управление заявками |
| `engineer` | Назначенные заявки |
| `master` | Назначенные заявки |
| `staff` | Только мобильное приложение |

---

## 🔧 Часто задаваемые вопросы

**Q: Как изменить первого администратора?**
В SQL: `UPDATE users SET role = 'admin' WHERE id = 'ТАБЕЛЬНЫЙ_НОМЕР';`

**Q: Почему 2FA не приходит в Telegram?**
Убедитесь что:
1. Edge Function `send-code` задеплоена
2. Секрет `BOT_TOKEN` установлен в Supabase
3. У пользователя заполнено поле `telegram_id`

**Q: Как добавить участки?**
Через Admin панель → Участки, или напрямую в SQL.

**Q: Storage не работает?**
В Supabase Dashboard → Storage проверьте что бакет `media` создан и политики настроены (SQL уже это делает).
