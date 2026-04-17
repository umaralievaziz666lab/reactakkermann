import React, { useState, useEffect, useRef } from 'react'
import { supabase, pad, fmtDate } from '../../lib/supabase.js'

export default function AdminBell({ adminUser, onOpenRequest }) {
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    loadNotifs()
    // Realtime — новые уведомления
    const ch = supabase.channel('admin-bell')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${adminUser.id}`
      }, () => loadNotifs())
      // Новые заявки — всем admin/manager
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'requests'
      }, (payload) => {
        const r = payload.new
        // Добавляем виртуальное уведомление о новой заявке
        const virtualNotif = {
          id: `req_${r.id}`,
          title: `📋 Новая заявка ${pad(r.id)}`,
          message: `${r.type === 'risk' ? '⚠️ Риск' : '💡 Идея'} — ${r.location || '—'}: ${(r.description || '').slice(0, 60)}`,
          type: r.risk_urgency === 1 ? 'risk1' : 'new_request',
          post_id: r.id,
          read: false,
          date: r.date || r.created_at || new Date().toISOString(),
          isVirtual: true,
        }
        setNotifs(prev => [virtualNotif, ...prev].slice(0, 50))
        setUnread(prev => prev + 1)
      })
      .subscribe()

    // Click outside to close
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => { supabase.removeChannel(ch); document.removeEventListener('mousedown', handler) }
  }, [adminUser.id])

  async function loadNotifs() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', adminUser.id)
      .order('date', { ascending: false })
      .limit(30)
    setNotifs(prev => {
      // Merge virtual notifs with real ones
      const virtual = prev.filter(n => n.isVirtual)
      const real = data || []
      const merged = [...virtual, ...real].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50)
      return merged
    })
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', adminUser.id)
      .eq('read', false)
    setUnread(count || 0)
    setLoading(false)
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', adminUser.id).eq('read', false)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  async function handleNotifClick(notif) {
    // Mark as read
    if (!notif.isVirtual && !notif.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id)
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
      setUnread(prev => Math.max(0, prev - 1))
    }
    // Open request if has post_id
    if (notif.post_id) {
      setOpen(false)
      onOpenRequest(notif.post_id)
    }
  }

  const TYPE_ICONS = { risk1: '🚨', new_request: '📋', comment: '💬', status_update: '🔄', news: '📢', deadline: '⏰', system: 'ℹ️' }

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button onClick={() => { setOpen(!open); if (!open) markAllRead() }} style={{
        position: 'relative', background: open ? 'rgba(245,61,45,.2)' : 'rgba(255,255,255,.1)',
        border: `1px solid ${open ? 'rgba(245,61,45,.4)' : 'rgba(255,255,255,.2)'}`,
        borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#e8e7e3',
        display: 'flex', alignItems: 'center', gap: 6, transition: '.15s',
      }}>
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18, borderRadius: 99,
            background: '#f53d2d', color: '#fff',
            fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid #0f1c2c',
            animation: 'pulse 1.5s ease infinite',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 360, maxHeight: 480,
          background: '#fff', borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,.2)',
          border: '1px solid #d1cfc9', borderTop: '3px solid #f53d2d',
          overflow: 'hidden', zIndex: 100,
        }}>
          {/* Header */}
          <div style={{ padding: '10px 14px', background: '#0f1c2c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>
              🔔 Уведомления {unread > 0 && <span style={{ fontSize: 10, background: '#f53d2d', color: '#fff', padding: '1px 6px', borderRadius: 3, marginLeft: 4 }}>{unread}</span>}
            </span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'rgba(232,231,227,.6)', fontSize: 11, cursor: 'pointer' }}>
                Прочитать все
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', maxHeight: 400 }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#8fa0ae', fontSize: 13 }}>Загрузка…</div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                <div style={{ fontSize: 13, color: '#8fa0ae' }}>Уведомлений нет</div>
              </div>
            ) : notifs.map((n, i) => (
              <div key={n.id || i} onClick={() => handleNotifClick(n)}
                style={{
                  padding: '10px 14px',
                  cursor: n.post_id ? 'pointer' : 'default',
                  borderBottom: '1px solid #f2f1ee',
                  background: !n.read ? 'rgba(245,61,45,.03)' : '',
                  borderLeft: !n.read ? '3px solid #f53d2d' : '3px solid transparent',
                  transition: '.1s',
                }}
                onMouseOver={e => n.post_id && (e.currentTarget.style.background = '#f5f4f0')}
                onMouseOut={e => e.currentTarget.style.background = !n.read ? 'rgba(245,61,45,.03)' : ''}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: n.type === 'risk1' ? 'rgba(239,68,68,.12)' : 'rgba(245,61,45,.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  }}>
                    {TYPE_ICONS[n.type] || '🔔'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: !n.read ? 700 : 600, color: '#0f1c2c', marginBottom: 2 }}>{n.title}</div>
                    {n.message && (
                      <div style={{ fontSize: 11, color: '#5a7080', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {n.message}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#8fa0ae', marginTop: 3 }}>{fmtDate(n.date)}</div>
                  </div>
                  {n.post_id && (
                    <span style={{ fontSize: 10, color: '#f53d2d', flexShrink: 0, marginTop: 2 }}>→</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
