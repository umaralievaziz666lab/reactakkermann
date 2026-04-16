import React, { useState, useEffect } from 'react'
import { supabase, fmtDate } from '../../lib/supabase.js'
import LoadingDots from '../common/LoadingDots.jsx'

const CAT_MAP = {
  announcement: { icon: '📢', label: 'Объявление', color: '#3b82f6' },
  achievement:  { icon: '🏆', label: 'Достижение', color: '#f59e0b' },
  safety:       { icon: '🛡️', label: 'Безопасность', color: '#22c55e' },
  general:      { icon: '📌', label: 'Общее', color: '#6b7280' },
}

export default function NewsSection({ user, showToast }) {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { loadNews() }, [])

  async function loadNews() {
    setLoading(true)
    let q = supabase.from('news').select('*').order('created_at', { ascending: false }).limit(30)
    // Filter by target
    // (news targeted to user's dept or role or all)
    const { data } = await q
    setNews(data || [])
    setLoading(false)
  }

  return (
    <div style={{ paddingBottom: 'calc(74px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ background: 'var(--navy)', borderBottom: '3px solid var(--red)', padding: '14px 16px' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '.1em' }}>
          📰 Новости
        </div>
      </div>

      <div style={{ padding: 12 }}>
        {loading ? <LoadingDots /> : news.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t3)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
            <div>Новостей пока нет</div>
          </div>
        ) : news.map(n => {
          const cat = CAT_MAP[n.category] || CAT_MAP.general
          const isOpen = expanded === n.id
          return (
            <div key={n.id} style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 4, marginBottom: 8, overflow: 'hidden' }}>
              <div onClick={() => setExpanded(isOpen ? null : n.id)} style={{ padding: '12px 14px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${cat.color}18`, color: cat.color }}>{cat.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--t4)', marginLeft: 'auto' }}>{fmtDate(n.created_at)}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.4 }}>{n.title}</div>
                {!isOpen && <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.content}</div>}
              </div>
              {isOpen && (
                <div style={{ padding: '0 14px 14px', fontSize: 13, color: 'var(--t2)', lineHeight: 1.7, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
                  {n.content}
                  {n.author && <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 10 }}>— {n.author}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
