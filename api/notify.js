// ============================================================
// VERCEL API ROUTE — Telegram уведомления
// Файл: api/notify.js
// URL: https://ваш-домен.vercel.app/api/notify
// ============================================================

export default async function handler(req, res) {
  // Разрешаем только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const BOT_TOKEN = process.env.VITE_BOT_TOKEN
  if (!BOT_TOKEN) {
    return res.status(500).json({ error: 'BOT_TOKEN not configured' })
  }

  const { telegram_id, title, message, type } = req.body

  if (!telegram_id || !title) {
    return res.status(400).json({ error: 'Missing telegram_id or title' })
  }

  // Формируем текст в зависимости от типа
  const icons = {
    status_update: '🔄',
    comment:       '💬',
    risk1:         '🚨',
    achievement:   '🏅',
    news:          '📢',
    deadline:      '⏰',
    daily_task:    '🎯',
    system:        'ℹ️',
  }

  const icon = icons[type] || '🔔'
  const text = `${icon} *${escapeMarkdown(title)}*\n\n${escapeMarkdown(message || '')}`

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegram_id,
          text,
          parse_mode: 'Markdown',
        }),
      }
    )

    const result = await response.json()

    if (!result.ok) {
      console.error('Telegram error:', result)
      return res.status(200).json({ ok: false, error: result.description })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Fetch error:', err)
    return res.status(500).json({ error: err.message })
  }
}

function escapeMarkdown(text) {
  return String(text)
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/`/g, '\\`')
}
