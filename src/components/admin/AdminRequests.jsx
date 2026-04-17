import React, { useState, useEffect } from 'react'
import { supabase, pad, fmtDate, STATUS_MAP } from '../../lib/supabase.js'
import { can } from '../../lib/permissions.js'
import { notifyUser } from '../../lib/telegram.js'
import LoadingDots from '../common/LoadingDots.jsx'
import { Pagination } from './AdminUsers.jsx'

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
  const REQ_PAGE_SIZE = 15
  const [page, setPage] = useState(1)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: reqs }, { data: usrs }] = await Promise.all([
      supabase.from('requests').select('*').order('id', { ascending: false }).limit(500),
      supabase.from('users').select('id,name,department,role,telegram_id').order('name'),
    ])
    setRequests(reqs || [])
    setUsers(usrs || [])
    setLoading(false)
  }

  async function updateRequest(id, updates, logAction) {
    if (!can(role, 'change_status')) { showToast('Нет прав', 'error'); return }
    setUpdating(true)
    const req = requests.find(r => r.id === id)
    const log = parseJson(req?.change_log, [])
    if (logAction) log.push({ action: logAction, by: adminUser.name, date: new Date().toISOString() })
    const { error } = await supabase.from('requests').update({ ...updates, change_log: log }).eq('id', id)
    if (error) { showToast('Ошибка: ' + error.message, 'error'); setUpdating(false); return }
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates, change_log: log } : r))
    if (selected?.id === id) setSelected(prev => ({ ...prev, ...updates, change_log: log }))
    if (updates.status && req?.author_id) {
      const stLabel = STATUS_MAP[updates.status]?.label || updates.status
      await notifyUser(supabase, req.author_id, `🔄 Статус: ${stLabel}`,
        `${pad(id)}: ${stLabel}${updates.admin_comment ? `\n${updates.admin_comment}` : ''}`, 'status_update')
    }
    if (updates.assigned_to && updates.assigned_to !== req?.assigned_to) {
      const assignee = users.find(u => u.name === updates.assigned_to)
      if (assignee) await notifyUser(supabase, assignee.id, '👤 Вам назначена заявка',
        `${pad(id)} — ${(req?.description || '').slice(0, 100)}`, 'status_update')
    }
    onBadgeUpdate(); showToast('✅ Обновлено'); setUpdating(false)
  }

  async function deleteRequest(id) {
    if (!can(role, 'delete_request')) { showToast('Только администратор', 'error'); return }
    if (!confirm(`Удалить ${pad(id)}?`)) return
    await supabase.from('requests').delete().eq('id', id)
    setRequests(prev => prev.filter(r => r.id !== id))
    setSelected(null); showToast('🗑️ Удалено'); onBadgeUpdate()
  }

  // ── EXCEL EXPORT (правильный CSV с колонками) ──────────────────────────────
  async function exportExcel() {
    if (!can(role, 'export_data')) { showToast('Нет прав', 'error'); return }
    setExporting(true)
    try {
      // Заголовки колонок
      const headers = ['ID', 'Тип', 'Описание', 'Автор', 'Участок', 'Статус',
        'Уровень риска', 'Тип события', 'Назначен', 'Дедлайн', 'Дата создания', 'Анонимно']

      // Строки данных
      const rows = filtered.map(r => [
        pad(r.id),
        r.type === 'risk' ? 'Риск' : 'Идея',
        (r.description || '').replace(/[\n\r,;"]/g, ' '),
        r.anonymous ? 'Аноним' : (r.author || ''),
        r.location || '',
        STATUS_MAP[r.status]?.label || r.status || '',
        r.risk_urgency ? `Уровень ${r.risk_urgency}` : '',
        r.risk_event_type || '',
        r.assigned_to || '',
        r.deadline ? fmtDate(r.deadline) : '',
        fmtDate(r.date || r.created_at),
        r.anonymous ? 'Да' : 'Нет',
      ])

      // Строим CSV правильно — каждое поле в кавычках
      const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`
      const csvLines = [
        headers.map(escape).join(';'), // разделитель ; для Excel на русском
        ...rows.map(row => row.map(escape).join(';'))
      ]
      const csv = csvLines.join('\r\n') // Windows line endings для Excel

      const BOM = '\uFEFF' // UTF-8 BOM — Excel распознаёт кириллицу
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `akkermann-${new Date().toLocaleDateString('ru').replace(/\./g, '-')}.csv`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      showToast(`✅ Экспортировано ${filtered.length} строк`)
    } catch(e) { showToast('Ошибка: ' + e.message, 'error') }
    setExporting(false)
  }

  async function exportPDF() {
    if (!can(role, 'export_data')) { showToast('Нет прав', 'error'); return }
    setExporting(true)
    const date = new Date().toLocaleDateString('ru', { day: '2-digit', month: 'long', year: 'numeric' })
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>body{font-family:Arial,sans-serif;font-size:10px;margin:15px}
      h1{color:#f53d2d;font-size:14px;margin-bottom:4px}
      table{width:100%;border-collapse:collapse}
      th{background:#0f1c2c;color:white;padding:5px 6px;text-align:left;font-size:9px;text-transform:uppercase}
      td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top;max-width:150px;word-wrap:break-word}
      tr:nth-child(even) td{background:#f9f9f9}</style></head>
      <body><h1>AKKERMANN PULSE — Отчёт</h1>
      <p style="color:#666;font-size:9px">${date} · ${filtered.length} заявок · ${adminUser.name}</p>
      <table><thead><tr>
        <th>ID</th><th>Тип</th><th>Описание</th><th>Автор</th>
        <th>Участок</th><th>Статус</th><th>Назначен</th><th>Дедлайн</th>
      </tr></thead><tbody>
      ${filtered.slice(0,100).map(r=>`<tr>
        <td style="color:#f53d2d;font-family:monospace;white-space:nowrap">${pad(r.id)}</td>
        <td>${r.type==='risk'?`⚠️ Риск${r.risk_urgency?` L${r.risk_urgency}`:''}` :'💡 Идея'}</td>
        <td>${(r.description||'').slice(0,60)}${(r.description||'').length>60?'…':''}</td>
        <td>${r.anonymous?'Аноним':(r.author||'—')}</td>
        <td>${r.location||'—'}</td>
        <td>${STATUS_MAP[r.status]?.label||'—'}</td>
        <td>${r.assigned_to||'—'}</td>
        <td style="white-space:nowrap">${r.deadline?fmtDate(r.deadline):'—'}</td>
      </tr>`).join('')}</tbody></table></body></html>`
    const win = window.open('','_blank'); win.document.write(html); win.document.close()
    setTimeout(() => win.print(), 500)
    showToast('PDF готов — Файл → Печать → Сохранить как PDF')
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
      {/* LEFT: Table */}
      <div style={{ flex: selected ? '0 0 55%' : 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

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
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={selStyle} />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={selStyle} />
          {(dateFrom||dateTo||search||statusFilter!=='all'||typeFilter!=='all') && (
            <button onClick={() => { setSearch('');setStatusFilter('all');setTypeFilter('all');setDateFrom('');setDateTo('') }}
              style={{ padding:'7px 10px', borderRadius:9, border:'1px solid #fecaca', background:'#fef2f2', color:'#ef4444', fontSize:12, fontWeight:700, cursor:'pointer' }}>✕</button>
          )}
        </div>

        {/* Export buttons + count */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          {can(role, 'export_data') && (
            <>
              <button onClick={exportExcel} disabled={exporting || !filtered.length}
                style={{ padding: '7px 14px', borderRadius: 3, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
                📊 Excel
              </button>
              <button onClick={exportPDF} disabled={exporting || !filtered.length}
                style={{ padding: '7px 14px', borderRadius: 3, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
                📄 PDF
              </button>
            </>
          )}
        </div>

        {/* Table with new columns */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', overflow: 'hidden' }}>
          {loading ? <LoadingDots /> : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8fa0ae' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div><div>Заявок не найдено</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                <tr>
                  {['ID','Тип','Медиа','Описание','Автор','Дата','Ответственный','Статус','Дедлайн'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page-1)*REQ_PAGE_SIZE, page*REQ_PAGE_SIZE).map(r => {
                  const st = STATUS_MAP[r.status] || STATUS_MAP.new
                  const isSel = selected?.id === r.id
                  const mediaArr = parseJson(r.media, [])
                  const firstImg = mediaArr.find(m => !m.includes('.mp4') && !m.includes('.mov'))
                  return (
                    <tr key={r.id}
                      onClick={() => { setSelected(r); setEditFields({ status: r.status, assigned_to: r.assigned_to||'', admin_comment: r.admin_comment||'', deadline: r.deadline ? r.deadline.slice(0,16) : '' }) }}
                      style={{ background: isSel ? 'rgba(245,61,45,.05)' : '', cursor: 'pointer', borderLeft: isSel ? '3px solid #f53d2d' : '3px solid transparent' }}
                      onMouseOver={e => !isSel && (e.currentTarget.style.background = '#f5f4f0')}
                      onMouseOut={e => !isSel && (e.currentTarget.style.background = '')}>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', color: '#f53d2d', fontSize: 11, fontWeight: 700 }}>{pad(r.id)}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: r.type==='risk'?'#fff7ed':'#ecfdf5', color: r.type==='risk'?'#c2410c':'#059669', whiteSpace: 'nowrap' }}>
                          {r.type==='risk' ? `⚠️${r.risk_urgency ? ` L${r.risk_urgency}` : ''}` : '💡'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, width: 50 }}>
                        {firstImg
                          ? <img src={firstImg} style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 6, border: '1px solid #d1cfc9', display: 'block' }} loading="lazy" />
                          : <span style={{ fontSize: 11, color: '#d1cfc9' }}>—</span>
                        }
                        {mediaArr.length > 1 && (
                          <div style={{ fontSize: 9, color: '#8fa0ae', textAlign: 'center', marginTop: 2 }}>+{mediaArr.length - 1}</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 200 }}>
                        <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                          {r.description || '—'}
                        </div>
                      </td>
                      <td style={tdStyle}>{r.anonymous ? '🎭' : (r.author || '—')}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(r.date || r.created_at)}</td>
                      <td style={tdStyle}>
                        {r.assigned_to
                          ? <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>👷 {r.assigned_to}</span>
                          : <span style={{ fontSize: 11, color: '#d1cfc9' }}>—</span>
                        }
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: `${st.color}18`, color: st.color, whiteSpace: 'nowrap' }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 11 }}>
                        {r.deadline
                          ? <span style={{ color: new Date(r.deadline) < new Date() ? '#dc2626' : '#5a7080', fontWeight: new Date(r.deadline) < new Date() ? 700 : 400 }}>
                              {new Date(r.deadline) < new Date() ? '🚨 ' : '⏰ '}{fmtDate(r.deadline)}
                            </span>
                          : <span style={{ color: '#d1cfc9' }}>—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} total={filtered.length} pageSize={REQ_PAGE_SIZE} onChange={setPage} />
      </div>

      {/* RIGHT: Detail panel */}
      {selected && (
        <div style={{ flex: 1, background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 280 }}>
          <div style={{ padding: '12px 16px', background: '#0f1c2c', borderBottom: '2px solid #f53d2d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>{pad(selected.id)}</span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'rgba(232,231,227,.7)', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: selected.type==='risk'?'#fff7ed':'#ecfdf5', color: selected.type==='risk'?'#c2410c':'#059669' }}>
                  {selected.type==='risk'?`⚠️ Риск${selected.risk_urgency?` L${selected.risk_urgency}`:''}` :'💡 Идея'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${(STATUS_MAP[selected.status]||STATUS_MAP.new).color}18`, color: (STATUS_MAP[selected.status]||STATUS_MAP.new).color }}>
                  {(STATUS_MAP[selected.status]||STATUS_MAP.new).label}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#0f1c2c', lineHeight: 1.7, background: '#f2f1ee', padding: '10px 12px', borderRadius: 4, marginBottom: 8 }}>
                {selected.description}
              </div>
              <div style={{ fontSize: 12, color: '#5a7080' }}>
                👤 {selected.anonymous?'Аноним':selected.author} · 📍 {selected.location||'—'} · {fmtDate(selected.date||selected.created_at)}
              </div>

              {/* Media thumbnails in detail */}
              {parseJson(selected.media, []).length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {parseJson(selected.media, []).map((m, i) => (
                    <img key={i} src={m} onClick={() => window.open(m, '_blank')}
                      style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #d1cfc9', cursor: 'pointer' }} loading="lazy" />
                  ))}
                </div>
              )}
            </div>

            {!can(role, 'change_status') && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                ℹ️ Ваша роль позволяет только просматривать
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: can(role,'change_status') ? 1 : 0.5, pointerEvents: can(role,'change_status') ? 'auto' : 'none' }}>
              <div>
                <Label>Статус</Label>
                <select value={editFields.status} onChange={e => setEditFields(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', ...selStyle }}>
                  {Object.entries(STATUS_MAP).map(([v,s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
              </div>
              {can(role, 'assign_request') && (
                <div>
                  <Label>Исполнитель</Label>
                  <select value={editFields.assigned_to} onChange={e => setEditFields(f => ({ ...f, assigned_to: e.target.value }))} style={{ width: '100%', ...selStyle }}>
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
                  <input type="datetime-local" value={editFields.deadline} onChange={e => setEditFields(f => ({ ...f, deadline: e.target.value }))} style={{ width: '100%', ...selStyle }} />
                </div>
              )}
              {can(role, 'add_admin_comment') && (
                <div>
                  <Label>Комментарий (виден автору)</Label>
                  <textarea value={editFields.admin_comment} onChange={e => setEditFields(f => ({ ...f, admin_comment: e.target.value }))} rows={3}
                    style={{ width: '100%', padding: '8px 11px', border: '1px solid #d1cfc9', borderBottom: '2px solid #d1cfc9', borderRadius: 3, background: '#f2f1ee', color: '#0f1c2c', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                </div>
              )}
              {can(role, 'change_status') && (
                <button disabled={updating} onClick={() => updateRequest(selected.id, {
                    status: editFields.status,
                    assigned_to: can(role,'assign_request') ? (editFields.assigned_to||null) : selected.assigned_to,
                    admin_comment: can(role,'add_admin_comment') ? (editFields.admin_comment||null) : selected.admin_comment,
                    deadline: can(role,'set_deadline') ? (editFields.deadline ? new Date(editFields.deadline).toISOString() : null) : selected.deadline,
                  }, `Статус → ${STATUS_MAP[editFields.status]?.label}`)}
                  style={{ width: '100%', padding: 11, borderRadius: 3, border: 'none', background: 'linear-gradient(135deg,#f53d2d,#c42b1c)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: updating ? .6 : 1, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  {updating ? 'СОХРАНЕНИЕ…' : '✅ СОХРАНИТЬ И УВЕДОМИТЬ'}
                </button>
              )}
              {can(role, 'delete_request') && (
                <button onClick={() => deleteRequest(selected.id)}
                  style={{ width: '100%', padding: 9, borderRadius: 3, border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>
                  🗑️ УДАЛИТЬ
                </button>
              )}
            </div>

            {parseJson(selected.change_log, []).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Label>История</Label>
                {parseJson(selected.change_log, []).map((log,i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #f2f1ee' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f53d2d', flexShrink: 0, marginTop: 5 }} />
                    <div>
                      <div style={{ fontSize: 11, color: '#0f1c2c', fontWeight: 600 }}>{log.action}</div>
                      <div style={{ fontSize: 10, color: '#5a7080' }}>{log.by} · {fmtDate(log.date)}</div>
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

function Label({ children }) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5a7080', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</label>
}

function parseJson(val, def) {
  if (!val) return def
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return def }
}

function PaginationBtn({ children, onClick, disabled, active }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minWidth: 32, height: 32, padding: '0 8px',
      borderRadius: 6, border: `1px solid ${active ? '#f53d2d' : '#d1cfc9'}`,
      background: active ? '#f53d2d' : disabled ? '#f9f9f9' : '#fff',
      color: active ? '#fff' : disabled ? '#d1cfc9' : '#2a3f52',
      fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{children}</button>
  )
}


const thStyle = { padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#e8e7e3', textTransform: 'uppercase', letterSpacing: '.05em', background: '#0f1c2c', borderBottom: '2px solid #f53d2d', whiteSpace: 'nowrap', fontFamily: "'Barlow Condensed',sans-serif" }
const tdStyle = { padding: '8px 10px', fontSize: 12, color: '#2a3f52', borderBottom: '1px solid #f2f1ee', verticalAlign: 'middle' }
const selStyle = { padding: '8px 10px', border: '1px solid #d1cfc9', borderRadius: 9, background: '#f2f1ee', color: '#0f1c2c', fontSize: 12, outline: 'none' }
