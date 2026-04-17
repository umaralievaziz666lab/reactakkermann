import React, { useState, useEffect } from 'react'
import { supabase, lvlInfo, fmtDate } from '../../lib/supabase.js'
import UserReport from './UserReport.jsx'
import { notifyNews } from '../../lib/telegram.js'
import LoadingDots from '../common/LoadingDots.jsx'

// ─── USERS ───────────────────────────────────────────────────────────────────
export function AdminUsers({ adminUser, showToast }) { // named export for re-use
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [editPoints, setEditPoints] = useState('')
  const [saving, setSaving] = useState(false)
  const [reportUserId, setReportUserId] = useState(null)

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
    if (error) { showToast('Ошибка: ' + error.message, 'error') }
    else { showToast('✅ Пользователь обновлён'); await loadUsers(); setSelected(s => ({ ...s, ...updates })) }
    setSaving(false)
  }

  async function deleteUser(id) {
    if (!confirm('Удалить пользователя?')) return
    await supabase.from('users').delete().eq('id', id)
    setUsers(prev => prev.filter(u => u.id !== id))
    setSelected(null)
    showToast('Пользователь удалён')
  }

  const ROLES = ['admin','manager','engineer','master','staff']
  const ROLE_LABELS = { admin: 'Администратор', manager: 'Менеджер', engineer: 'Инженер', master: 'Мастер', staff: 'Сотрудник' }

  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.name?.toLowerCase().includes(q) || String(u.id).includes(q) || u.department?.toLowerCase().includes(q)
  })

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 14 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени, ID, участку…" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--bd)', borderRadius: 9, background: 'var(--bg3)', fontSize: 13, outline: 'none', color: 'var(--t1)' }} />
        </div>
        <div style={{ background: '#fff', borderRadius: 3, border: '1px solid var(--bd)', overflow: 'hidden' }}>
          {loading ? <LoadingDots /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['ID','Имя','Участок','Роль','ТОП','Уровень'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const lv = lvlInfo(u.points || 0)
                  return (
                    <tr key={u.id} onClick={() => { setSelected(u); setEditRole(u.role || 'staff'); setEditPoints(String(u.points || 0)) }}
                      style={{ cursor: 'pointer', background: selected?.id === u.id ? 'rgba(245,61,45,.05)' : '' }}
                      onMouseOver={e => selected?.id !== u.id && (e.currentTarget.style.background = '#f5f4f0')} onMouseOut={e => selected?.id !== u.id && (e.currentTarget.style.background = '')}>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.id}</span></td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{u.name}</div>
                        {u.telegram_username && <div style={{ fontSize: 11, color: 'var(--t3)' }}>@{u.telegram_username}</div>}
                      </td>
                      <td style={tdStyle}>{u.department || '—'}</td>
                      <td style={tdStyle}><RoleBadge role={u.role} labels={ROLE_LABELS} /></td>
                      <td style={tdStyle}><strong style={{ color: 'var(--acc)' }}>{u.points || 0}</strong></td>
                      <td style={tdStyle}><span className={`level-badge ${lv.cls}`} style={{ display: 'inline-flex', padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{lv.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>{filtered.length} пользователей</div>
      </div>

      {selected && (
        <div style={{ width: 300, flexShrink: 0, background: '#fff', borderRadius: 3, border: '1px solid var(--bd)', overflow: 'hidden', alignSelf: 'flex-start' }}>
          <div style={{ padding: '11px 14px', background: 'var(--navy)', borderBottom: '2px solid var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>Редактировать</span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#e8e7e3', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InfoRow label="ID" value={selected.id} />
            <InfoRow label="ФИО" value={selected.name} />
            <InfoRow label="Участок" value={selected.department || '—'} />
            <InfoRow label="Телефон" value={selected.phone || '—'} />
            <InfoRow label="Email" value={selected.email || '—'} />

            <div>
              <label style={lblStyle}>Роль</label>
              <select value={editRole} onChange={e => setEditRole(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--bd)', borderRadius: 3, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 13, outline: 'none' }}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>

            <div>
              <label style={lblStyle}>ТОП баллы</label>
              <input type="number" value={editPoints} onChange={e => setEditPoints(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--bd)', borderRadius: 3, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 13, outline: 'none' }} />
            </div>

            <button onClick={saveUser} disabled={saving} style={btnStyle}>{saving ? 'Сохранение…' : '✅ Сохранить'}</button>
            <button onClick={() => setReportUserId(selected.id)} style={{ ...btnStyle, background: '#f2f1ee', color: '#0f1c2c', border: '1px solid #d1cfc9', marginBottom: 8 }}>📊 Отчёт по сотруднику</button>
            {adminUser.role === 'admin' && (
              <button onClick={() => deleteUser(selected.id)} style={{ ...btnStyle, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}>🗑️ Удалить</button>
            )}
          </div>
        </div>
      )}
      {reportUserId && (
        <UserReport userId={reportUserId} onClose={() => setReportUserId(null)} />
      )}
    </div>
  )
}
export { AdminUsers as default }

// ─── DEPARTMENTS ──────────────────────────────────────────────────────────────
export function AdminDepts({ showToast }) {
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newParent, setNewParent] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => { loadDepts() }, [])

  async function loadDepts() {
    setLoading(true)
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepts(data || [])
    setLoading(false)
  }

  async function addDept(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const { error } = await supabase.from('departments').insert({ name: newName.trim(), parent_id: newParent || null })
    if (error) showToast('Ошибка: ' + error.message, 'error')
    else { showToast('✅ Участок добавлен'); setNewName(''); setNewParent(''); loadDepts() }
    setAdding(false)
  }

  async function deleteDept(id) {
    if (!confirm('Удалить участок?')) return
    await supabase.from('departments').delete().eq('id', id)
    loadDepts()
    showToast('Участок удалён')
  }

  const parents = depts.filter(d => !d.parent_id)
  const children = depts.filter(d => d.parent_id)

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Add form */}
      <div style={{ background: '#fff', borderRadius: 3, border: '1px solid var(--bd)', padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginBottom: 12, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>Добавить участок</div>
        <form onSubmit={addDept} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название участка" required style={{ flex: 1, minWidth: 180, padding: '8px 11px', border: '1px solid var(--bd)', borderRadius: 3, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 13, outline: 'none' }} />
          <select value={newParent} onChange={e => setNewParent(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--bd)', borderRadius: 3, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 13, outline: 'none' }}>
            <option value="">— Родительский —</option>
            {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="submit" disabled={adding} style={{ ...btnStyle, padding: '8px 16px' }}>+ Добавить</button>
        </form>
      </div>

      {/* List */}
      {loading ? <LoadingDots /> : parents.map(p => (
        <div key={p.id} style={{ background: 'rgba(245,61,45,.04)', borderRadius: 10, border: '1px solid rgba(245,61,45,.15)', padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: 'var(--t1)' }}>🏭 {p.name}</span>
            <button onClick={() => deleteDept(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>🗑️</button>
          </div>
          {children.filter(c => c.parent_id === p.id).map(c => (
            <div key={c.id} style={{ padding: '5px 12px 5px 24px', borderLeft: '2px solid var(--bd)', marginLeft: 14, marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0 8px 8px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--t2)' }}>└ {c.name}</span>
              <button onClick={() => deleteDept(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>🗑️</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── NEWS ─────────────────────────────────────────────────────────────────────
export function AdminNews({ adminUser, showToast }) {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', content: '', category: 'announcement', target: 'all' })
  const [submitting, setSubmitting] = useState(false)
  const [depts, setDepts] = useState([])
  const [targetDept, setTargetDept] = useState('')

  useEffect(() => {
    loadNews()
    supabase.from('departments').select('*').then(({ data }) => setDepts(data || []))
  }, [])

  async function loadNews() {
    setLoading(true)
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false }).limit(50)
    setNews(data || [])
    setLoading(false)
  }

  async function publish(e) {
    e.preventDefault()
    setSubmitting(true)
    const { data: newsItem, error } = await supabase.from('news').insert({
      title: form.title, content: form.content, category: form.category,
      target: form.target, target_dept: targetDept || null,
      author: adminUser.name, created_at: new Date().toISOString(),
    }).select().single()

    if (error) { showToast('Ошибка: ' + error.message, 'error'); setSubmitting(false); return }

    // Push notifications
    let query = supabase.from('users').select('id')
    if (form.target === 'dept' && targetDept) query = query.eq('department', targetDept)

    const { data: targetUsers } = await query
    if (targetUsers?.length) {
      const notifs = targetUsers.map(u => ({
        user_id: u.id, title: `📢 ${form.title}`, message: form.content.slice(0, 100),
        post_id: null, type: 'news', read: false, date: new Date().toISOString(),
      }))
      await supabase.from('notifications').insert(notifs) // In-app done via notifyNews
    }

    showToast(`✅ Новость опубликована, отправлено уведомлений: ${targetUsers?.length || 0}`)
    setForm({ title: '', content: '', category: 'announcement', target: 'all' })
    loadNews()
    setSubmitting(false)
  }

  async function deleteNews(id) {
    if (!confirm('Удалить новость?')) return
    await supabase.from('news').delete().eq('id', id)
    setNews(prev => prev.filter(n => n.id !== id))
    showToast('Новость удалена')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'flex-start' }}>
      {/* Publish form */}
      <div style={{ background: '#fff', borderRadius: 3, border: '1px solid var(--bd)', overflow: 'hidden' }}>
        <div style={{ padding: '11px 16px', background: 'var(--navy)', borderBottom: '2px solid var(--red)' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>Новая публикация</span>
        </div>
        <form onSubmit={publish} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={lblStyle}>Заголовок</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Заголовок…" style={inpStyle} /></div>
          <div><label style={lblStyle}>Текст</label><textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required rows={5} placeholder="Текст новости…" style={{ ...inpStyle, resize: 'vertical' }} /></div>
          <div>
            <label style={lblStyle}>Категория</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inpStyle}>
              <option value="announcement">📢 Объявление</option>
              <option value="achievement">🏆 Достижение</option>
              <option value="safety">🛡️ Безопасность</option>
              <option value="general">📌 Общее</option>
            </select>
          </div>
          <div>
            <label style={lblStyle}>Кому отправить</label>
            <select value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} style={inpStyle}>
              <option value="all">📢 Всем сотрудникам</option>
              <option value="dept">📍 По участку</option>
            </select>
          </div>
          {form.target === 'dept' && (
            <div><label style={lblStyle}>Участок</label>
              <select value={targetDept} onChange={e => setTargetDept(e.target.value)} style={inpStyle}>
                <option value="">Выберите участок</option>
                {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          )}
          <button type="submit" disabled={submitting} style={btnStyle}>{submitting ? 'Публикация…' : '📤 Опубликовать и разослать'}</button>
        </form>
      </div>

      {/* News list */}
      <div>
        {loading ? <LoadingDots /> : news.map(n => (
          <div key={n.id} style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 4, padding: 14, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', flex: 1, marginRight: 8 }}>{n.title}</div>
              <button onClick={() => deleteNews(n.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>🗑️</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, marginBottom: 6 }}>{n.content.slice(0, 100)}{n.content.length > 100 ? '…' : ''}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>{fmtDate(n.created_at)} · {n.author}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
export function AdminAchievements({ showToast }) {
  const [achievements, setAchievements] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', description: '', icon: '🏅', points: 10, target_type: 'posts', target: 1 })
  const [adding, setAdding] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('achievements').select('*').order('target')
    setAchievements(data || [])
    setLoading(false)
  }

  async function add(e) {
    e.preventDefault()
    setAdding(true)
    const { error } = await supabase.from('achievements').insert(form)
    if (error) showToast('Ошибка: ' + error.message, 'error')
    else { showToast('✅ Достижение добавлено'); load() }
    setAdding(false)
  }

  async function del(id) {
    if (!confirm('Удалить достижение?')) return
    await supabase.from('achievements').delete().eq('id', id)
    load()
    showToast('Удалено')
  }

  const TARGET_TYPES = { posts: 'Всего заявок', ideas: 'Идей', risks: 'Рисков', likes: 'Лайков получено', points: 'Баллов' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ background: '#fff', borderRadius: 3, border: '1px solid var(--bd)', overflow: 'hidden' }}>
        <div style={{ padding: '11px 16px', background: 'var(--navy)', borderBottom: '2px solid var(--red)' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>Добавить достижение</span>
        </div>
        <form onSubmit={add} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 70 }}><label style={lblStyle}>Иконка</label><input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} style={{ ...inpStyle, textAlign: 'center', fontSize: 20 }} /></div>
            <div style={{ flex: 1 }}><label style={lblStyle}>Название</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required style={inpStyle} /></div>
          </div>
          <div><label style={lblStyle}>Описание</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inpStyle} /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={lblStyle}>Тип условия</label>
              <select value={form.target_type} onChange={e => setForm(f => ({ ...f, target_type: e.target.value }))} style={inpStyle}>
                {Object.entries(TARGET_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ width: 80 }}><label style={lblStyle}>Цель</label><input type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: parseInt(e.target.value) || 1 }))} style={inpStyle} /></div>
            <div style={{ width: 80 }}><label style={lblStyle}>ТОП</label><input type="number" value={form.points} onChange={e => setForm(f => ({ ...f, points: parseInt(e.target.value) || 0 }))} style={inpStyle} /></div>
          </div>
          <button type="submit" disabled={adding} style={btnStyle}>{adding ? 'Добавление…' : '+ Добавить'}</button>
        </form>
      </div>

      <div>
        {loading ? <LoadingDots /> : achievements.map(a => (
          <div key={a.id} style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 4, padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{a.icon || '🏅'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{a.title}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{TARGET_TYPES[a.target_type]} ≥ {a.target} · +{a.points} ТОП</div>
            </div>
            <button onClick={() => del(a.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--bg3)' }}>
      <span style={{ fontSize: 11, color: 'var(--t3)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{value}</span>
    </div>
  )
}

function RoleBadge({ role, labels }) {
  const colors = { admin: '#c42b1c', manager: '#b45309', engineer: '#1d4ed8', master: '#065f46', staff: 'var(--t2)' }
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${colors[role] || 'var(--t3)'}18`, color: colors[role] || 'var(--t2)' }}>{labels[role] || role}</span>
}

const thStyle = { padding: '8px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#e8e7e3', textTransform: 'uppercase', letterSpacing: '.06em', background: 'var(--navy)', borderBottom: '2px solid var(--red)', whiteSpace: 'nowrap', fontFamily: "'Barlow Condensed', sans-serif" }
const tdStyle = { padding: '9px 13px', fontSize: 13, color: 'var(--t2)', borderBottom: '1px solid var(--bg3)', verticalAlign: 'middle' }
const lblStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }
const inpStyle = { width: '100%', padding: '8px 11px', border: '1px solid var(--bd)', borderBottom: '2px solid var(--bd)', borderRadius: 3, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
const btnStyle = { padding: '10px 14px', borderRadius: 3, border: 'none', background: 'linear-gradient(135deg,#f53d2d,#c42b1c)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '.04em', textTransform: 'uppercase' }
