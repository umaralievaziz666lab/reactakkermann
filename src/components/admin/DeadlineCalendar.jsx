import React, { useState, useEffect } from 'react'
import { supabase, pad, fmtDate, STATUS_MAP } from '../../lib/supabase.js'
import { notifyUser } from '../../lib/telegram.js'

export default function DeadlineCalendar({ showToast }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [view, setView] = useState('calendar') // calendar | list

  useEffect(() => { loadRequests() }, [])

  async function loadRequests() {
    setLoading(true)
    const { data } = await supabase
      .from('requests')
      .select('id,type,description,author,location,status,deadline,assigned_to,risk_urgency')
      .not('deadline', 'is', null)
      .not('status', 'in', '("completed","rejected")')
      .order('deadline', { ascending: true })
    setRequests(data || [])
    setLoading(false)
  }

  // Build calendar grid
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Mon=0
  const daysInMonth = lastDay.getDate()
  const today = new Date(); today.setHours(0,0,0,0)

  // Map deadlines to dates
  const deadlineMap = {}
  requests.forEach(r => {
    if (!r.deadline) return
    const d = new Date(r.deadline)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!deadlineMap[key]) deadlineMap[key] = []
    deadlineMap[key].push(r)
  })

  function prevMonth() { setCurrentMonth(new Date(year, month - 1, 1)); setSelectedDay(null) }
  function nextMonth() { setCurrentMonth(new Date(year, month + 1, 1)); setSelectedDay(null) }

  const selectedReqs = selectedDay
    ? (deadlineMap[`${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`] || [])
    : []

  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

  // Stats
  const overdue = requests.filter(r => new Date(r.deadline) < today)
  const thisMonth = requests.filter(r => {
    const d = new Date(r.deadline)
    return d.getFullYear() === year && d.getMonth() === month
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Всего с дедлайном', value: requests.length, color: '#3b82f6' },
          { label: 'Просрочено', value: overdue.length, color: '#ef4444' },
          { label: 'В этом месяце', value: thisMonth.length, color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: `1px solid #d1cfc9`, borderTop: `3px solid ${color}`, borderRadius: 3, padding: '10px 16px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: '#5a7080', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
          <button onClick={() => setView(view === 'calendar' ? 'list' : 'calendar')}
            style={{ padding: '8px 14px', borderRadius: 3, border: '1px solid #d1cfc9', background: '#f2f1ee', color: '#2a3f52', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {view === 'calendar' ? '📋 Список' : '📅 Календарь'}
          </button>
        </div>
      </div>

      {view === 'list' ? (
        // List view
        <div style={{ background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', background: '#0f1c2c', borderBottom: '2px solid #f53d2d' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>
              Все дедлайны по порядку
            </span>
          </div>
          {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#8fa0ae' }}>Загрузка…</div>
          : requests.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: '#8fa0ae' }}>Нет заявок с дедлайнами</div>
          : requests.map(r => <DeadlineListItem key={r.id} req={r} today={today} />)}
        </div>
      ) : (
        // Calendar view
        <div style={{ display: 'grid', gridTemplateColumns: selectedDay ? '1fr 320px' : '1fr', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', overflow: 'hidden' }}>
            {/* Month nav */}
            <div style={{ padding: '12px 16px', background: '#0f1c2c', borderBottom: '2px solid #f53d2d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 4, padding: '4px 10px', color: '#e8e7e3', cursor: 'pointer', fontSize: 16 }}>‹</button>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '.08em' }}>
                {monthNames[month]} {year}
              </span>
              <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 4, padding: '4px 10px', color: '#e8e7e3', cursor: 'pointer', fontSize: 16 }}>›</button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid #f2f1ee' }}>
              {dayNames.map(d => (
                <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#8fa0ae', textTransform: 'uppercase' }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {/* Empty cells */}
              {Array(startDow).fill(null).map((_, i) => (
                <div key={`e-${i}`} style={{ minHeight: 70, border: '1px solid #f2f1ee', borderLeft: 'none', borderTop: 'none', background: '#fafafa' }} />
              ))}

              {/* Days */}
              {Array(daysInMonth).fill(null).map((_, i) => {
                const day = i + 1
                const date = new Date(year, month, day)
                date.setHours(0,0,0,0)
                const key = `${year}-${month}-${day}`
                const dayReqs = deadlineMap[key] || []
                const isToday = date.getTime() === today.getTime()
                const isPast = date < today
                const isSelected = selectedDay?.getTime() === date.getTime()
                const hasOverdue = dayReqs.some(r => isPast)

                return (
                  <div key={day} onClick={() => dayReqs.length > 0 && setSelectedDay(isSelected ? null : date)}
                    style={{
                      minHeight: 70, padding: '6px 6px',
                      border: '1px solid #f2f1ee', borderLeft: 'none', borderTop: 'none',
                      background: isSelected ? 'rgba(245,61,45,.05)' : isToday ? 'rgba(59,130,246,.04)' : '',
                      cursor: dayReqs.length > 0 ? 'pointer' : 'default',
                      transition: '.15s',
                      outline: isSelected ? '2px solid #f53d2d' : isToday ? '2px solid #3b82f6' : 'none',
                      outlineOffset: -1,
                    }}
                    onMouseOver={e => dayReqs.length > 0 && (e.currentTarget.style.background = 'rgba(245,61,45,.04)')}
                    onMouseOut={e => !isSelected && (e.currentTarget.style.background = isToday ? 'rgba(59,130,246,.04)' : '')}
                  >
                    <div style={{
                      fontSize: 13, fontWeight: isToday ? 800 : 600,
                      color: isToday ? '#3b82f6' : isPast && dayReqs.length > 0 ? '#dc2626' : '#0f1c2c',
                      marginBottom: 4,
                      width: 22, height: 22, borderRadius: '50%',
                      background: isToday ? '#3b82f6' : '',
                      color: isToday ? '#fff' : isPast && dayReqs.length > 0 ? '#dc2626' : '#0f1c2c',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{day}</div>

                    {/* Deadline dots */}
                    {dayReqs.slice(0, 3).map((r, idx) => (
                      <div key={idx} style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, marginBottom: 2,
                        background: isPast ? '#fef2f2' : r.type === 'risk' ? '#fff7ed' : '#ecfdf5',
                        color: isPast ? '#dc2626' : r.type === 'risk' ? '#c2410c' : '#059669',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {r.type === 'risk' ? '⚠️' : '💡'} {pad(r.id)}
                      </div>
                    ))}
                    {dayReqs.length > 3 && (
                      <div style={{ fontSize: 9, color: '#8fa0ae', fontWeight: 700 }}>+{dayReqs.length - 3}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div style={{ background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', overflow: 'hidden', alignSelf: 'flex-start' }}>
              <div style={{ padding: '11px 14px', background: '#0f1c2c', borderBottom: '2px solid #f53d2d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif" }}>
                  📅 {selectedDay.toLocaleDateString('ru', { day: '2-digit', month: 'long' })}
                </span>
                <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', color: 'rgba(232,231,227,.7)', fontSize: 18, cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ padding: 12 }}>
                {selectedReqs.map(r => <DeadlineListItem key={r.id} req={r} today={today} compact />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeadlineListItem({ req, today, compact }) {
  const st = STATUS_MAP[req.status] || STATUS_MAP.new
  const dl = new Date(req.deadline)
  const isOverdue = dl < today
  const isSoon = dl >= today && dl < new Date(today.getTime() + 24*60*60*1000)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '8px 10px' : '9px 14px',
      borderBottom: '1px solid #f2f1ee',
      background: isOverdue ? '#fef2f2' : isSoon ? '#fffbeb' : '',
    }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#f53d2d', fontWeight: 700 }}>{pad(req.id)}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#0f1c2c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
          {req.type === 'risk' ? '⚠️' : '💡'} {(req.description || '').slice(0, 50)}
        </div>
        {!compact && (
          <div style={{ fontSize: 10, color: '#5a7080', marginTop: 2 }}>
            {req.author || '—'} · {req.location || '—'}
            {req.assigned_to && ` · 👷 ${req.assigned_to}`}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: isOverdue ? '#dc2626' : isSoon ? '#d97706' : '#5a7080' }}>
          {isOverdue ? '🚨' : isSoon ? '⚠️' : '⏰'} {fmtDate(req.deadline)}
        </div>
        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${st.color}18`, color: st.color, fontWeight: 700 }}>{st.label}</span>
      </div>
    </div>
  )
}
