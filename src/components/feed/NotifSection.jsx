import React, { useState, useEffect, useRef } from 'react'
import { supabase, fmtDate } from '../../lib/supabase.js'
import LoadingDots from '../common/LoadingDots.jsx'

const TYPE_ICONS = {
  comment:'💬', status_update:'🔄', achievement:'🏅',
  risk1:'🚨', news:'📢', deadline:'⏰', daily_task:'🎯', system:'ℹ️',
}

export default function NotifSection({ user, onBadgeUpdate, showToast, goToFeed, isActive }) {
  const [notifs, setNotifs] = useState([])
  const [archived, setArchived] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('unread')

  useEffect(() => { loadNotifs() }, [])
  useEffect(() => { if (isActive) loadNotifs() }, [isActive])

  async function loadNotifs() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.empId).order('date',{ascending:false}).limit(100)
    const all = data || []
    setNotifs(all.filter(n => !n.archived))
    setArchived(all.filter(n => n.archived))
    await supabase.from('notifications').update({read:true}).eq('user_id',user.empId).eq('read',false)
    onBadgeUpdate(0)
    setLoading(false)
  }

  async function archiveNotif(id) {
    await supabase.from('notifications').update({archived:true,read:true}).eq('id',id)
    const n = notifs.find(x=>x.id===id)
    setNotifs(prev=>prev.filter(x=>x.id!==id))
    if (n) setArchived(prev=>[{...n,archived:true},...prev])
  }

  async function archiveAll() {
    const ids = notifs.filter(n=>n.read).map(n=>n.id)
    if (!ids.length) { showToast('Нет прочитанных','error'); return }
    await supabase.from('notifications').update({archived:true}).in('id',ids)
    const moved = notifs.filter(n=>ids.includes(n.id))
    setNotifs(prev=>prev.filter(n=>!ids.includes(n.id)))
    setArchived(prev=>[...moved,...prev])
    showToast(`✅ Архивировано ${ids.length}`)
  }

  async function unarchiveNotif(id) {
    await supabase.from('notifications').update({archived:false}).eq('id',id)
    const n = archived.find(x=>x.id===id)
    if (n) { setArchived(prev=>prev.filter(x=>x.id!==id)); setNotifs(prev=>[{...n,archived:false},...prev]) }
  }

  async function deleteNotif(id) {
    await supabase.from('notifications').delete().eq('id',id)
    setArchived(prev=>prev.filter(n=>n.id!==id))
    setNotifs(prev=>prev.filter(n=>n.id!==id))
  }

  async function deleteAllArchived() {
    if (!confirm('Удалить все из архива?')) return
    await supabase.from('notifications').delete().eq('user_id',user.empId).eq('archived',true)
    setArchived([]); showToast('🗑️ Архив очищен')
  }

  const unread = notifs.filter(n=>!n.read)
  const displayNotifs = tab==='archived' ? archived : notifs

  return (
    <div style={{ paddingBottom:'calc(74px + env(safe-area-inset-bottom,0px))', minHeight:'100%' }}>

      {/* Header — по центру */}
      <div style={{
        background: 'var(--navy)',
        borderBottom: '3px solid var(--red)',
        paddingTop: 'max(env(safe-area-inset-top,0px), 16px)',
      }}>
        <div style={{ textAlign:'center', padding:'12px 16px 0', fontSize:17, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', fontFamily:"'Barlow Condensed',sans-serif", color:'#e8e7e3' }}>
          🔔 УВЕДОМЛЕНИЯ
        </div>

        {/* Actions row */}
        <div style={{ display:'flex', justifyContent:'flex-end', padding:'6px 12px 0' }}>
          {tab !== 'archived' && notifs.filter(n=>n.read).length > 0 && (
            <button onClick={archiveAll} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.08)', color:'#e8e7e3', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              📦 В архив
            </button>
          )}
          {tab === 'archived' && archived.length > 0 && (
            <button onClick={deleteAllArchived} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,.3)', background:'rgba(239,68,68,.1)', color:'#fca5a5', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              🗑️ Очистить
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, padding:'8px 12px' }}>
          {[
            {id:'unread', label:`🔔 Новые${unread.length>0?` (${unread.length})`:''}` },
            {id:'all',    label:`📋 Все (${notifs.length})`},
            {id:'archived',label:`📦 Архив (${archived.length})`},
          ].map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer',
              background: tab===t.id ? '#f53d2d' : 'rgba(255,255,255,.08)',
              color: tab===t.id ? '#fff' : 'rgba(232,231,227,.6)',
              fontSize:11, fontWeight:700,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:12 }}>
        {loading ? <LoadingDots /> : displayNotifs.length===0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--t3)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>{tab==='archived'?'📦':'🔕'}</div>
            <div style={{ fontSize:14, fontWeight:600 }}>{tab==='archived'?'Архив пуст':'Уведомлений нет'}</div>
          </div>
        ) : displayNotifs.map(n => (
          <SwipeableNotif
            key={n.id} notif={n}
            isArchived={tab==='archived'}
            onArchive={() => archiveNotif(n.id)}
            onUnarchive={() => unarchiveNotif(n.id)}
            onDelete={() => deleteNotif(n.id)}
          />
        ))}
      </div>
    </div>
  )
}

