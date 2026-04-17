import React, { useState, useEffect } from 'react'
import { supabase, fmtDate, STATUS_MAP } from '../../lib/supabase.js'
import LoadingDots from '../common/LoadingDots.jsx'
import DeadlineAlerts from './DeadlineAlerts.jsx'

export default function AdminDashboard({ showToast, onPageChange, adminUser }) {
  const [stats, setStats] = useState({ total: 0, new: 0, ideas: 0, risks: 0, users: 0, completed: 0, inWork: 0 })
  const [recent, setRecent] = useState([])
  const [byDept, setByDept] = useState([])
  const [byDay, setByDay] = useState([])
  const [byStatus, setByStatus] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [r1, r2, r3, r4, r5, r6, r7, r8] = await Promise.all([
      supabase.from('requests').select('*', { count: 'exact', head: true }),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('requests').select('id,type,status,description,author,location,date,created_at,risk_urgency').order('id', { ascending: false }).limit(8),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('type', 'idea'),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('type', 'risk'),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'work'),
    ])
    setStats({ total: r1.count||0, new: r2.count||0, users: r3.count||0, ideas: r5.count||0, risks: r6.count||0, completed: r7.count||0, inWork: r8.count||0 })
    setRecent(r4.data || [])

    const { data: allReqs } = await supabase.from('requests').select('location,type,status,date,created_at')
    if (allReqs) {
      const deptMap = {}
      allReqs.forEach(r => {
        const loc = r.location || 'Не указан'
        if (!deptMap[loc]) deptMap[loc] = { name: loc, ideas: 0, risks: 0, total: 0 }
        deptMap[loc].total++
        if (r.type === 'idea') deptMap[loc].ideas++
        if (r.type === 'risk') deptMap[loc].risks++
      })
      setByDept(Object.values(deptMap).sort((a, b) => b.total - a.total).slice(0, 8))

      const days = {}
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const key = d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
        days[key] = { date: key, ideas: 0, risks: 0, total: 0 }
      }
      allReqs.forEach(r => {
        const key = new Date(r.date || r.created_at).toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
        if (days[key]) { days[key].total++; if (r.type==='idea') days[key].ideas++; if (r.type==='risk') days[key].risks++ }
      })
      setByDay(Object.values(days))

      const statusMap = {}
      allReqs.forEach(r => { const s = r.status||'new'; statusMap[s] = (statusMap[s]||0)+1 })
      setByStatus(Object.entries(statusMap).map(([k,v]) => ({ status:k, label: STATUS_MAP[k]?.label||k, color: STATUS_MAP[k]?.color||'#6b7280', count:v })))
    }
    setLoading(false)
  }

  if (loading) return <LoadingDots />

  const maxDay = Math.max(...byDay.map(d => d.total), 1)
  const maxDept = Math.max(...byDept.map(d => d.total), 1)
  const totalStatus = byStatus.reduce((s, x) => s + x.count, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {[
          { label: 'Всего заявок', value: stats.total, icon: '📋', color: '#3b82f6', click: () => onPageChange('requests') },
          { label: 'Новые',        value: stats.new,   icon: '🔔', color: '#f59e0b', click: () => onPageChange('requests') },
          { label: 'В работе',     value: stats.inWork, icon: '⚙️', color: '#8b5cf6' },
          { label: 'Выполнено',    value: stats.completed, icon: '✅', color: '#22c55e' },
          { label: 'Идей',         value: stats.ideas, icon: '💡', color: '#06b6d4' },
          { label: 'Рисков',       value: stats.risks, icon: '⚠️', color: '#ef4444' },
          { label: 'Сотрудников',  value: stats.users, icon: '👥', color: '#f53d2d', click: () => onPageChange('users') },
        ].map(({ label, value, icon, color, click }) => (
          <div key={label} onClick={click} style={{ background: '#fff', borderRadius: 3, padding: '14px 16px', border: '1px solid #d1cfc9', borderTop: `3px solid ${color}`, display: 'flex', alignItems: 'center', gap: 12, cursor: click ? 'pointer' : 'default' }}
            onMouseOver={e => click && (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)')}
            onMouseOut={e => click && (e.currentTarget.style.boxShadow = '')}>
            <div style={{ width: 40, height: 40, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f1c2c', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#5a7080', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Bar chart by day */}
        <div style={{ background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', borderTop: '3px solid #f53d2d', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1c2c', marginBottom: 14, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '.04em' }}>📈 Заявки за 14 дней</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, paddingBottom: 4 }}>
            {byDay.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                {d.total > 0 && <div style={{ fontSize: 8, color: '#8fa0ae', fontWeight: 700, marginBottom: 2 }}>{d.total}</div>}
                <div style={{ width: '100%' }}>
                  <div style={{ width: '100%', height: Math.round((d.risks / maxDay) * 85) + 'px', background: '#ef4444', borderRadius: '2px 2px 0 0', minHeight: d.risks > 0 ? 3 : 0 }} />
                  <div style={{ width: '100%', height: Math.round((d.ideas / maxDay) * 85) + 'px', background: '#22c55e', minHeight: d.ideas > 0 ? 3 : 0 }} />
                </div>
                {i % 2 === 0 && <div style={{ fontSize: 7, color: '#8fa0ae', marginTop: 3, transform: 'rotate(-40deg)', whiteSpace: 'nowrap' }}>{d.date}</div>}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#5a7080' }}><div style={{ width: 10, height: 10, background: '#22c55e', borderRadius: 2 }} /> Идеи</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#5a7080' }}><div style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }} /> Риски</div>
          </div>
        </div>

        {/* Donut by status */}
        <div style={{ background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', borderTop: '3px solid #f53d2d', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1c2c', marginBottom: 14, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '.04em' }}>🍩 По статусам</div>
          <DonutChart data={byStatus} total={totalStatus} />
        </div>
      </div>

      {/* By department */}
      <div style={{ background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', borderTop: '3px solid #f53d2d', padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1c2c', marginBottom: 14, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '.04em' }}>🏭 По участкам</div>
        {byDept.length === 0 ? <div style={{ color: '#8fa0ae', fontSize: 13 }}>Нет данных</div> : byDept.map((d, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#2a3f52' }}>{d.name}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>💡 {d.ideas}</span>
                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>⚠️ {d.risks}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#0f1c2c' }}>= {d.total}</span>
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: '#f2f1ee', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${(d.ideas / maxDept) * 100}%`, background: '#22c55e', transition: 'width .5s' }} />
              <div style={{ width: `${(d.risks / maxDept) * 100}%`, background: '#ef4444', transition: 'width .5s' }} />
            </div>
          </div>
        ))}
      </div>

      <DeadlineAlerts adminUser={adminUser} showToast={showToast} />
      <Level1Alert />

      {/* Recent table */}
      <div style={{ background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', overflow: 'hidden' }}>
        <div style={{ padding: '11px 16px', borderBottom: '2px solid #d1cfc9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f1c2c' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '.05em' }}>Последние заявки</span>
          <button onClick={() => onPageChange('requests')} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 3, padding: '4px 10px', color: '#e8e7e3', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Все →</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['ID','Тип','Автор','Участок','Дата','Статус'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {recent.map(r => {
                const st = STATUS_MAP[r.status] || STATUS_MAP.new
                return (
                  <tr key={r.id} onMouseOver={e => e.currentTarget.style.background='#f5f4f0'} onMouseOut={e => e.currentTarget.style.background=''} style={{ cursor: 'pointer' }}>
                    <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#f53d2d' }}>#{String(r.id).padStart(5,'0')}</span></td>
                    <td style={tdStyle}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: r.type==='risk'?'#fff7ed':'#ecfdf5', color: r.type==='risk'?'#c2410c':'#059669' }}>{r.type==='risk'?`⚠️ Риск${r.risk_urgency?` L${r.risk_urgency}`:''}` : '💡 Идея'}</span></td>
                    <td style={tdStyle}>{r.author||'—'}</td>
                    <td style={tdStyle}>{r.location||'—'}</td>
                    <td style={tdStyle}>{fmtDate(r.date||r.created_at)}</td>
                    <td style={tdStyle}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${st.color}18`, color: st.color }}>{st.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DonutChart({ data, total }) {
  if (!data.length || total === 0) return <div style={{ textAlign: 'center', padding: 20, color: '#8fa0ae', fontSize: 13 }}>Нет данных</div>
  let cumulative = 0
  const cx = 75, cy = 75, r = 55
  const segments = data.map(d => { const pct = d.count/total; const start = cumulative; cumulative += pct; return { ...d, pct, start } })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg width="150" height="150" viewBox="0 0 150 150" style={{ flexShrink: 0 }}>
        {segments.map((s, i) => {
          if (s.pct === 0) return null
          const startAngle = s.start * 2 * Math.PI - Math.PI/2
          const endAngle = (s.start + s.pct) * 2 * Math.PI - Math.PI/2
          const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle)
          const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle)
          const large = s.pct > 0.5 ? 1 : 0
          return <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`} fill={s.color} opacity={0.85} />
        })}
        <circle cx={cx} cy={cy} r={35} fill="white" />
        <text x={cx} y={cy-4} textAnchor="middle" fontSize="16" fontWeight="800" fill="#0f1c2c">{total}</text>
        <text x={cx} y={cy+12} textAnchor="middle" fontSize="9" fill="#5a7080">всего</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 100 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#2a3f52', flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0f1c2c' }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Level1Alert() {
  const [lvl1, setLvl1] = useState([])
  useEffect(() => {
    supabase.from('requests').select('id,location,date,created_at').eq('type','risk').eq('risk_urgency',1).in('status',['new','work']).order('id',{ascending:false}).limit(5)
      .then(({ data }) => setLvl1(data||[]))
  }, [])
  if (!lvl1.length) return null
  return (
    <div style={{ background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 3, padding: 16, borderLeft: '4px solid #dc2626' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626', marginBottom: 10 }}>🚨 ОТКРЫТЫЕ РИСКИ УРОВЕНЬ 1</div>
      {lvl1.map(r => (
        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #fecaca' }}>
          <span style={{ fontSize: 12, color: '#7f1d1d', fontWeight: 600 }}>#{String(r.id).padStart(5,'0')} — {r.location||'—'}</span>
          <span style={{ fontSize: 11, color: '#991b1b' }}>{fmtDate(r.date||r.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

const thStyle = { padding: '8px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#e8e7e3', textTransform: 'uppercase', letterSpacing: '.06em', background: '#0f1c2c', borderBottom: '2px solid #f53d2d', whiteSpace: 'nowrap', fontFamily: "'Barlow Condensed', sans-serif" }
const tdStyle = { padding: '9px 13px', fontSize: 13, color: '#2a3f52', borderBottom: '1px solid #f2f1ee', verticalAlign: 'middle' }
