import React, { useState, useEffect } from 'react'
import { supabase, pad, fmtDate, STATUS_MAP } from '../../lib/supabase.js'
import { can } from '../../lib/permissions.js'
import LoadingDots from '../common/LoadingDots.jsx'

export default function AdminRequests({ adminUser, showToast, onBadgeUpdate }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState(null)
  const [users, setUsers] = useState([])
  const [updating, setUpdating] = useState(false)
  const [editFields, setEditFields] = useState({})
  const [exporting, setExporting] = useState(false)

  const role = adminUser?.role || 'staff'

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: reqs }, { data: usrs }] = await Promise.all([
      supabase.from('requests').select('*').order('id', { ascending: false }).limit(500),
      supabase.from('users').select('id,name,department,role').order('name'),
    ])
    setRequests(reqs || [])
    setUsers(usrs || [])
    setLoading(false)
  }

  async function updateRequest(id, updates, logAction) {
    if (!can(role, 'change_status')) { showToast('Нет прав для изменения статуса', 'error'); return }
    setUpdating(true)
    const req = requests.find(r => r.id === id)
    const log = parseJson(req?.change_log, [])
    if (logAction) log.push({ action: logAction, by: adminUser.name, date: new Date().toISOString() })
    const { error } = await supabase.from('requests').update({ ...updates, change_log: log }).eq('id', id)
    if (error) { showToast('Ошибка: ' + error.message, 'error'); setUpdating(false); return }
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates, change_log: log } : r))
    if (selected?.id === id) setSelected(prev => ({ ...prev, ...updates, change_log: log }))
    if (updates.status && req?.author_id) {
      await supabase.from('notifications').insert({
        user_id: req.author_id,
        title: '🔄 Статус заявки изменён',
        message: `${pad(id)}: ${STATUS_MAP[updates.status]?.label || updates.status}${updates.admin_comment ? ` — ${updates.admin_comment}` : ''}`,
        post_id: id, type: 'status_update', read: false, date: new Date().toISOString()
      })
    }
    onBadgeUpdate()
    showToast('✅ Обновлено')
    setUpdating(false)
  }

  async function deleteRequest(id) {
    if (!can(role, 'delete_request')) { showToast('Только администратор может удалять заявки', 'error'); return }
    if (!confirm(`Удалить заявку ${pad(id)}? Это действие нельзя отменить.`)) return
    const { error } = await supabase.from('requests').delete().eq('id', id)
    if (error) { showToast('Ошибка: ' + error.message, 'error'); return }
    setRequests(prev => prev.filter(r => r.id !== id))
    setSelected(null)
    showToast('🗑️ Заявка удалена')
    onBadgeUpdate()
  }

  async function exportExcel() {
    if (!can(role, 'export_data')) { showToast('Нет прав для экспорта', 'error'); return }
    setExporting(true)
    try {
      const rows = [
        ['ID','Тип','Описание','Автор','Участок','Статус','Уровень риска','Назначено','Дедлайн','Дата'],
        ...filtered.map(r => [
          pad(r.id),
          r.type === 'risk' ? 'Риск' : 'Идея',
          r.description || '',
          r.anonymous ? (can(role, 'view_anonymous') ? `Аноним (${r.author_id || '?'})` : 'Аноним') : (r.author || ''),
          r.location || '',
          STATUS_MAP[r.status]?.label || r.status || '',
          r.risk_urgency ? `Уровень ${r.risk_urgency}` : '',
          r.assigned_to || '',
          r.deadline ? fmtDate(r.deadline) : '',
          fmtDate(r.date || r.created_at),
        ])
      ]
      const csv = rows.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `akkermann-${new Date().toLocaleDateString('ru').replace(/\./g,'-')}.csv`
      a.click(); URL.revokeObjectURL(url)
      showToast(`✅ Экспортировано ${filtered.length} заявок`)
    } catch(e) { showToast('Ошибка: ' + e.message, 'error') }
    setExporting(false)
  }

  async function exportPDF() {
    if (!can(role, 'export_data')) { showToast('Нет прав для экспорта', 'error'); return }
    setExporting(true)
    const date = new Date().toLocaleDateString('ru', { day:'2-digit', month:'long', year:'numeric' })
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px}h1{color:#f53d2d;font-size:16px}
      .sub{color:#666;font-size:10px;margin-bottom:16px}table{width:100%;border-collapse:collapse}
      th{background:#0f1c2c;color:white;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}
      td{padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top}
      tr:nth-child(even) td{background:#f9f9f9}.risk{color:#dc2626;font-weight:bold}.idea{color:#059669;font-weight:bold}
      </style></head><body>
      <h1>AKKERMANN PULSE — Отчёт</h1>
      <div class="sub">Дата: ${date} | Заявок: ${filtered.length} | Экспортировал: ${adminUser.name}</div>
      <table><thead><tr><th>ID</th><th>Тип</th><th>Описание</th><th>Автор</th><th>Участок</th><th>Статус</th><th>Дата</th></tr></thead>
      <tbody>${filtered.slice(0,100).map(r => `<tr>
        <td style="font-family:monospace;color:#f53d2d">${pad(r.id)}</td>
        <td class="${r.type}">${r.type==='risk'?`⚠️ Риск${r.risk_urgency?` L${r.risk_urgency}`:''}` :'💡 Идея'}</td>
        <td style="max-width:180px">${(r.description||'').slice(0,80)}${(r.description||'').length>80?'…':''}</td>
        <td>${r.anonymous?(can(role,'view_anonymous')?`Аноним`:'Аноним'):(r.author||'—')}</td>
        <td>${r.location||'—'}</td>
        <td>${STATUS_MAP[r.status]?.label||'—'}</td>
        <td style="white-space:nowrap">${fmtDate(r.date||r.created_at)}</td>
      </tr>`).join('')}</tbody></table></body></html>`
    const win = window.open('','_blank'); win.document.write(html); win.document.close()
    setTimeout(() => win.print(), 500)
    showToast('PDF готов — сохрани через диалог печати')
    setExporting(false)
  }

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (typeFilter !== 'all' && r.type !== typeFilter) return false
    if (dateFrom && new Date(r.date||r.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(r.date||r.created_at) > new Date(dateTo+'T23:59:59')) return false
    if (search) {
      const q = search.toLowerCase()
      if (!String(r.id).includes(q) && !(r.description||'').toLowerCase().includes(q) &&
          !(r.author||'').toLowerCase().includes(q) && !(r.location||'').toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 100px)' }}>
      <div style={{ flex: selected ? '0 0 460px' : 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#5a7080' }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск…"
              style={{ width: '100%', padding: '8px 11px 8px 32px', border: '1px solid #d1cfc9', borderRadius: 9, background: '#f2f1ee', color: '#0f1c2c', fontSize: 13, outline: 'none' }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selStyle}>
            <option value="all">Все статусы</option>
            {Object.entries(STATUS_MAP).map(([v,s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selStyle}>
            <option value="all">Все типы</option>
            <option value="idea">💡 Идеи</option>
            <option value="risk">⚠️ Риски</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={selStyle} title="От" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={selStyle} title="До" />
          {(dateFrom||dateTo||search||statusFilter!=='all'||typeFilter!=='all') && (
            <button onClick={() => { setSearch('');setStatusFilter('all');setTypeFilter('all');setDateFrom('');setDateTo('') }}
              style={{ padding:'7px 10px', borderRadius:9, border:'1px solid #fecaca', background:'#fef2f2', color:'#ef4444', fontSize:12, fontWeight:700, cursor:'pointer' }}>✕</button>
          )}
        </div>

        {/* Export buttons — only for allowed roles */}
        <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center' }}>
          <span style={{ fontSize:12, color:'#5a7080' }}>Найдено: <strong>{filtered.length}</strong></span>
          {can(role, 'export_data') && (
            <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
              <button onClick={exportExcel} disabled={exporting||!filtered.length}
                style={{ padding:'7px 14px', borderRadius:3, border:'none', background:'#16a34a', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', opacity:exporting?.6:1, fontFamily:"'Barlow Condensed',sans-serif" }}>
                📊 Excel
              </button>
              <button onClick={exportPDF} disabled={exporting||!filtered.length}
                style={{ padding:'7px 14px', borderRadius:3, border:'none', background:'#dc2626', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', opacity:exporting?.6:1, fontFamily:"'Barlow Condensed',sans-serif" }}>
                📄 PDF
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ flex:1, overflowY:'auto', background:'#fff', borderRadius:3, border:'1px solid #d1cfc9', overflow:'hidden' }}>
          {loading ? <LoadingDots /> : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'#8fa0ae' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📭</div><div>Заявок не найдено</div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0 }}>
                <tr>{['ID','Тип','Автор','Участок','Дата','Статус'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const st = STATUS_MAP[r.status]||STATUS_MAP.new
                  const isSelected = selected?.id === r.id
                  const authorDisplay = r.anonymous
                    ? (can(role, 'view_anonymous') ? `🎭 Аноним` : '🎭 Аноним')
                    : (r.author||'—')
                  return (
                    <tr key={r.id}
                      onClick={() => { setSelected(r); setEditFields({ status:r.status, assigned_to:r.assigned_to||'', admin_comment:r.admin_comment||'', deadline:r.deadline?r.deadline.slice(0,16):'' }) }}
                      style={{ background:isSelected?'rgba(245,61,45,.05)':'', cursor:'pointer', borderLeft:isSelected?'3px solid #f53d2d':'3px solid transparent' }}
                      onMouseOver={e => !isSelected&&(e.currentTarget.style.background='#f5f4f0')}
                      onMouseOut={e => !isSelected&&(e.currentTarget.style.background='')}>
                      <td style={tdStyle}><span style={{ fontFamily:'monospace', color:'#f53d2d', fontSize:12 }}>{pad(r.id)}</span></td>
                      <td style={tdStyle}><TypeBadge type={r.type} urgency={r.risk_urgency}/></td>
                      <td style={tdStyle}>{authorDisplay}</td>
                      <td style={tdStyle}>{r.location||'—'}</td>
                      <td style={tdStyle}>{fmtDate(r.date||r.created_at)}</td>
                      <td style={tdStyle}><StatusBadge status={r.status}/></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ flex:1, background:'#fff', borderRadius:3, border:'1px solid #d1cfc9', overflow:'hidden', display:'flex', flexDirection:'column', minWidth:300 }}>
          <div style={{ padding:'12px 16px', background:'#0f1c2c', borderBottom:'2px solid #f53d2d', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:14, fontWeight:800, color:'#e8e7e3', fontFamily:"'Barlow Condensed',sans-serif", textTransform:'uppercase' }}>{pad(selected.id)}</span>
              <RoleBadge role={role} />
            </div>
            <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'rgba(232,231,227,.7)', fontSize:20, cursor:'pointer' }}>×</button>
          </div>

          <div style={{ overflowY:'auto', flex:1, padding:16 }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                <TypeBadge type={selected.type} urgency={selected.risk_urgency}/>
                <StatusBadge status={selected.status}/>
              </div>
              <div style={{ fontSize:13, color:'#0f1c2c', lineHeight:1.7, marginBottom:8, background:'#f2f1ee', padding:'10px 12px', borderRadius:4 }}>
                {selected.description}
              </div>
              <div style={{ fontSize:12, color:'#5a7080' }}>
                👤 {selected.anonymous
                  ? (can(role, 'view_anonymous') ? `Аноним (ID: ${selected.author_id||'?'})` : 'Аноним')
                  : selected.author
                } · 📍 {selected.location||'—'} · 🕐 {fmtDate(selected.date||selected.created_at)}
              </div>
              {selected.deadline && (
                <div style={{ fontSize:12, marginTop:4, fontWeight:700, color:new Date(selected.deadline)<new Date()?'#dc2626':'#5a7080' }}>
                  ⏰ {fmtDate(selected.deadline)}{new Date(selected.deadline)<new Date()?' — ПРОСРОЧЕНО!':''}
                </div>
              )}
            </div>

            {/* Permissions notice */}
            {!can(role, 'change_status') && (
              <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, padding:'10px 12px', marginBottom:12, fontSize:12, color:'#92400e' }}>
                ℹ️ Ваша роль позволяет только просматривать заявки
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:12, opacity: can(role,'change_status') ? 1 : 0.6, pointerEvents: can(role,'change_status') ? 'auto' : 'none' }}>
              <div>
                <Label>Статус</Label>
                <select value={editFields.status||selected.status} onChange={e => setEditFields(f => ({ ...f, status:e.target.value }))} style={{ width:'100%', ...selStyle }}>
                  {Object.entries(STATUS_MAP).map(([v,s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
              </div>

              {can(role, 'assign_request') && (
                <div>
                  <Label>Назначить исполнителя</Label>
                  <select value={editFields.assigned_to} onChange={e => setEditFields(f => ({ ...f, assigned_to:e.target.value }))} style={{ width:'100%', ...selStyle }}>
                    <option value="">— Не назначен —</option>
                    {users.filter(u => ['admin','manager','engineer','master'].includes(u.role)).map(u => (
                      <option key={u.id} value={u.name}>{u.name} ({u.department})</option>
                    ))}
                  </select>
                </div>
              )}

              {can(role, 'set_deadline') && (
                <div>
                  <Label>Дедлайн</Label>
                  <input type="datetime-local" value={editFields.deadline} onChange={e => setEditFields(f => ({ ...f, deadline:e.target.value }))} style={{ width:'100%', ...selStyle }} />
                </div>
              )}

              {can(role, 'add_admin_comment') && (
                <div>
                  <Label>Комментарий администратора</Label>
                  <textarea value={editFields.admin_comment} onChange={e => setEditFields(f => ({ ...f, admin_comment:e.target.value }))}
                    rows={3} placeholder="Виден автору заявки…"
                    style={{ width:'100%', padding:'8px 11px', border:'1px solid #d1cfc9', borderBottom:'2px solid #d1cfc9', borderRadius:3, background:'#f2f1ee', color:'#0f1c2c', fontSize:13, outline:'none', resize:'none', fontFamily:'inherit' }} />
                </div>
              )}

              {can(role, 'change_status') && (
                <button disabled={updating} onClick={() => updateRequest(selected.id, {
                    status: editFields.status,
                    assigned_to: can(role,'assign_request') ? (editFields.assigned_to||null) : selected.assigned_to,
                    admin_comment: can(role,'add_admin_comment') ? (editFields.admin_comment||null) : selected.admin_comment,
                    deadline: can(role,'set_deadline') ? (editFields.deadline ? new Date(editFields.deadline).toISOString() : null) : selected.deadline,
                  }, `Статус → ${STATUS_MAP[editFields.status]?.label}`)}
                  style={{ width:'100%', padding:11, borderRadius:3, border:'none', background:'linear-gradient(135deg,#f53d2d,#c42b1c)', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', opacity:updating?.6:1, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em', textTransform:'uppercase' }}>
                  {updating ? 'СОХРАНЕНИЕ…' : '✅ СОХРАНИТЬ'}
                </button>
              )}

              {can(role, 'delete_request') && (
                <button onClick={() => deleteRequest(selected.id)}
                  style={{ width:'100%', padding:9, borderRadius:3, border:'1px solid #fecaca', background:'#fef2f2', color:'#ef4444', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em', textTransform:'uppercase' }}>
                  🗑️ УДАЛИТЬ ЗАЯВКУ
                </button>
              )}
            </div>

            {/* Change log */}
            {parseJson(selected.change_log, []).length > 0 && (
              <div style={{ marginTop:16 }}>
                <Label>История изменений</Label>
                {parseJson(selected.change_log, []).map((log,i) => (
                  <div key={i} style={{ display:'flex', gap:8, padding:'6px 0', borderBottom:'1px solid #f2f1ee' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#f53d2d', flexShrink:0, marginTop:4 }} />
                    <div>
                      <div style={{ fontSize:12, color:'#0f1c2c', fontWeight:600 }}>{log.action}</div>
                      <div style={{ fontSize:11, color:'#5a7080' }}>{log.by} · {fmtDate(log.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RoleBadge({ role }) {
  const colors = { admin:'#dc2626', manager:'#d97706', engineer:'#2563eb', master:'#059669', staff:'#6b7280' }
  const labels = { admin:'Admin', manager:'Manager', engineer:'Engineer', master:'Master', staff:'Staff' }
  const color = colors[role]||'#6b7280'
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:3, background:`${color}22`, color, border:`1px solid ${color}44`, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em' }}>
      {labels[role]||role}
    </span>
  )
}

function TypeBadge({ type, urgency }) {
  return <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999, background:type==='risk'?'#fff7ed':'#ecfdf5', color:type==='risk'?'#c2410c':'#059669' }}>
    {type==='risk'?`⚠️ Риск${urgency?` L${urgency}`:''}` :'💡 Идея'}
  </span>
}

function StatusBadge({ status }) {
  const st = STATUS_MAP[status]||STATUS_MAP.new
  return <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999, background:`${st.color}18`, color:st.color }}>{st.label}</span>
}

function Label({ children }) {
  return <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#5a7080', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{children}</label>
}

function parseJson(val, def) {
  if (!val) return def
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return def }
}

const thStyle = { padding:'8px 13px', textAlign:'left', fontSize:11, fontWeight:700, color:'#e8e7e3', textTransform:'uppercase', letterSpacing:'.06em', background:'#0f1c2c', borderBottom:'2px solid #f53d2d', whiteSpace:'nowrap', fontFamily:"'Barlow Condensed',sans-serif" }
const tdStyle = { padding:'9px 13px', fontSize:13, color:'#2a3f52', borderBottom:'1px solid #f2f1ee', verticalAlign:'middle' }
const selStyle = { padding:'8px 10px', border:'1px solid #d1cfc9', borderRadius:9, background:'#f2f1ee', color:'#0f1c2c', fontSize:12, outline:'none' }
