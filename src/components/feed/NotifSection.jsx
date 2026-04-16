import React, { useState, useEffect } from 'react'
import { supabase, fmtDate } from '../../lib/supabase.js'
import LoadingDots from '../common/LoadingDots.jsx'

export default function NotifSection({ user, onBadgeUpdate, showToast, goToFeed }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifs()
  }, [])

  async function loadNotifs() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.empId)
      .order('date', { ascending: false })
      .limit(50)
    setNotifs(data || [])
    setLoading(false)
    // Mark all as read
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.empId).eq('read', false)
    onBadgeUpdate(0)
  }

  const typeIcon = {
    comment: '💬', status_update: '🔄', achievement: '🏅',
    risk1: '🚨', news: '📢', system: 'ℹ️',
  }

  return (
    <div style={{ paddingBottom: 'calc(74px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy)', borderBottom: '3px solid var(--red)', padding: '14px 16px' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '.1em' }}>
          🔔 Уведомления
        </div>
      </div>

      <div style={{ padding: 12 }}>
        {loading ? <LoadingDots /> : notifs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t3)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔕</div>
            <div>Уведомлений пока нет</div>
          </div>
        ) : notifs.map(n => (
          <div key={n.id} onClick={() => handleClick(n)} style={{
            padding: '12px 14px', borderRadius: 4,
            border: '1px solid var(--bd)',
            borderLeft: n.read ? '1px solid var(--bd)' : '3px solid var(--red)',
            background: n.read ? 'var(--bg2)' : 'rgba(245,61,45,.04)',
            marginBottom: 7, cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{typeIcon[n.type] || '🔔'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{n.title}</div>
                <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>{fmtDate(n.date)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  async function handleClick(n) {
    await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    if (n.post_id) {
      // Could navigate to post
      goToFeed()
    }
  }
}
