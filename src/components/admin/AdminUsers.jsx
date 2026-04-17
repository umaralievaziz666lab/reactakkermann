import React, { useState, useEffect } from 'react'
import { supabase, lvlInfo } from '../../lib/supabase.js'
import LoadingDots from '../common/LoadingDots.jsx'
import UserReport from './UserReport.jsx'

const ROLES = ['admin','manager','engineer','master','staff']
const ROLE_LABELS = { admin:'Администратор', manager:'Менеджер', engineer:'Инженер', master:'Мастер', staff:'Сотрудник' }
const ROLE_COLORS = { admin:'#dc2626', manager:'#d97706', engineer:'#2563eb', master:'#059669', staff:'#6b7280' }
const PAGE_SIZE = 15

export function AdminUsers({ adminUser, showToast }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [editPoints, setEditPoints] = useState('')
  const [saving, setSaving] = useState(false)
  const [reportUserId, setReportUserId] = useState(null)
  const [page, setPage] = useState(1)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('points', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  async function saveUser() {
    setSaving(true)
    const updates = {}
    if (editRole) updates.role = editRole
    if (editPoints !== '') updates.points = parseInt(editPoints) || 0
    const { error } = await supabase.from('users').update(updates).eq('id', selected.id)
    if (error) showToast('Ошибка: ' + error.message, 'error')
    else { showToast('✅ Обновлено'); setUsers(prev => prev.map(u => u.id === selected.id ? { ...u, ...updates } : u)); setSelected(s => ({ ...s, ...updates })) }
    setSaving(false)
  }

  async function deleteUser(id) {
    if (!confirm('Удалить пользователя?')) return
    await supabase.from('users').delete().eq('id', id)
    setUsers(prev => prev.filter(u => u.id !== id)); setSelected(null); showToast('Удалено')
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.name?.toLowerCase().includes(q) || String(u.id).includes(q) || u.department?.toLowerCase().includes(q)
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 100px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ marginBottom: 12 }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Поиск по имени, ID, участку…"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1cfc9', borderRadius: 9, background: '#f2f1ee', fontSize: 13, outline: 'none', color: '#0f1c2c' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', overflow: 'hidden' }}>
          {loading ? <LoadingDots /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                <tr>{['ID','Имя / Telegram','Участок','Роль','ТОП','Уровень','✓'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {paginated.map(u => {
                  const lv = lvlInfo(u.points || 0)
                  const isSel = selected?.id === u.id
                  return (
                    <tr key={u.id} onClick={() => { setSelected(u); setEditRole(u.role||'staff'); setEditPoints(String(u.points||0)) }}
                      style={{ background: isSel ? 'rgba(245,61,45,.05)' : '', cursor: 'pointer', borderLeft: isSel ? '3px solid #f53d2d' : '3px solid transparent' }}
                      onMouseOver={e => !isSel && (e.currentTarget.style.background = '#f5f4f0')}
                      onMouseOut={e => !isSel && (e.currentTarget.style.background = '')}>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{u.id}</span></td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: '#0f1c2c', fontSize: 13 }}>{u.name}</div>
                        {u.telegram_username && <div style={{ fontSize: 10, color: '#8fa0ae' }}>@{u.telegram_username}</div>}
                      </td>
                      <td style={tdStyle}>{u.department || '—'}</td>
                      <td style={tdStyle}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${ROLE_COLORS[u.role]||'#6b7280'}18`, color: ROLE_COLORS[u.role]||'#6b7280' }}>{ROLE_LABELS[u.role]||u.role}</span></td>
                      <td style={tdStyle}><strong style={{ color: '#f53d2d' }}>{u.points||0}</strong></td>
                      <td style={tdStyle}><span className={`level-badge ${lv.cls}`} style={{ display:'inline-flex', padding:'1px 8px', borderRadius:999, fontSize:10, fontWeight:700 }}>{lv.label}</span></td>
                      <td style={tdStyle}>{u.is_trained ? '✅' : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* Detail */}
      {selected && (
        <div style={{ width: 300, flexShrink: 0, background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', overflow: 'hidden', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
          <div style={{ padding: '11px 14px', background: '#0f1c2c', borderBottom: '2px solid #f53d2d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>Редактировать</span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#e8e7e3', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selected.profile_pic && <img src={selected.profile_pic} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #f2f1ee', margin: '0 auto', display: 'block' }} />}
            {[['ID',selected.id],['ФИО',selected.name],['Участок',selected.department||'—'],['Телефон',selected.phone||'—'],['Email',selected.email||'—'],['Telegram',selected.telegram_username?`@${selected.telegram_username}`:'—']].map(([l,v]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #f2f1ee' }}>
                <span style={{ fontSize:11, color:'#5a7080' }}>{l}</span>
                <span style={{ fontSize:11, fontWeight:600, color:'#0f1c2c', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', textAlign:'right' }}>{v}</span>
              </div>
            ))}
            <div><label style={lblStyle}>Роль</label>
              <select value={editRole} onChange={e => setEditRole(e.target.value)} style={inpStyle}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div><label style={lblStyle}>ТОП баллы</label>
              <input type="number" value={editPoints} onChange={e => setEditPoints(e.target.value)} style={inpStyle} />
            </div>
            <button onClick={saveUser} disabled={saving} style={btnStyle}>{saving ? 'Сохранение…' : '✅ Сохранить'}</button>
            <button onClick={() => setReportUserId(selected.id)} style={{ ...btnStyle, background: '#f2f1ee', color: '#0f1c2c', border: '1px solid #d1cfc9' }}>📊 Отчёт</button>
            {adminUser.role === 'admin' && <button onClick={() => deleteUser(selected.id)} style={{ ...btnStyle, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}>🗑️ Удалить</button>}
          </div>
        </div>
      )}
      {reportUserId && <UserReport userId={reportUserId} onClose={() => setReportUserId(null)} />}
    </div>
  )
}
export { AdminUsers as default }

// ─── DEPARTMENTS ──────────────────────────────────────────────────────────────
export function AdminDepts({ showToast }) {
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', parent_id: '' })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null) // { id, name, parent_id }

  useEffect(() => { loadDepts() }, [])

  async function loadDepts() {
    setLoading(true)
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepts(data || [])
    setLoading(false)
  }

  async function addDept(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setAdding(true)
    const { error } = await supabase.from('departments').insert({ name: form.name.trim(), parent_id: form.parent_id || null })
    if (error) showToast('Ошибка: ' + error.message, 'error')
    else { showToast('✅ Добавлено'); setForm({ name: '', parent_id: '' }); loadDepts() }
    setAdding(false)
  }

  async function saveEdit() {
    if (!editing?.name.trim()) return
    const { error } = await supabase.from('departments').update({ name: editing.name.trim(), parent_id: editing.parent_id || null }).eq('id', editing.id)
    if (error) showToast('Ошибка: ' + error.message, 'error')
    else { showToast('✅ Сохранено'); setEditing(null); loadDepts() }
  }

  async function deleteDept(id) {
    if (!confirm('Удалить участок?')) return
    await supabase.from('departments').delete().eq('id', id)
    loadDepts(); showToast('Удалено')
  }

  const parents = depts.filter(d => !d.parent_id)
  const children = depts.filter(d => d.parent_id)

  return (
    <div>
      {/* Add form */}
      <div style={{ background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '11px 16px', background: '#0f1c2c', borderBottom: '2px solid #f53d2d' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>Добавить участок</span>
        </div>
        <form onSubmit={addDept} style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={lblStyle}>Название</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Название участка" required style={inpStyle} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={lblStyle}>Родительский</label>
            <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))} style={inpStyle}>
              <option value="">— Корневой —</option>
              {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={adding} style={{ ...btnStyle, padding: '9px 20px' }}>{adding ? '…' : '+ Добавить'}</button>
        </form>
      </div>

      {/* Edit modal */}
      {editing && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="fade-in" style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#0f1c2c', borderBottom: '2px solid #f53d2d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>✏️ Редактировать участок</span>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'rgba(232,231,227,.7)', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lblStyle}>Название</label>
                <input value={editing.name} onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))} style={inpStyle} />
              </div>
              <div><label style={lblStyle}>Родительский участок</label>
                <select value={editing.parent_id || ''} onChange={e => setEditing(ed => ({ ...ed, parent_id: e.target.value }))} style={inpStyle}>
                  <option value="">— Корневой —</option>
                  {parents.filter(p => p.id !== editing.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditing(null)} style={{ flex: 1, padding: 10, borderRadius: 3, border: '1px solid #d1cfc9', background: '#f2f1ee', color: '#5a7080', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
                <button onClick={saveEdit} style={{ flex: 2, ...btnStyle, padding: 10 }}>✅ Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? <LoadingDots /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {parents.map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 8, border: '1px solid #d1cfc9', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(245,61,45,.04)', borderBottom: '1px solid rgba(245,61,45,.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🏭</span>
                  <span style={{ fontWeight: 700, color: '#0f1c2c', fontSize: 14 }}>{p.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setEditing({ id: p.id, name: p.name, parent_id: p.parent_id || '' })}
                    style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 14, padding: '2px 6px', borderRadius: 4 }}>✏️</button>
                  <button onClick={() => deleteDept(p.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '2px 6px', borderRadius: 4 }}>🗑️</button>
                </div>
              </div>
              {children.filter(c => c.parent_id === p.id).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 8px 28px', borderBottom: '1px solid #f2f1ee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#d1cfc9' }}>└</span>
                    <span style={{ fontSize: 13, color: '#2a3f52' }}>{c.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setEditing({ id: c.id, name: c.name, parent_id: c.parent_id || '' })}
                      style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 13 }}>✏️</button>
                    <button onClick={() => deleteDept(c.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}>🗑️</button>
                  </div>
                </div>
              ))}
              {children.filter(c => c.parent_id === p.id).length === 0 && (
                <div style={{ padding: '8px 14px 8px 28px', fontSize: 12, color: '#8fa0ae', fontStyle: 'italic' }}>Нет подразделений</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── NEWS ─────────────────────────────────────────────────────────────────────
export function AdminNews({ adminUser, showToast }) {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', category: 'announcement', target: 'all' })
  const [submitting, setSubmitting] = useState(false)
  const [depts, setDepts] = useState([])
  const [targetDept, setTargetDept] = useState('')
  const [mediaFiles, setMediaFiles] = useState([])
  const [mediaPreviews, setMediaPreviews] = useState([])
  const [page, setPage] = useState(1)
  const NEWS_PAGE = 15

  useEffect(() => {
    loadNews()
    supabase.from('departments').select('*').then(({ data }) => setDepts(data || []))
  }, [])

  async function loadNews() {
    setLoading(true)
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false }).limit(200)
    setNews(data || [])
    setLoading(false)
  }

  function handleMediaFiles(e) {
    const files = Array.from(e.target.files).slice(0, 4)
    setMediaFiles(files)
    const previews = []
    files.forEach(f => {
      const reader = new FileReader()
      reader.onload = ev => setMediaPreviews(prev => [...prev, ev.target.result])
      reader.readAsDataURL(f)
    })
  }

  async function publish(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      // Upload media
      const mediaUrls = []
      for (const f of mediaFiles) {
        const ext = f.name.split('.').pop()
        const path = `news/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('media').upload(path, f)
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
          mediaUrls.push(publicUrl)
        }
      }

      const { error } = await supabase.from('news').insert({
        title: form.title, content: form.content, category: form.category,
        target: form.target, target_dept: targetDept || null,
        author: adminUser.name,
        media: mediaUrls.length > 0 ? mediaUrls : null,
        created_at: new Date().toISOString(),
      })
      if (error) throw error

      let query = supabase.from('users').select('id')
      if (form.target === 'dept' && targetDept) query = query.eq('department', targetDept)
      const { data: targetUsers } = await query
      if (targetUsers?.length) {
        await supabase.from('notifications').insert(
          targetUsers.map(u => ({ user_id: u.id, title: `📢 ${form.title}`, message: form.content.slice(0, 100), type: 'news', read: false, date: new Date().toISOString() }))
        )
      }
      showToast(`✅ Опубликовано, отправлено: ${targetUsers?.length || 0}`)
      setForm({ title: '', content: '', category: 'announcement', target: 'all' })
      setTargetDept(''); setMediaFiles([]); setMediaPreviews([])
      setShowModal(false); loadNews()
    } catch (err) { showToast('Ошибка: ' + err.message, 'error') }
    setSubmitting(false)
  }

  async function deleteNews(id) {
    if (!confirm('Удалить новость?')) return
    await supabase.from('news').delete().eq('id', id)
    setNews(prev => prev.filter(n => n.id !== id)); showToast('Удалено')
  }

  const CAT_ICONS = { announcement:'📢', achievement:'🏆', safety:'🛡️', general:'📌' }
  const CAT_COLORS = { announcement:'#3b82f6', achievement:'#f59e0b', safety:'#22c55e', general:'#6b7280' }
  const CAT_LABELS = { announcement:'Объявление', achievement:'Достижение', safety:'Безопасность', general:'Общее' }
  const paginated = news.slice((page-1)*NEWS_PAGE, page*NEWS_PAGE)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f1c2c', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '.05em' }}>📰 Лента новостей</div>
          <div style={{ fontSize: 12, color: '#5a7080', marginTop: 2 }}>{news.length} публикаций</div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: '10px 20px', borderRadius: 3, border: 'none', background: 'linear-gradient(135deg,#f53d2d,#c42b1c)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '.06em', textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(245,61,45,.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18 }}>+</span> Добавить новость
        </button>
      </div>

      {loading ? <LoadingDots /> : news.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8fa0ae' }}><div style={{ fontSize: 48, marginBottom: 12 }}>📭</div><div>Новостей нет</div></div>
      ) : (
        <>
          <div style={{ background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', overflow: 'hidden', marginBottom: 12 }}>
            {paginated.map((n, i) => {
              const media = n.media ? (Array.isArray(n.media) ? n.media : JSON.parse(n.media||'[]')) : []
              return (
                <div key={n.id} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderBottom: i < paginated.length-1 ? '1px solid #f2f1ee' : 'none' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: `${CAT_COLORS[n.category]||'#6b7280'}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{CAT_ICONS[n.category]||'📌'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${CAT_COLORS[n.category]||'#6b7280'}15`, color: CAT_COLORS[n.category]||'#6b7280' }}>{CAT_LABELS[n.category]||n.category}</span>
                      <span style={{ fontSize: 11, color: '#8fa0ae', marginLeft: 'auto' }}>{new Date(n.created_at).toLocaleString('ru',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f1c2c', marginBottom: 4 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: '#5a7080', lineHeight: 1.5, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{n.content}</div>
                    {media.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {media.map((m,mi) => <img key={mi} src={m} onClick={() => window.open(m,'_blank')} style={{ width:56, height:56, objectFit:'cover', borderRadius:6, border:'1px solid #d1cfc9', cursor:'pointer' }} />)}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#8fa0ae', marginTop: 4 }}>— {n.author}</div>
                  </div>
                  <button onClick={() => deleteNews(n.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, padding: '4px', flexShrink: 0 }}>🗑️</button>
                </div>
              )
            })}
          </div>
          <Pagination page={page} total={news.length} pageSize={NEWS_PAGE} onChange={setPage} />
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="fade-in" style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.3)', border: '1px solid #d1cfc9' }}>
            <div style={{ padding: '14px 18px', background: '#0f1c2c', borderBottom: '2px solid #f53d2d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>📰 Новая публикация</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(232,231,227,.7)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={publish} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
              <div><label style={lblStyle}>Заголовок *</label><input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} required placeholder="Заголовок…" style={inpStyle} /></div>
              <div><label style={lblStyle}>Текст *</label><textarea value={form.content} onChange={e => setForm(f=>({...f,content:e.target.value}))} required rows={5} placeholder="Текст новости…" style={{ ...inpStyle, resize:'vertical' }} /></div>

              {/* Media upload */}
              <div>
                <label style={lblStyle}>Медиафайлы (до 4 фото)</label>
                <label style={{ display: 'block', padding: '10px', border: '2px dashed #d1cfc9', borderRadius: 8, textAlign: 'center', cursor: 'pointer', background: '#f9f9f9', transition: '.2s' }}
                  onMouseOver={e => e.currentTarget.style.borderColor='#f53d2d'}
                  onMouseOut={e => e.currentTarget.style.borderColor='#d1cfc9'}>
                  <div style={{ fontSize: 20, marginBottom: 3 }}>📎</div>
                  <div style={{ fontSize: 12, color: '#5a7080' }}>Нажмите чтобы прикрепить фото</div>
                  <input type="file" accept="image/*" multiple onChange={handleMediaFiles} style={{ display: 'none' }} />
                </label>
                {mediaPreviews.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {mediaPreviews.map((src,i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={src} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #d1cfc9' }} />
                        <button onClick={() => { setMediaFiles(prev=>prev.filter((_,idx)=>idx!==i)); setMediaPreviews(prev=>prev.filter((_,idx)=>idx!==i)) }}
                          style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'#ef4444', border:'none', color:'#fff', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lblStyle}>Категория</label>
                  <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} style={inpStyle}>
                    <option value="announcement">📢 Объявление</option>
                    <option value="achievement">🏆 Достижение</option>
                    <option value="safety">🛡️ Безопасность</option>
                    <option value="general">📌 Общее</option>
                  </select>
                </div>
                <div><label style={lblStyle}>Кому отправить</label>
                  <select value={form.target} onChange={e => setForm(f=>({...f,target:e.target.value}))} style={inpStyle}>
                    <option value="all">📢 Всем</option>
                    <option value="dept">📍 По участку</option>
                  </select>
                </div>
              </div>
              {form.target === 'dept' && (
                <div><label style={lblStyle}>Участок</label>
                  <select value={targetDept} onChange={e => setTargetDept(e.target.value)} style={inpStyle}>
                    <option value="">Выберите участок</option>
                    {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: 11, borderRadius: 3, border: '1px solid #d1cfc9', background: '#f2f1ee', color: '#5a7080', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
                <button type="submit" disabled={submitting} style={{ flex: 2, ...btnStyle, padding: 11, opacity: submitting ? .6 : 1 }}>
                  {submitting ? '⏳ Публикация…' : '📤 Опубликовать и разослать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
export function AdminAchievements({ showToast }) {
  const [achievements, setAchievements] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', description: '', icon: '🏅', points: 10, target_type: 'posts', target: 1 })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('achievements').select('*').order('target')
    setAchievements(data || [])
    setLoading(false)
  }

  async function add(e) {
    e.preventDefault(); setAdding(true)
    const { error } = await supabase.from('achievements').insert(form)
    if (error) showToast('Ошибка: ' + error.message, 'error')
    else { showToast('✅ Добавлено'); load() }
    setAdding(false)
  }

  async function saveEdit() {
    const { error } = await supabase.from('achievements').update({
      title: editing.title, description: editing.description,
      icon: editing.icon, points: editing.points,
      target_type: editing.target_type, target: editing.target,
    }).eq('id', editing.id)
    if (error) showToast('Ошибка: ' + error.message, 'error')
    else { showToast('✅ Сохранено'); setEditing(null); load() }
  }

  async function del(id) {
    if (!confirm('Удалить?')) return
    await supabase.from('achievements').delete().eq('id', id)
    load(); showToast('Удалено')
  }

  const TARGET_LABELS = { posts:'Заявок', ideas:'Идей', risks:'Рисков', likes:'Лайков', points:'Баллов' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Add form */}
      <div style={{ background: '#fff', borderRadius: 3, border: '1px solid #d1cfc9', overflow: 'hidden' }}>
        <div style={{ padding: '11px 16px', background: '#0f1c2c', borderBottom: '2px solid #f53d2d' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>Добавить достижение</span>
        </div>
        <form onSubmit={add} style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={lblStyle}>Иконка</label><input value={form.icon} onChange={e => setForm(f=>({...f,icon:e.target.value}))} style={{ ...inpStyle, textAlign:'center', fontSize:24 }} /></div>
            <div><label style={lblStyle}>Название *</label><input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} required placeholder="Название" style={inpStyle} /></div>
            <div><label style={lblStyle}>Описание</label><input value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Краткое описание" style={inpStyle} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px auto', gap: 12, alignItems: 'flex-end' }}>
            <div><label style={lblStyle}>Условие</label>
              <select value={form.target_type} onChange={e => setForm(f=>({...f,target_type:e.target.value}))} style={inpStyle}>
                {Object.entries(TARGET_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label style={lblStyle}>Цель</label><input type="number" value={form.target} onChange={e => setForm(f=>({...f,target:parseInt(e.target.value)||1}))} min="1" style={inpStyle} /></div>
            <div><label style={lblStyle}>ТОП</label><input type="number" value={form.points} onChange={e => setForm(f=>({...f,points:parseInt(e.target.value)||0}))} min="0" style={inpStyle} /></div>
            <button type="submit" disabled={adding} style={{ ...btnStyle, padding:'9px 20px' }}>{adding ? '…' : '+ Добавить'}</button>
          </div>
        </form>
      </div>

      {/* Edit modal */}
      {editing && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="fade-in" style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#0f1c2c', borderBottom: '2px solid #f53d2d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase' }}>✏️ Редактировать достижение</span>
              <button onClick={() => setEditing(null)} style={{ background:'none', border:'none', color:'rgba(232,231,227,.7)', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
                <div><label style={lblStyle}>Иконка</label><input value={editing.icon||''} onChange={e => setEditing(ed=>({...ed,icon:e.target.value}))} style={{ ...inpStyle, textAlign:'center', fontSize:24 }} /></div>
                <div><label style={lblStyle}>Название</label><input value={editing.title||''} onChange={e => setEditing(ed=>({...ed,title:e.target.value}))} style={inpStyle} /></div>
              </div>
              <div><label style={lblStyle}>Описание</label><input value={editing.description||''} onChange={e => setEditing(ed=>({...ed,description:e.target.value}))} style={inpStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><label style={lblStyle}>Условие</label>
                  <select value={editing.target_type||'posts'} onChange={e => setEditing(ed=>({...ed,target_type:e.target.value}))} style={inpStyle}>
                    {Object.entries(TARGET_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><label style={lblStyle}>Цель</label><input type="number" value={editing.target||1} onChange={e => setEditing(ed=>({...ed,target:parseInt(e.target.value)||1}))} style={inpStyle} /></div>
                <div><label style={lblStyle}>ТОП</label><input type="number" value={editing.points||0} onChange={e => setEditing(ed=>({...ed,points:parseInt(e.target.value)||0}))} style={inpStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setEditing(null)} style={{ flex:1, padding:10, borderRadius:3, border:'1px solid #d1cfc9', background:'#f2f1ee', color:'#5a7080', fontSize:13, fontWeight:700, cursor:'pointer' }}>Отмена</button>
                <button onClick={saveEdit} style={{ flex:2, ...btnStyle, padding:10 }}>✅ Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cards grid */}
      {loading ? <LoadingDots /> : achievements.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', color:'#8fa0ae' }}>Достижений нет</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {achievements.map(a => (
            <div key={a.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #d1cfc9', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', transition: 'box-shadow .2s' }}
              onMouseOver={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.1)'}
              onMouseOut={e => e.currentTarget.style.boxShadow=''}>
              {/* Action buttons */}
              <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
                <button onClick={() => setEditing({ ...a })} style={{ background:'none', border:'none', color:'#d1cfc9', cursor:'pointer', fontSize:12, padding:2 }}
                  onMouseOver={e => e.currentTarget.style.color='#3b82f6'} onMouseOut={e => e.currentTarget.style.color='#d1cfc9'}>✏️</button>
                <button onClick={() => del(a.id)} style={{ background:'none', border:'none', color:'#d1cfc9', cursor:'pointer', fontSize:12, padding:2 }}
                  onMouseOver={e => e.currentTarget.style.color='#ef4444'} onMouseOut={e => e.currentTarget.style.color='#d1cfc9'}>✕</button>
              </div>
              <div style={{ width:64, height:64, borderRadius:16, background:'linear-gradient(135deg,rgba(245,61,45,.1),rgba(196,43,28,.05))', border:'1px solid rgba(245,61,45,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 }}>
                {a.icon||'🏅'}
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:'#0f1c2c', textAlign:'center', lineHeight:1.3 }}>{a.title}</div>
              {a.description && <div style={{ fontSize:10, color:'#8fa0ae', textAlign:'center', lineHeight:1.4 }}>{a.description}</div>}
              <div style={{ fontSize:10, color:'#5a7080', background:'#f2f1ee', padding:'3px 8px', borderRadius:99, textAlign:'center' }}>
                {TARGET_LABELS[a.target_type]} ≥ {a.target}
              </div>
              <div style={{ fontSize:14, fontWeight:800, color:'#f53d2d' }}>+{a.points} ТОП</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SHARED ───────────────────────────────────────────────────────────────────
export function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return (
    <div style={{ marginTop: 8 }}>
      <span style={{ fontSize: 12, color: '#5a7080' }}>{total} записей</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
      <span style={{ fontSize: 12, color: '#5a7080' }}>
        {total} записей · Стр <strong>{page}</strong> из <strong>{totalPages}</strong>
      </span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <PaginationBtn onClick={() => onChange(1)} disabled={page===1}>«</PaginationBtn>
        <PaginationBtn onClick={() => onChange(p => p-1)} disabled={page===1}>‹</PaginationBtn>
        {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
          let p = page - 3 + i
          if (p < 1) p = i + 1
          if (p > totalPages) p = totalPages - (6 - i)
          if (p < 1 || p > totalPages) return null
          return <PaginationBtn key={p} onClick={() => onChange(p)} active={p === page}>{p}</PaginationBtn>
        })}
        <PaginationBtn onClick={() => onChange(p => p+1)} disabled={page===totalPages}>›</PaginationBtn>
        <PaginationBtn onClick={() => onChange(totalPages)} disabled={page===totalPages}>»</PaginationBtn>
      </div>
    </div>
  )
}

function PaginationBtn({ children, onClick, disabled, active }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minWidth: 34, height: 34, padding: '0 8px', borderRadius: 6,
      border: `1.5px solid ${active ? '#f53d2d' : disabled ? '#e8e7e3' : '#d1cfc9'}`,
      background: active ? '#f53d2d' : disabled ? '#fafafa' : '#fff',
      color: active ? '#fff' : disabled ? '#d1cfc9' : '#2a3f52',
      fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: '.15s', fontFamily: "'Barlow Condensed',sans-serif",
    }}
      onMouseOver={e => !disabled && !active && (e.currentTarget.style.borderColor = '#f53d2d')}
      onMouseOut={e => !disabled && !active && (e.currentTarget.style.borderColor = '#d1cfc9')}
    >{children}</button>
  )
}

const thStyle = { padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#e8e7e3', textTransform:'uppercase', letterSpacing:'.06em', background:'#0f1c2c', borderBottom:'2px solid #f53d2d', whiteSpace:'nowrap', fontFamily:"'Barlow Condensed',sans-serif" }
const tdStyle = { padding:'9px 12px', fontSize:13, color:'#2a3f52', borderBottom:'1px solid #f2f1ee', verticalAlign:'middle' }
const lblStyle = { display:'block', fontSize:11, fontWeight:700, color:'#5a7080', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }
const inpStyle = { width:'100%', padding:'8px 11px', border:'1px solid #d1cfc9', borderBottom:'2px solid #d1cfc9', borderRadius:3, background:'#f2f1ee', color:'#0f1c2c', fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }
const btnStyle = { padding:'9px 14px', borderRadius:3, border:'none', background:'linear-gradient(135deg,#f53d2d,#c42b1c)', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em', textTransform:'uppercase' }
