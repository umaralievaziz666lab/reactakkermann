import React, { useState, useEffect } from 'react'
import { supabase, pad, fmtDate, lvlInfo, STATUS_MAP, avatarColor, initials } from '../../lib/supabase.js'
import LoadingDots from '../common/LoadingDots.jsx'

export default function UserReport({ userId, onClose }) {
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  useEffect(() => { loadAll() }, [userId])

  async function loadAll() {
    setLoading(true)
    const [{ data: u }, { data: p }, { data: c }] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('requests').select('*').or(`author_id.eq.${userId}`).order('id', { ascending: false }),
      supabase.from('comments').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ])
    setUser(u)
    setPosts(p || [])
    setComments(c || [])
    setLoading(false)
  }

  if (loading) return (
    <Overlay onClose={onClose}>
      <LoadingDots />
    </Overlay>
  )

  if (!user) return (
    <Overlay onClose={onClose}>
      <div style={{ textAlign: 'center', padding: 40, color: '#5a7080' }}>Пользователь не найден</div>
    </Overlay>
  )

  const lv = lvlInfo(user.points || 0)
  const ideas = posts.filter(p => p.type === 'idea')
  const risks = posts.filter(p => p.type === 'risk')
  const completed = posts.filter(p => p.status === 'completed')
  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0)
  const risk1 = risks.filter(p => p.risk_urgency === 1)

  // Activity by day (last 30 days)
  const activityMap = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    activityMap[key] = 0
  }
  posts.forEach(p => {
    const key = (p.date || p.created_at || '').slice(0, 10)
    if (activityMap[key] !== undefined) activityMap[key]++
  })
  const activityDays = Object.entries(activityMap)
  const maxActivity = Math.max(...Object.values(activityMap), 1)

  // Status distribution
  const statusDist = {}
  posts.forEach(p => { statusDist[p.status] = (statusDist[p.status] || 0) + 1 })

  const ROLE_LABELS = { admin: 'Администратор', manager: 'Менеджер', engineer: 'Инженер', master: 'Мастер', staff: 'Сотрудник' }

  return (
    <Overlay onClose={onClose}>
      {/* Header */}
      <div style={{ padding: '20px 24px', background: '#0f1c2c', borderBottom: '3px solid #f53d2d' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          {user.profile_pic
            ? <img src={user.profile_pic} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,.15)' }} />
            : <div style={{ width: 64, height: 64, borderRadius: '50%', background: avatarColor(user.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 800, flexShrink: 0, border: '3px solid rgba(255,255,255,.15)' }}>
                {initials(user.name)}
              </div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#e8e7e3' }}>{user.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(232,231,227,.5)', marginTop: 2 }}>{user.department}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span className={`level-badge ${lv.cls}`} style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{lv.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3, background: 'rgba(245,61,45,.2)', color: '#fca5a5' }}>{ROLE_LABELS[user.role] || user.role}</span>
              {user.is_trained && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3, background: 'rgba(34,197,94,.2)', color: '#86efac' }}>🎓 Обучен</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#f53d2d' }}>{user.points || 0}</div>
            <div style={{ fontSize: 10, color: 'rgba(232,231,227,.4)', textTransform: 'uppercase' }}>ТОП баллов</div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
          {[
            { label: 'Заявок', value: posts.length, color: '#3b82f6' },
            { label: 'Идей', value: ideas.length, color: '#22c55e' },
            { label: 'Рисков', value: risks.length, color: '#ef4444' },
            { label: 'Решено', value: completed.length, color: '#8b5cf6' },
            { label: 'Лайков', value: totalLikes, color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: '8px 4px', textAlign: 'center', border: `1px solid ${color}33` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 9, color: 'rgba(232,231,227,.4)', textTransform: 'uppercase', marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #d1cfc9', background: '#fff' }}>
        {[['overview','📊 Обзор'], ['posts','📋 Заявки'], ['activity','📈 Активность']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer',
            background: 'none', fontSize: 12, fontWeight: 700,
            color: tab === t ? '#f53d2d' : '#5a7080',
            borderBottom: `2px solid ${tab === t ? '#f53d2d' : 'transparent'}`,
          }}>{l}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>

        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Risk Level 1 alert */}
            {risk1.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', marginBottom: 4 }}>🚨 Риски уровень 1: {risk1.length}</div>
                {risk1.slice(0, 3).map(r => (
                  <div key={r.id} style={{ fontSize: 12, color: '#7f1d1d', marginTop: 3 }}>
                    {pad(r.id)} · {r.location || '—'} · {fmtDate(r.date || r.created_at)}
                  </div>
                ))}
              </div>
            )}

            {/* Статусы заявок */}
            <div style={{ background: '#fff', border: '1px solid #d1cfc9', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1c2c', marginBottom: 12, fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>
                Статусы заявок
              </div>
              {Object.entries(statusDist).map(([status, count]) => {
                const st = STATUS_MAP[status] || STATUS_MAP.new
                const pct = Math.round((count / posts.length) * 100)
                return (
                  <div key={status} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: '#2a3f52' }}>{st.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: st.color }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: '#f2f1ee', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: st.color, borderRadius: 999, transition: 'width .5s' }} />
                    </div>
                  </div>
                )
              })}
              {posts.length === 0 && <div style={{ color: '#8fa0ae', fontSize: 13 }}>Заявок нет</div>}
            </div>

            {/* Контактная информация */}
            <div style={{ background: '#fff', border: '1px solid #d1cfc9', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1c2c', marginBottom: 12, fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>
                Контакты
              </div>
              {[
                { label: 'Табельный', value: user.id },
                { label: 'Телефон', value: user.phone || '—' },
                { label: 'Email', value: user.email || '—' },
                { label: 'Telegram ID', value: user.telegram_id || '—' },
                { label: 'Username', value: user.telegram_username ? `@${user.telegram_username}` : '—' },
                { label: 'Комментариев', value: comments.length },
                { label: 'Рефералов', value: `REF_${user.id}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f2f1ee' }}>
                  <span style={{ fontSize: 12, color: '#5a7080' }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#0f1c2c' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'posts' && (
          <div>
            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8fa0ae' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div>Заявок нет</div>
              </div>
            ) : posts.map(p => {
              const st = STATUS_MAP[p.status] || STATUS_MAP.new
              return (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #d1cfc9', borderLeft: `3px solid ${p.type === 'risk' ? '#ef4444' : '#22c55e'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#f53d2d', fontWeight: 700 }}>{pad(p.id)}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: p.type === 'risk' ? '#fff7ed' : '#ecfdf5', color: p.type === 'risk' ? '#c2410c' : '#059669' }}>
                      {p.type === 'risk' ? `⚠️ Риск${p.risk_urgency ? ` L${p.risk_urgency}` : ''}` : '💡 Идея'}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: `${st.color}18`, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#2a3f52', lineHeight: 1.5, marginBottom: 4 }}>
                    {(p.description || '').slice(0, 100)}{(p.description || '').length > 100 ? '…' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: '#8fa0ae' }}>
                    📍 {p.location || '—'} · {fmtDate(p.date || p.created_at)} · ❤️ {p.likes || 0}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'activity' && (
          <div>
            {/* Activity heatmap */}
            <div style={{ background: '#fff', border: '1px solid #d1cfc9', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1c2c', marginBottom: 12, fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>
                📅 Активность за 30 дней
              </div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {activityDays.map(([date, count]) => (
                  <div key={date} title={`${date}: ${count} заявок`} style={{
                    width: 28, height: 28, borderRadius: 4,
                    background: count === 0
                      ? '#f2f1ee'
                      : count === 1 ? '#fecaca'
                      : count <= 3 ? '#f87171'
                      : '#ef4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700,
                    color: count > 0 ? '#fff' : '#d1cfc9',
                    cursor: 'default', transition: '.2s',
                  }}>
                    {count > 0 ? count : ''}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#8fa0ae' }}>Меньше</span>
                {['#f2f1ee','#fecaca','#f87171','#ef4444'].map((c,i) => (
                  <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
                ))}
                <span style={{ fontSize: 10, color: '#8fa0ae' }}>Больше</span>
              </div>
            </div>

            {/* Bar chart по дням */}
            <div style={{ background: '#fff', border: '1px solid #d1cfc9', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1c2c', marginBottom: 12, fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>
                📊 График заявок
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
                {activityDays.slice(-14).map(([date, count]) => (
                  <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    {count > 0 && <div style={{ fontSize: 8, color: '#8fa0ae', marginBottom: 2 }}>{count}</div>}
                    <div style={{
                      width: '100%',
                      height: `${Math.max((count / maxActivity) * 85, count > 0 ? 4 : 0)}px`,
                      background: 'linear-gradient(180deg,#f53d2d,#c42b1c)',
                      borderRadius: '3px 3px 0 0', minHeight: count > 0 ? 4 : 0,
                      transition: 'height .5s',
                    }} />
                    <div style={{ fontSize: 7, color: '#8fa0ae', marginTop: 3, transform: 'rotate(-40deg)', whiteSpace: 'nowrap' }}>
                      {date.slice(5)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  )
}

function Overlay({ onClose, children }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="fade-in" style={{
        background: '#f2f1ee', borderRadius: 12, width: '100%', maxWidth: 680,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,.4)', overflow: 'hidden',
        border: '1px solid #d1cfc9',
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', background: '#0f1c2c', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, padding: '4px 12px', color: '#e8e7e3', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ✕ Закрыть
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
