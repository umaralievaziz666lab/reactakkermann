import React, { useState, useEffect } from 'react'
import { supabase, pad, fmtDate, STATUS_MAP } from '../../lib/supabase.js'
import { notifyUser } from '../../lib/telegram.js'

export default function DeadlineAlerts({ adminUser, showToast }) {
  const [overdue, setOverdue] = useState([])
  const [dueSoon, setDueSoon] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const now = new Date()
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000) // +24h

    const { data } = await supabase
      .from('requests')
      .select('id,type,description,author,author_id,location,status,deadline,assigned_to,risk_urgency')
      .not('deadline', 'is', null)
      .not('status', 'in', '("completed","rejected")')
      .order('deadline', { ascending: true })
      .limit(50)

    if (data) {
      setOverdue(data.filter(r => new Date(r.deadline) < now))
      setDueSoon(data.filter(r => new Date(r.deadline) >= now && new Date(r.deadline) <= soon))
    }
    setLoading(false)
  }

  async function sendReminders() {
    setSending(true)
    let count = 0

    // Notify overdue
    for (const req of overdue) {
      if (req.author_id) {
        await notifyUser(
          supabase, req.author_id,
          '🚨 Дедлайн просрочен!',
          `${pad(req.id)}: ${(req.description||'').slice(0,80)}\nСрок был: ${fmtDate(req.deadline)}`,
          'deadline'
        )
        count++
      }
      if (req.assigned_to) {
        const { data: assignee } = await supabase.from('users').select('id').eq('name', req.assigned_to).single()
        if (assignee) {
          await notifyUser(
            supabase, assignee.id,
            '🚨 Просроченная задача!',
            `${pad(req.id)}: ${(req.description||'').slice(0,80)}`,
            'deadline'
          )
          count++
        }
      }
    }

    // Notify due soon
    for (const req of dueSoon) {
      if (req.author_id) {
        await notifyUser(
          supabase, req.author_id,
          '⏰ Срок истекает через 24 часа',
          `${pad(req.id)}: ${(req.description||'').slice(0,80)}\nДедлайн: ${fmtDate(req.deadline)}`,
          'deadline'
        )
        count++
      }
    }

    showToast(`✅ Отправлено ${count} напоминаний в Telegram`)
    setSending(false)
  }

  const total = overdue.length + dueSoon.length

  return (
    <div style={{ background:'#fff', borderRadius:3, border:'1px solid #d1cfc9', overflow:'hidden', marginBottom:20 }}>
      <div style={{ padding:'11px 16px', background:'#0f1c2c', borderBottom:'2px solid #f53d2d', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:13, fontWeight:800, color:'#e8e7e3', fontFamily:"'Barlow Condensed',sans-serif", textTransform:'uppercase' }}>
          ⏰ Дедлайны
        </span>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {total > 0 && (
            <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, background:'#ef4444', color:'#fff' }}>{total}</span>
          )}
          <button onClick={load} style={{ padding:'4px 10px', borderRadius:3, border:'1px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.1)', color:'#e8e7e3', fontSize:11, fontWeight:700, cursor:'pointer' }}>
            🔄
          </button>
          {total > 0 && (
            <button onClick={sendReminders} disabled={sending}
              style={{ padding:'4px 10px', borderRadius:3, border:'none', background:'#f53d2d', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', opacity:sending?.6:1 }}>
              {sending ? '⏳' : '📱 Уведомить всех'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding:'20px', textAlign:'center', color:'#8fa0ae', fontSize:13 }}>Загрузка…</div>
      ) : total === 0 ? (
        <div style={{ padding:'20px', textAlign:'center' }}>
          <span style={{ fontSize:32 }}>✅</span>
          <div style={{ fontSize:13, color:'#5a7080', marginTop:8 }}>Просроченных дедлайнов нет</div>
        </div>
      ) : (
        <div style={{ maxHeight:320, overflowY:'auto' }}>
          {overdue.length > 0 && (
            <div>
              <div style={{ padding:'6px 14px', background:'#fef2f2', fontSize:10, fontWeight:700, color:'#dc2626', textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #fecaca' }}>
                🚨 Просрочено ({overdue.length})
              </div>
              {overdue.map(r => <DeadlineRow key={r.id} req={r} overdue={true} />)}
            </div>
          )}
          {dueSoon.length > 0 && (
            <div>
              <div style={{ padding:'6px 14px', background:'#fffbeb', fontSize:10, fontWeight:700, color:'#d97706', textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #fcd34d' }}>
                ⚠️ Истекает через 24ч ({dueSoon.length})
              </div>
              {dueSoon.map(r => <DeadlineRow key={r.id} req={r} overdue={false} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeadlineRow({ req, overdue }) {
  const st = STATUS_MAP[req.status]||STATUS_MAP.new
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'1px solid #f2f1ee' }}>
      <div style={{ flexShrink:0 }}>
        <span style={{ fontFamily:'monospace', fontSize:12, color:'#f53d2d', fontWeight:700 }}>{pad(req.id)}</span>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, color:'#0f1c2c', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {(req.description||'').slice(0,60)}
        </div>
        <div style={{ fontSize:10, color:'#5a7080', marginTop:1 }}>
          {req.author||'—'} · {req.location||'—'}
          {req.assigned_to && ` · 👷 ${req.assigned_to}`}
        </div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:11, fontWeight:700, color: overdue ? '#dc2626' : '#d97706' }}>
          {fmtDate(req.deadline)}
        </div>
        <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:`${st.color}18`, color:st.color, fontWeight:700 }}>{st.label}</span>
      </div>
    </div>
  )
}