function SwipeableNotif({ notif:n, isArchived, onArchive, onUnarchive, onDelete }) {
  const [swipeX, setSwipeX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const startXRef = useRef(0), startYRef = useRef(0), isHorizRef = useRef(null)
  const THRESHOLD = 80

  function handleTouchStart(e) {
    startXRef.current = e.touches[0].clientX
    startYRef.current = e.touches[0].clientY
    isHorizRef.current = null; setSwiping(true)
  }
  function handleTouchMove(e) {
    if (!swiping) return
    const dx = e.touches[0].clientX - startXRef.current
    const dy = Math.abs(e.touches[0].clientY - startYRef.current)
    if (isHorizRef.current === null) isHorizRef.current = Math.abs(dx) > dy
    if (!isHorizRef.current) return
    e.preventDefault(); setSwipeX(dx)
  }
  function handleTouchEnd() {
    setSwiping(false)
    if (Math.abs(swipeX) > THRESHOLD) {
      setDismissed(true)
      setTimeout(() => { swipeX > 0 ? (isArchived ? onUnarchive() : onArchive()) : onDelete() }, 250)
    } else setSwipeX(0)
  }

  const actionBg = swipeX > 0 ? (isArchived?'#3b82f6':'#22c55e') : '#ef4444'
  const actionIcon = swipeX > 0 ? (isArchived?'🔔':'📦') : '🗑️'
  const progress = Math.min(Math.abs(swipeX)/THRESHOLD, 1)

  return (
    <div style={{ position:'relative', marginBottom:8, borderRadius:10, overflow:'hidden', height:dismissed?0:'auto', opacity:dismissed?0:1, transition:dismissed?'all .25s ease':'none' }}>
      <div style={{ position:'absolute', inset:0, borderRadius:10, background:actionBg, display:'flex', alignItems:'center', justifyContent:swipeX>0?'flex-start':'flex-end', padding:'0 20px', opacity:Math.min(progress*1.5,1) }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <span style={{ fontSize:20, transform:`scale(${0.7+progress*0.5})` }}>{actionIcon}</span>
          <span style={{ fontSize:9, fontWeight:800, color:'#fff' }}>{swipeX>0?(isArchived?'Вернуть':'Архив'):'Удалить'}</span>
        </div>
      </div>
      <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        style={{
          position:'relative', zIndex:1,
          background:'var(--bg2)',
          border:`1px solid ${!n.read&&!isArchived?'rgba(245,61,45,.25)':'var(--bd)'}`,
          borderLeft:`3px solid ${!n.read&&!isArchived?'var(--red)':isArchived?'var(--bd)':'transparent'}`,
          borderRadius:10, padding:'12px 14px',
          transform:`translateX(${swipeX}px)`,
          transition:swiping?'none':'transform .3s cubic-bezier(.32,.72,0,1)',
          opacity:isArchived?.75:1, userSelect:'none', touchAction:'pan-y',
        }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:n.type==='risk1'?'rgba(239,68,68,.12)':'rgba(245,61,45,.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
            {TYPE_ICONS[n.type]||'🔔'}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', marginBottom:2 }}>{n.title}</div>
            {n.message && <div style={{ fontSize:12, color:'var(--t2)', lineHeight:1.5, marginBottom:3 }}>{n.message}</div>}
            <div style={{ fontSize:10, color:'var(--t4)' }}>{fmtDate(n.date)}</div>
          </div>
          {!n.read && !isArchived && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', opacity:.2, fontSize:14, color:'var(--t3)' }}>‹›</span>}
        </div>
      </div>
    </div>
  )
}
