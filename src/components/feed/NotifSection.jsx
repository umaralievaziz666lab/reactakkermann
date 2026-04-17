import React, { useState, useEffect } from 'react'
import { supabase, fmtDate } from '../../lib/supabase.js'
import LoadingDots from '../common/LoadingDots.jsx'

const TYPE_ICONS = {
  comment: '💬', status_update: '🔄', achievement: '🏅',
  risk1: '🚨', news: '📢', deadline: '⏰',
  daily_task: '🎯', system: 'ℹ️',
}

export default function NotifSection({ user, onBadgeUpdate, showToast, goToFeed, isActive }) {
  const [notifs, setNotifs] = useState([])
  const [archived, setArchived] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('unread') // unread | all | archived
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (isActive) loadNotifs()
  }, [isActive])

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
      .limit(100)

    const all = data || []
    setNotifs(all.filter(n => !n.archived))
    setArchived(all.filter(n => n.archived))

    // Отмечаем как прочитанные
    await supabase.from('notifications')
      .update({ read: true })
      .eq('user_id', user.empId)
      .eq('read', false)
    onBadgeUpdate(0)
    setLoading(false)
  }

  async function archiveNotif(id) {
    setDeleting(id)
    await supabase.from('notifications').update({ archived: true, read: true }).eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
    const { data } = await supabase.from('notifications').select('*').eq('id', id).single()
    if (data) setArchived(prev => [data, ...prev])
    setDeleting(null)
  }

  async function archiveAll() {
    if (!notifs.length) return
    const ids = notifs.filter(n => n.read).map(n => n.id)
    if (!ids.length) { showToast('Сначала прочитайте уведомления', 'error'); return }
    await supabase.from('notifications').update({ archived: true }).in('id', ids)
    const moved = notifs.filter(n => ids.includes(n.id))
    setNotifs(prev => prev.filter(n => !ids.includes(n.id)))
    setArchived(prev => [...moved, ...prev])
    showToast(`✅ Архивировано ${ids.length} уведомлений`)
  }

  async function unarchiveNotif(id) {
    await supabase.from('notifications').update({ archived: false }).eq('id', id)
    const n = archived.find(x => x.id === id)
    if (n) {
      setArchived(prev => prev.filter(x => x.id !== id))
      setNotifs(prev => [{ ...n, archived: false }, ...prev])
    }
  }

  async function deleteNotif(id) {
    await supabase.from('notifications').delete().eq('id', id)
    setArchived(prev => prev.filter(n => n.id !== id))
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function deleteAllArchived() {
    if (!archived.length) return
    if (!confirm('Удалить все архивные уведомления?')) return
    await supabase.from('notifications').delete().eq('user_id', user.empId).eq('archived', true)
    setArchived([])
    showToast('🗑️ Архив очищен')
  }

  const unread = notifs.filter(n => !n.read)
  const displayNotifs = tab === 'unread' ? notifs : tab === 'all' ? notifs : archived

  return (
    <div style={{ paddingBottom: 'calc(74px + env(safe-area-inset-bottom,0px))', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ background: 'var(--navy)', borderBottom: '3px solid var(--red)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '.1em' }}>
            🔔 Уведомления
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {tab !== 'archived' && notifs.filter(n=>n.read).length > 0 && (
              <button onClick={archiveAll} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: '#e8e7e3', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                📦 Архивировать прочитанные
              </button>
            )}
            {tab === 'archived' && archived.length > 0 && (
              <button onClick={deleteAllArchived} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.1)', color: '#fca5a5', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                🗑️ Очистить архив
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'unread', label: `🔔 Новые${unread.length > 0 ? ` (${unread.length})` : ''}` },
            { id: 'all', label: `📋 Все (${notifs.length})` },
            { id: 'archived', label: `📦 Архив (${archived.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: tab === t.id ? '#f53d2d' : 'rgba(255,255,255,.08)',
              color: tab === t.id ? '#fff' : 'rgba(232,231,227,.6)',
              fontSize: 11, fontWeight: 700,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 12 }}>
        {loading ? <LoadingDots /> : displayNotifs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t3)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {tab === 'archived' ? '📦' : '🔕'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {tab === 'archived' ? 'Архив пуст' : 'Уведомлений нет'}
            </div>
            <div style={{ fontSize: 12, marginTop: 4, color: 'var(--t4)' }}>
              {tab === 'unread' ? 'Все уведомления прочитаны' : ''}
            </div>
          </div>
        ) : displayNotifs.map(n => (
          <NotifItem
            key={n.id}
            notif={n}
            isArchived={tab === 'archived'}
            isDeleting={deleting === n.id}
            onArchive={() => archiveNotif(n.id)}
            onUnarchive={() => unarchiveNotif(n.id)}
            onDelete={() => deleteNotif(n.id)}
            onGoToFeed={goToFeed}
          />
        ))}
      </div>
    </div>
  )
}

function NotifItem({ notif: n, isArchived, isDeleting, onArchive, onUnarchive, onDelete, onGoToFeed }) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${!n.read && !isArchived ? 'rgba(245,61,45,.25)' : 'var(--bd)'}`,
      borderLeft: `3px solid ${!n.read && !isArchived ? 'var(--red)' : isArchived ? 'var(--bd)' : 'transparent'}`,
      borderRadius: 10, marginBottom: 8,
      opacity: isDeleting ? 0.5 : isArchived ? 0.75 : 1,
      transition: 'opacity .2s',
    }}>
      <div style={{ display: 'flex', gap: 10, padding: '12px 12px 12px 14px', alignItems: 'flex-start' }}>
        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: n.type === 'risk1' ? 'rgba(239,68,68,.12)' : n.type === 'achievement' ? 'rgba(251,191,36,.12)' : 'rgba(245,61,45,.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>
          {TYPE_ICONS[n.type] || '🔔'}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{n.title}</div>
          {n.message && (
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, marginBottom: 3 }}>{n.message}</div>
          )}
          <div style={{ fontSize: 10, color: 'var(--t4)' }}>{fmtDate(n.date)}</div>
        </div>

        {/* Actions button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setShowActions(!showActions)}
            style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontSize: 18, lineHeight: 1 }}>
            ⋯
          </button>

          {showActions && (
            <>
              <div onClick={() => setShowActions(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 20,
                background: 'var(--bg2)', border: '1px solid var(--bd)',
                borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.2)',
                overflow: 'hidden', minWidth: 160,
              }}>
                {!isArchived ? (
                  <ActionBtn icon="📦" label="Архивировать" onClick={() => { setShowActions(false); onArchive() }} />
                ) : (
                  <ActionBtn icon="🔔" label="Вернуть" onClick={() => { setShowActions(false); onUnarchive() }} />
                )}
                <ActionBtn icon="🗑️" label="Удалить" onClick={() => { setShowActions(false); onDelete() }} danger />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      width: '100%', padding: '10px 14px',
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: 13, fontWeight: 600,
      color: danger ? '#ef4444' : 'var(--t1)',
      textAlign: 'left',
    }}
      onMouseOver={e => e.currentTarget.style.background = 'var(--bg3)'}
      onMouseOut={e => e.currentTarget.style.background = ''}>
      <span>{icon}</span> {label}
    </button>
  )
}
