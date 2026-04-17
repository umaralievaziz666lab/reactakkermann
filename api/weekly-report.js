// ============================================================
// VERCEL API ROUTE — Еженедельный отчёт
// Вызывать: POST /api/weekly-report
// Для автоматики: настроить Vercel Cron Job (см. ниже)
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)
const BOT_TOKEN = process.env.VITE_BOT_TOKEN

async function sendTG(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Security check - only allow with secret key
  const secret = req.headers['x-cron-secret'] || req.body?.secret
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  try {
    // Load stats for the week
    const [
      { count: totalNew },
      { count: totalIdeas },
      { count: totalRisks },
      { count: totalCompleted },
      { count: risk1Count },
      { data: topUsers },
      { data: overdue },
    ] = await Promise.all([
      supabase.from('requests').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('type', 'idea').gte('created_at', weekAgo.toISOString()),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('type', 'risk').gte('created_at', weekAgo.toISOString()),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', weekAgo.toISOString()),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('type', 'risk').eq('risk_urgency', 1).gte('created_at', weekAgo.toISOString()),
      supabase.from('users').select('id,name,telegram_id,points,department').order('points', { ascending: false }).limit(3),
      supabase.from('requests').select('id,description,deadline,location').not('deadline', 'is', null).lt('deadline', now.toISOString()).not('status', 'in', '("completed","rejected")').limit(5),
    ])

    const weekStr = `${weekAgo.toLocaleDateString('ru', { day: '2-digit', month: 'short' })} — ${now.toLocaleDateString('ru', { day: '2-digit', month: 'short' })}`

    const report = `📊 *ЕЖЕНЕДЕЛЬНЫЙ ОТЧЁТ AKKERMANN PULSE*
_${weekStr}_

📋 *Заявок за неделю:* ${totalNew || 0}
💡 Идей: ${totalIdeas || 0}  ⚠️ Рисков: ${totalRisks || 0}
${risk1Count > 0 ? `🚨 Критических рисков L1: *${risk1Count}*\n` : ''}✅ Выполнено: ${totalCompleted || 0}

🏆 *Топ-3 сотрудника:*
${(topUsers || []).slice(0, 3).map((u, i) => `${['🥇','🥈','🥉'][i]} ${u.name} — ${u.points} ТОП`).join('\n')}

${overdue && overdue.length > 0 ? `⏰ *Просроченных дедлайнов: ${overdue.length}*\n${overdue.slice(0,3).map(r => `• #${String(r.id).padStart(5,'0')} — ${r.location || '—'}`).join('\n')}\n` : '✅ Просроченных дедлайнов нет\n'}
_Akkermann Pulse · Система безопасности_`

    // Send to all admins and managers
    const { data: recipients } = await supabase
      .from('users')
      .select('id,telegram_id,name')
      .in('role', ['admin', 'manager'])
      .not('telegram_id', 'is', null)

    let sent = 0
    for (const u of recipients || []) {
      if (u.telegram_id) {
        await sendTG(u.telegram_id, report)
        sent++
      }
    }

    return res.status(200).json({ ok: true, sent, stats: { totalNew, totalIdeas, totalRisks, totalCompleted } })
  } catch (err) {
    console.error('Weekly report error:', err)
    return res.status(500).json({ error: err.message })
  }
}
