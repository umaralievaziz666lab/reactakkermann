import React, { useState, useEffect } from 'react'
import { supabase, fmtDate, STATUS_MAP } from '../../lib/supabase.js'

export default function AdminDashboard({ showToast, onPageChange }) {
  const [stats, setStats] = useState({ total: 0, new: 0, ideas: 0, risks: 0, users: 0, completed: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('requests').select('*', { count: 'exact', head: true }),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('requests').select('id,type,status,description,author,location,date,created_at,risk_urgency').order('id', { ascending: false }).limit(10),
    ])
    const [ideas, risks, completed] = await Promise.all([
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('type', 'idea'),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('type', 'risk'),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    ])
    setStats({
      total: r1.count || 0, new: r2.count || 0,
      users: r3.count || 0, ideas: ideas.count || 0,
      risks: risks.count || 0, completed: completed.count || 0,
    })
    setRecent(r4.data || [])
    setLoading(false)
  }

  const STAT_CARDS = [
    { label: 'Всего заявок', value: stats.total, icon: '📋', color: '#3b82f6' },
    { label: 'Новые',        value: stats.new,   icon: '🔔', color: '#f59e0b', click: () => onPageChange('requests') },
    { label: 'Идей',         value: stats.ideas, icon: '💡', color: '#22c55e' },
    { label: 'Рисков',       value: stats.risks, icon: '⚠️', color: '#ef4444' },
    { label: 'Выполнено',    value: stats.completed, icon: '✅', color: '#8b5cf6' },
    { label: 'Пользователей', value: stats.users, icon: '👥', color: '#06b6d4', click: () => onPageChange('users') },
  ]

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {STAT_CARDS.map(({ label, value, icon, color, click }) => (
          <div key={label} onClick={click} style={{
            background: '#fff', borderRadius: 3, padding: '14px 16px',
            border: '1px solid var(--bd)', borderTop: `3px solid ${color}`,
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: click ? 'pointer' : 'default',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)' }}>{loading ? '…' : value}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent requests */}
      <div style={{ background: '#fff', borderRadius: 3, border: '1px solid var(--bd)', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '11px 16px', borderBottom: '2px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--navy)' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '.05em' }}>Последние заявки</span>
          <button onClick={() => onPageChange('requests')} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 3, padding: '4px 10px', color: '#e8e7e3', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Все →</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['ID','Тип','Автор','Участок','Дата','Статус'].map(h => (
                  <th key={h} style={{ padding: '8px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#e8e7e3', textTransform: 'uppercase', letterSpacing: '.06em', background: 'var(--navy)', borderBottom: '2px solid var(--red)', whiteSpace: 'nowrap', fontFamily: "'Barlow Condensed', sans-serif" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map(r => {
                const st = STATUS_MAP[r.status] || STATUS_MAP.new
                return (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.background = '#f5f4f0'} onMouseOut={e => e.currentTarget.style.background = ''}>
                    <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--acc)' }}>#{String(r.id).padStart(5,'0')}</span></td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: r.type === 'risk' ? '#fff7ed' : '#ecfdf5', color: r.type === 'risk' ? '#c2410c' : '#059669' }}>
                        {r.type === 'risk' ? '⚠️ Риск' : '💡 Идея'}
                      </span>
                    </td>
                    <td style={tdStyle}>{r.author || '—'}</td>
                    <td style={tdStyle}>{r.location || '—'}</td>
                    <td style={tdStyle}>{fmtDate(r.date || r.created_at)}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${st.color}18`, color: st.color }}>{st.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk level 1 alert */}
      <Level1Alert />
    </div>
  )
}

function Level1Alert() {
  const [lvl1, setLvl1] = useState([])

  useEffect(() => {
    supabase.from('requests').select('id,description,location,date,created_at').eq('type','risk').eq('risk_urgency',1).in('status',['new','work']).order('id',{ascending:false}).limit(5)
      .then(({ data }) => setLvl1(data || []))
  }, [])

  if (!lvl1.length) return null

  return (
    <div style={{ background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 3, padding: 16, borderLeft: '4px solid #dc2626' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626', marginBottom: 10 }}>🚨 ОТКРЫТЫЕ РИСКИ УРОВЕНЬ 1</div>
      {lvl1.map(r => (
        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #fecaca' }}>
          <span style={{ fontSize: 12, color: '#7f1d1d' }}>#{String(r.id).padStart(5,'0')} — {r.location || '—'}</span>
          <span style={{ fontSize: 11, color: '#991b1b' }}>{fmtDate(r.date || r.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

const tdStyle = { padding: '9px 13px', fontSize: 13, color: 'var(--t2)', borderBottom: '1px solid var(--bg3)', verticalAlign: 'middle' }
