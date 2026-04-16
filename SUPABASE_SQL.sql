-- ============================================================
-- AKKERMANN PULSE — ПОЛНАЯ СХЕМА БАЗЫ ДАННЫХ SUPABASE
-- Запустите этот SQL в Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. DEPARTMENTS (участки)
create table if not exists departments (
  id bigint generated always as identity primary key,
  name text not null,
  parent_id bigint references departments(id) on delete set null,
  created_at timestamptz default now()
);

-- 2. USERS (сотрудники)
create table if not exists users (
  id text primary key,  -- табельный номер
  name text not null,
  phone text,
  email text,
  department text,
  role text default 'staff' check (role in ('admin','manager','engineer','master','staff')),
  points integer default 0,
  telegram_id text,
  telegram_username text,
  telegram_first_name text,
  profile_pic text,
  is_trained boolean default false,
  completed_achievements text[] default '{}',
  referred_by text references users(id),
  two_fa_code text,
  two_fa_expires timestamptz,
  created_at timestamptz default now()
);

-- 3. REQUESTS (заявки: идеи и риски)
create table if not exists requests (
  id bigint generated always as identity primary key,
  type text not null check (type in ('idea','risk')),
  description text not null,
  author text,
  author_id text references users(id) on delete set null,
  anonymous boolean default false,
  location text,
  status text default 'new' check (status in ('new','work','approved','rejected','completed')),
  likes integer default 0,
  comments integer default 0,
  media jsonb,
  risk_urgency integer check (risk_urgency in (1,2,3)),
  risk_event_type text,
  assigned_to text,
  admin_comment text,
  completion_media jsonb,
  change_log jsonb default '[]',
  deadline timestamptz,
  date timestamptz default now(),
  created_at timestamptz default now()
);

-- 4. COMMENTS (комментарии к заявкам)
create table if not exists comments (
  id bigint generated always as identity primary key,
  post_id bigint references requests(id) on delete cascade,
  user_id text references users(id) on delete set null,
  author text,
  text text not null,
  created_at timestamptz default now()
);

-- 5. LIKES (лайки)
create table if not exists likes (
  id bigint generated always as identity primary key,
  post_id bigint references requests(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- 6. NOTIFICATIONS (уведомления)
create table if not exists notifications (
  id bigint generated always as identity primary key,
  user_id text references users(id) on delete cascade,
  title text not null,
  message text,
  post_id bigint,
  type text default 'system',
  read boolean default false,
  date timestamptz default now()
);

-- 7. NEWS (новости)
create table if not exists news (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  category text default 'general' check (category in ('announcement','achievement','safety','general')),
  target text default 'all',
  target_dept text,
  target_role text,
  author text,
  created_at timestamptz default now()
);

-- 8. ACHIEVEMENTS (достижения)
create table if not exists achievements (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  icon text default '🏅',
  points integer default 10,
  target_type text check (target_type in ('posts','ideas','risks','likes','points')),
  target integer default 1,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS (Row Level Security) — ПОЛИТИКИ ДОСТУПА
-- ============================================================

-- Включаем RLS
alter table departments enable row level security;
alter table users enable row level security;
alter table requests enable row level security;
alter table comments enable row level security;
alter table likes enable row level security;
alter table notifications enable row level security;
alter table news enable row level security;
alter table achievements enable row level security;

-- Departments — все могут читать
create policy "departments_read" on departments for select using (true);
create policy "departments_write" on departments for all using (true) with check (true);

-- Users — все могут читать (для лидерборда), писать только себя
create policy "users_read" on users for select using (true);
create policy "users_write" on users for insert with check (true);
create policy "users_update" on users for update using (true);
create policy "users_delete" on users for delete using (true);

-- Requests — все могут читать, авторизованные писать
create policy "requests_read" on requests for select using (true);
create policy "requests_insert" on requests for insert with check (true);
create policy "requests_update" on requests for update using (true);

-- Comments
create policy "comments_read" on comments for select using (true);
create policy "comments_insert" on comments for insert with check (true);
create policy "comments_delete" on comments for delete using (true);

-- Likes
create policy "likes_read" on likes for select using (true);
create policy "likes_insert" on likes for insert with check (true);
create policy "likes_delete" on likes for delete using (true);

-- Notifications — только свои
create policy "notifications_read" on notifications for select using (true);
create policy "notifications_insert" on notifications for insert with check (true);
create policy "notifications_update" on notifications for update using (true);

-- News
create policy "news_read" on news for select using (true);
create policy "news_insert" on news for insert with check (true);
create policy "news_delete" on news for delete using (true);

-- Achievements
create policy "achievements_read" on achievements for select using (true);
create policy "achievements_write" on achievements for all using (true) with check (true);

-- ============================================================
-- STORAGE BUCKET (для медиафайлов)
-- ============================================================
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media_public_read" on storage.objects for select using (bucket_id = 'media');
create policy "media_insert" on storage.objects for insert with check (bucket_id = 'media');
create policy "media_delete" on storage.objects for delete using (bucket_id = 'media');

-- ============================================================
-- REALTIME (включаем для нужных таблиц)
-- ============================================================
alter publication supabase_realtime add table requests;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table comments;

-- ============================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ — УЧАСТКИ
-- ============================================================
insert into departments (name) values
  ('Производство'),
  ('Склад'),
  ('Офис'),
  ('Отдел охраны труда'),
  ('Техническое обслуживание')
on conflict do nothing;

-- Дочерние участки (замените id родителей на реальные после вставки выше)
-- insert into departments (name, parent_id) values ('Цех №1', 1), ('Цех №2', 1);

-- ============================================================
-- НАЧАЛЬНЫЕ ДОСТИЖЕНИЯ
-- ============================================================
insert into achievements (title, description, icon, points, target_type, target) values
  ('Первый шаг',     'Опубликуйте первую заявку',    '🌱', 20,  'posts', 1),
  ('Активный',       'Опубликуйте 5 заявок',         '⚡', 30,  'posts', 5),
  ('Профессионал',   'Опубликуйте 20 заявок',        '🚀', 50,  'posts', 20),
  ('Генератор идей', 'Предложите 10 идей',           '💡', 40,  'ideas', 10),
  ('Страж безопасности', 'Сообщите о 10 рисках',    '🛡️', 50,  'risks', 10),
  ('Популярный',     'Наберите 50 лайков',           '❤️', 30,  'likes', 50),
  ('Ветеран',        'Наберите 500 ТОП баллов',      '🏆', 100, 'points', 500),
  ('Легенда',        'Наберите 2000 ТОП баллов',     '👑', 200, 'points', 2000)
on conflict do nothing;

-- ============================================================
-- ПЕРВЫЙ АДМИНИСТРАТОР (измените данные на свои!)
-- ============================================================
insert into users (id, name, role, points, department) values
  ('00001', 'Администратор', 'admin', 0, 'Офис')
on conflict (id) do nothing;
