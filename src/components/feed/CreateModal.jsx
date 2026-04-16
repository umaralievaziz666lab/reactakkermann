import React, { useState, useEffect } from 'react'
import { supabase, POINTS } from '../../lib/supabase.js'

export default function CreateModal({ user, onClose, onSuccess, showToast }) {
  const [type, setType] = useState('idea')
  const [riskType, setRiskType] = useState('')
  const [urgency, setUrgency] = useState(null)
  const [anon, setAnon] = useState(false)
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [depts, setDepts] = useState([])

  useEffect(() => {
    loadDepts()
  }, [])

  async function loadDepts() {
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepts(data || [])
    if (user?.department) setLocation(user.department)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!description.trim()) { showToast('Заполните описание', 'error'); return }
    if (!location) { showToast('Выберите участок', 'error'); return }
    if (type === 'risk' && !urgency) { showToast('Выберите уровень срочности', 'error'); return }
    setSubmitting(true)

    try {
      // Upload media
      const mediaUrls = []
      for (const f of files) {
        const ext = f.name.split('.').pop()
        const path = `${user.empId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { data: upData, error: upErr } = await supabase.storage.from('media').upload(path, f)
        if (!upErr && upData) {
          const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
          mediaUrls.push(publicUrl)
        }
      }

      const { data, error } = await supabase.from('requests').insert({
        type,
        description: description.trim(),
        location,
        author: anon ? 'Аноним' : user.name,
        author_id: anon ? null : user.empId,
        anonymous: anon,
        status: 'new',
        likes: 0,
        comments: 0,
        risk_urgency: type === 'risk' ? urgency : null,
        risk_event_type: type === 'risk' ? riskType : null,
        media: mediaUrls.length > 0 ? mediaUrls : null,
        date: new Date().toISOString(),
      }).select().single()

      if (error) throw error

      // Award points
      const pts = type === 'risk' ? (urgency === 1 ? POINTS.risk1 : POINTS.risk) : POINTS.idea
      await supabase.from('users').update({ points: (user.points || 0) + pts }).eq('id', user.empId)

      // Notify admins for level 1 risks
      if (type === 'risk' && urgency === 1) {
        const { data: admins } = await supabase.from('users').select('id').in('role', ['admin', 'manager'])
        for (const admin of admins || []) {
          await supabase.from('notifications').insert({
            user_id: admin.id, title: '🚨 РИСК УРОВЕНЬ 1!',
            message: `${location}: ${description.trim().slice(0, 80)}`,
            post_id: data.id, type: 'risk1', read: false, date: new Date().toISOString()
          })
        }
      }

      onSuccess(`✅ Опубликовано! +${pts} ТОП`)
    } catch (err) {
      showToast('Ошибка: ' + err.message, 'error')
    }
    setSubmitting(false)
  }

  function handleFiles(e) {
    const newFiles = Array.from(e.target.files).slice(0, 5 - files.length)
    setFiles(prev => [...prev, ...newFiles].slice(0, 5))
    for (const f of newFiles) {
      const reader = new FileReader()
      reader.onload = ev => setPreviews(prev => [...prev, ev.target.result])
      reader.readAsDataURL(f)
    }
  }

  const parents = depts.filter(d => !d.parent_id)
  const children = depts.filter(d => d.parent_id)

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 100,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div className="slide-up" style={{
        background: 'var(--bg2)', borderRadius: '16px 16px 0 0',
        width: '100%', maxWidth: 500, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        borderTop: '3px solid var(--red)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '2px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--navy)', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }}>НОВАЯ ЗАПИСЬ</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'rgba(232,231,227,0.7)', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Type selector */}
            <div>
              <Label>Тип записи</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { v: 'idea', icon: '💡', label: 'Идея', borderColor: '#34d399' },
                  { v: 'risk', icon: '⚠️', label: 'Риск', borderColor: 'var(--bd)' },
                ].map(({ v, icon, label, borderColor }) => (
                  <div key={v} onClick={() => setType(v)} style={{
                    padding: 12, borderRadius: 12,
                    border: `2px solid ${type === v ? (v === 'idea' ? '#34d399' : 'var(--red)') : 'var(--bd)'}`,
                    background: type === v ? (v === 'idea' ? 'rgba(52,211,153,.08)' : 'rgba(245,61,45,.08)') : 'var(--bg3)',
                    textAlign: 'center', cursor: 'pointer', transition: '.2s',
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk extra fields */}
            {type === 'risk' && (
              <>
                <div>
                  <Label>Тип события</Label>
                  <select value={riskType} onChange={e => setRiskType(e.target.value)} style={inputStyle}>
                    <option value="">Выберите тип</option>
                    <option value="unsafe_conditions">⚠️ Небезопасные условия</option>
                    <option value="unsafe_behavior">🚶 Небезопасные действия</option>
                    <option value="near_miss">💥 Near miss (почти НС)</option>
                    <option value="microtrauma">🩹 Микротравма</option>
                  </select>
                </div>

                <div>
                  <Label>Уровень срочности</Label>
                  {[
                    { v: 1, icon: '🔴', title: 'Уровень 1 — ОПАСНО СЕЙЧАС', desc: 'Риск немедленной травмы · реакция ≤ 2 часа', border: '#fecaca', bg: 'rgba(239,68,68,.06)', titleColor: '#dc2626' },
                    { v: 2, icon: '🟡', title: 'Уровень 2 — МОЖЕТ ПРИВЕСТИ К ТРАВМЕ', desc: 'Потенциально опасно · реакция ≤ 1 рабочий день', border: '#fed7aa', bg: 'rgba(245,158,11,.06)', titleColor: '#d97706' },
                    { v: 3, icon: '🟢', title: 'Уровень 3 — ЗАМЕЧАНИЕ / УЛУЧШЕНИЕ', desc: 'Улучшение условий труда · реакция ≤ 2 рабочих дня', border: '#bbf7d0', bg: 'rgba(16,185,129,.06)', titleColor: '#059669' },
                  ].map(({ v, icon, title, desc, border, bg, titleColor }) => (
                    <div key={v} onClick={() => setUrgency(v)} style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 6,
                      border: `2px solid ${urgency === v ? titleColor : border}`,
                      background: urgency === v ? bg : 'transparent', transition: '.2s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: titleColor }}>{title}</div>
                          <div style={{ fontSize: 10, color: '#6b7280' }}>{desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t2)', cursor: 'pointer', padding: 8, background: 'var(--bg3)', borderRadius: 8 }}>
                  <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} />
                  🎭 Отправить анонимно
                </label>
              </>
            )}

            {/* Location */}
            <div>
              <Label>Участок</Label>
              <select value={location} onChange={e => setLocation(e.target.value)} required style={inputStyle}>
                <option value="">Выберите участок</option>
                {parents.map(p => (
                  <optgroup key={p.id} label={p.name}>
                    <option value={p.name}>{p.name}</option>
                    {children.filter(c => c.parent_id === p.id).map(c => (
                      <option key={c.id} value={c.name}>└ {c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <Label>Описание</Label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="Опишите суть идеи или риска…"
                required
                style={{ ...inputStyle, resize: 'none' }}
              />
            </div>

            {/* Media */}
            <div>
              <Label>Фото / Видео (до 5)</Label>
              <input type="file" accept="image/*,video/*" multiple onChange={handleFiles} style={{ ...inputStyle, padding: 8 }} />
              {previews.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {previews.map((src, i) => (
                    <img key={i} src={src} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)' }} />
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: 13, borderRadius: 4, border: 'none',
                background: 'var(--red)', color: '#fff',
                fontSize: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
                fontFamily: "'Barlow Condensed', sans-serif",
                cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? .6 : 1,
              }}
            >
              {submitting ? 'Публикация…' : 'Опубликовать'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function Label({ children }) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{children}</label>
}

const inputStyle = {
  width: '100%', padding: '11px 14px',
  border: '1px solid var(--bd)', borderBottom: '2px solid var(--bd)',
  borderRadius: 4, background: 'var(--bg3)',
  color: 'var(--t1)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
}
