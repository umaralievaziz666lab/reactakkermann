import React, { useState, useEffect } from 'react'
import { supabase, pad, fmtDate, STATUS_MAP } from '../../lib/supabase.js'
import LoadingDots from '../common/LoadingDots.jsx'

export default function AdminRequests({ adminUser, showToast, onBadgeUpdate }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [users, setUsers] = useState([])
  const [updating, setUpdating] = useState(false)
  const [editFields, setEditFields] = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: reqs }, { data: usrs }] = await Promise.all([
      supabase.from('requests').select('*').order('id', { ascending: false }).limit(200),
      supabase.from('users').select('id,name,department,role').order('name'),
    ])
    setRequests(reqs || [])
    setUsers(usrs || [])
    setLoading(false)
  }

  async function updateRequest(id, updates, logAction) {
    setUpdating(true)
    const req = requests.find(r => r.id === id)
    const log = req?.change_log ? (Array.isArray(req.change_log) ? req.change_log : JSON.parse(req.change_log || '[]')) : []
    if (logAction) log.push({ action: logAction, by: adminUser.name, date: new Date().toISOString() })

    const { error } = await supabase.from('requests').update({ ...updates, change_log: log }).eq('id', id)
    if (error) { showToast('Ошибка: ' + error.message, 'error'); setUpdating(false); return }

    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates, change_log: log } : r))
    if (selected?.id === id) setSelected(prev => ({ ...prev, ...updates, change_log: log }))

    // Notify author about status change
    if (updates.status && req?.author_id) {
      const stLabel = STATUS_MAP[updates.status]?.label || updates.status
      await supabase.from('notifications').insert({
        user_id: req.author_id, title: '🔄 Статус заявки изменён',
        message: `${pad(id)}: ${stLabel}${updates.admin_comment ? ` — ${updates.admin_comment}` : ''}`,
        post_id: id, type: 'status_update', read: false, date: new Date().toISOString()
      })
    }

    onBadgeUpdate()
    showToast('✅ Обновлено')
    setUpdating(false)
  }

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (typeFilter !== 'all' && r.type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!String(r.id).includes(q) && !(r.description || '').toLowerCase().includes(q) && !(r.author || '').toLowerCase().includes(q) && !(r.location || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 100px)' }}>
      {/* List */}
      <div style={{ flex: selected ? '0 0 420px' : 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск…" style={{ width: '100%', padding: '8px 11px 8px 32px', border: '1px solid var(--bd)', borderRadius: 9, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 13, outline: 'none' }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selStyle}>
            <option value="all">Все статусы</option>
            {Object.entries(STATUS_MAP).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selStyle}>
            <option value="all">Все типы</option>
            <option value="idea">💡 Идеи</option>
            <option value="risk">⚠️ Риски</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 3, border: '1px solid var(--bd)', overflow: 'hidden' }}>
          {loading ? <LoadingDots /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr>
                  {['ID','Тип','Автор','Участок','Дата','Статус'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const st = STATUS_MAP[r.status] || STATUS_MAP.new
                  const isSelected = selected?.id === r.id
                  return (
                    <tr key={r.id} onClick={() => { setSelected(r); setEditFields({ status: r.status, assigned_to: r.assigned_to || '', admin_comment: r.admin_comment || '', deadline: r.deadline ? r.deadline.slice(0,16) : '' }) }}
                      style={{ background: isSelected ? 'rgba(245,61,45,.06)' : '', cursor: 'pointer', borderLeft: isSelected ? '3px solid var(--red)' : '3px solid transparent' }}
                      onMouseOver={e => !isSelected && (e.currentTarget.style.background = '#f5f4f0')} onMouseOut={e => !isSelected && (e.currentTarget.style.background = '')}>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace', color: 'var(--acc)', fontSize: 12 }}>{pad(r.id)}</span></td>
                      <td style={tdStyle}><TypeBadge type={r.type} urgency={r.risk_urgency} /></td>
                      <td style={tdStyle}>{r.anonymous ? '🎭 Аноним' : r.author}</td>
                      <td style={tdStyle}>{r.location || '—'}</td>
                      <td style={tdStyle}>{fmtDate(r.date || r.created_at)}</td>
                      <td style={tdStyle}><StatusBadge status={r.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>{filtered.length} из {requests.length}</div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ flex: 1, background: '#fff', borderRadius: 3, border: '1px solid var(--bd)', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 320 }}>
          <div style={{ padding: '12px 16px', background: 'var(--navy)', borderBottom: '2px solid var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>
              {pad(selected.id)}
            </span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'rgba(232,231,227,.7)', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
            {/* Info */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <TypeBadge type={selected.type} urgency={selected.risk_urgency} />
                <StatusBadge status={selected.status} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.7, marginBottom: 8 }}>{selected.description}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                👤 {selected.anonymous ? 'Аноним' : selected.author} · 📍 {selected.location || '—'} · 🕐 {fmtDate(selected.date || selected.created_at)}
              </div>
            </div>

            {/* Edit form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Label>Статус</Label>
                <select value={editFields.status || selected.status} onChange={e => setEditFields(f => ({ ...f, status: e.target.value }))} style={{ ...selStyle, width: '100%' }}>
                  {Object.entries(STATUS_MAP).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
              </div>

              <div>
                <Label>Назначить исполнителя</Label>
                <select value={editFields.assigned_to} onChange={e => setEditFields(f => ({ ...f, assigned_to: e.target.value }))} style={{ ...selStyle, width: '100%' }}>
                  <option value="">— Не назначен —</option>
                  {users.filter(u => ['admin','manager','engineer','master'].includes(u.role)).map(u => (
                    <option key={u.id} value={u.name}>{u.name} ({u.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Дедлайн</Label>
                <input type="datetime-local" value={editFields.deadline} onChange={e => setEditFields(f => ({ ...f, deadline: e.target.value }))} style={{ ...selStyle, width: '100%' }} />
              </div>

              <div>
                <Label>Комментарий администратора</Label>
                <textarea value={editFields.admin_comment} onChange={e => setEditFields(f => ({ ...f, admin_comment: e.target.value }))} rows={3}
                  placeholder="Комментарий, видимый автору…"
                  style={{ width: '100%', padding: '8px 11px', border: '1px solid var(--bd)', borderBottom: '2px solid var(--bd)', borderRadius: 3, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
              </div>

              <button
                disabled={updating}
                onClick={() => updateRequest(selected.id, {
                  status: editFields.status,
                  assigned_to: editFields.assigned_to || null,
                  admin_comment: editFields.admin_comment || null,
                  deadline: editFields.deadline ? new Date(editFields.deadline).toISOString() : null,
                }, `Статус → ${STATUS_MAP[editFields.status]?.label}${editFields.assigned_to ? `, назначено: ${editFields.assigned_to}` : ''}`)}
                style={{ width: '100%', padding: 11, borderRadius: 3, border: 'none', background: 'linear-gradient(135deg,#f53d2d,#c42b1c)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: updating ? .6 : 1, letterSpacing: '.04em', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}
              >{updating ? 'СОХРАНЕНИЕ…' : 'СОХРАНИТЬ ИЗМЕНЕНИЯ'}</button>

              {/* Change log */}
              {selected.change_log && (
                <div>
                  <Label>История изменений</Label>
                  {parseJson(selected.change_log, []).map((log, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--bg3)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--acc)', flexShrink: 0, marginTop: 4 }} />
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 600 }}>{log.action}</div>
                        <div style={{ fontSize: 11, color: 'var(--t3)' }}>{log.by} · {fmtDate(log.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TypeBadge({ type, urgency }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: type === 'risk' ? '#fff7ed' : '#ecfdf5', color: type === 'risk' ? '#c2410c' : '#059669' }}>
      {type === 'risk' ? `⚠️ Риск${urgency ? ` L${urgency}` : ''}` : '💡 Идея'}
    </span>
  )
}

function StatusBadge({ status }) {
  const st = STATUS_MAP[status] || STATUS_MAP.new
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${st.color}18`, color: st.color }}>{st.label}</span>
}

function Label({ children }) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{children}</label>
}

function parseJson(val, def) {
  if (!val) return def
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return def }
}

const thStyle = { padding: '8px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#e8e7e3', textTransform: 'uppercase', letterSpacing: '.06em', background: 'var(--navy)', borderBottom: '2px solid var(--red)', whiteSpace: 'nowrap', fontFamily: "'Barlow Condensed', sans-serif" }
const tdStyle = { padding: '9px 13px', fontSize: 13, color: 'var(--t2)', borderBottom: '1px solid var(--bg3)', verticalAlign: 'middle' }
const selStyle = { padding: '8px 10px', border: '1px solid var(--bd)', borderRadius: 9, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 12, outline: 'none' }
