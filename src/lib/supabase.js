import { createClient } from '@supabase/supabase-js'

// ⚠️ Замените на свои данные из Supabase Dashboard → Settings → API
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const BOT_TOKEN = import.meta.env.VITE_BOT_TOKEN || ''

// Levels system
export const LEVELS = [
  { min: 0,    max: 99,   label: '⚙️ Новичок',     cls: 'lv1' },
  { min: 100,  max: 299,  label: '🔧 Стажёр',      cls: 'lv2' },
  { min: 300,  max: 599,  label: '🛠️ Мастер',      cls: 'lv3' },
  { min: 600,  max: 999,  label: '⚡ Специалист',   cls: 'lv4' },
  { min: 1000, max: 1999, label: '🚀 Эксперт',     cls: 'lv5' },
  { min: 2000, max: 3999, label: '🏆 Профи',       cls: 'lv6' },
  { min: 4000, max: 7999, label: '💎 Элита',       cls: 'lv7' },
  { min: 8000, max: Infinity, label: '👑 Легенда', cls: 'lv8' },
]

export const POINTS = {
  idea: 20, risk: 30, risk1: 50, like_received: 5,
  comment: 3, status_approved: 25, status_completed: 50,
  training: 40, referral: 50,
}

export const STATUS_MAP = {
  new:       { label: 'Новая',     color: '#6b7280' },
  work:      { label: 'В работе',  color: '#3b82f6' },
  approved:  { label: 'Принята',   color: '#22c55e' },
  rejected:  { label: 'Отклонена', color: '#ef4444' },
  completed: { label: 'Выполнена', color: '#8b5cf6' },
}

export const PAGE_SIZE = 20

export function lvlInfo(pts) {
  return LEVELS.find(l => pts >= l.min && pts <= l.max) || LEVELS[0]
}

export function pad(id) {
  return '#' + String(id).padStart(5, '0')
}

export function initials(name) {
  if (!name || name === 'Аноним') return '?'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function fmtDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

export function avatarColor(name) {
  const colors = ['#f53d2d','#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4']
  let h = 0
  for (let i = 0; i < (name||'').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

// Storage helper (Telegram WebApp safe)
export const store = {
  get: (k) => {
    try { return localStorage.getItem(k) } catch { return null }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, v) } catch {}
  },
  del: (k) => {
    try { localStorage.removeItem(k) } catch {}
  }
}
