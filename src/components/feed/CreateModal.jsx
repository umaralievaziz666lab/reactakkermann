import React, { useState, useEffect } from 'react'
import { supabase, POINTS } from '../../lib/supabase.js'
import { notifyRole } from '../../lib/telegram.js'

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

  useEffect(() => { loadDepts() }, [])

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
        const path = `requests/${user.empId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { data: upData, error: upErr } = await supabase.storage.from('media').upload(path, f)
        if (!upErr && upData) {
          const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
          mediaUrls.push(publicUrl)
        }
      }

      const { data, error } = await supabase.from('requests').insert({
        type, description: description.trim(), location,
        author: anon ? 'Аноним' : user.name,
        author_id: anon ? null : user.empId,
        anonymous: anon, status: 'new', likes: 0, comments: 0,
        risk_urgency: type === 'risk' ? urgency : null,
        risk_event_type: type === 'risk' ? riskType : null,
        media: mediaUrls.length > 0 ? mediaUrls : null,
        date: new Date().toISOString(),
      }).select().single()

      if (error) throw error

      // Award points
      const pts = type === 'risk' ? (urgency === 1 ? POINTS.risk1 : POINTS.risk) : POINTS.idea
      await supabase.from('users').update({ points: (user.points || 0) + pts }).eq('id', user.empId)

      // 🔔 Telegram уведомления для Уровень 1
      if (type === 'risk' && urgency === 1) {
        await notifyRole(
          supabase,
          ['admin', 'manager'],
          '🚨 КРИТИЧЕСКИЙ РИСК УРОВЕНЬ 1!',
          `Участок: ${location}\n${description.trim().slice(0, 150)}`,
          'risk1'
        )
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
      reader.onload = ev => setPreviews(prev => [...prev, { src: ev.target.result, name: f.name }])
      reader.readAsDataURL(f)
    }
  }

  function removeFile(i) {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  const parents = depts.filter(d => !d.parent_id)
  const children = depts.filter(d => d.parent_id)

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div className="slide-up" style={{ background:'var(--bg2)', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:500, maxHeight:'92vh', display:'flex', flexDirection:'column', borderTop:'3px solid var(--red)', overflow:'hidden' }}>

        <div style={{ padding:'14px 16px', borderBottom:'2px solid var(--bd)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--navy)', flexShrink:0 }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff', fontFamily:"'Barlow Condensed',sans-serif" }}>НОВАЯ ЗАПИСЬ</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'rgba(232,231,227,0.7)', cursor:'pointer' }}>×</button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:16 }}>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Type selector */}
            <div>
              <Label>Тип записи</Label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { v:'idea', icon:'💡', label:'Идея', color:'#22c55e' },
                  { v:'risk', icon:'⚠️', label:'Риск', color:'#ef4444' },
                ].map(({ v, icon, label, color }) => (
                  <div key={v} onClick={() => setType(v)} style={{
                    padding:12, borderRadius:12, cursor:'pointer', textAlign:'center', transition:'.2s',
                    border:`2px solid ${type===v ? color : 'var(--bd)'}`,
                    background: type===v ? `${color}12` : 'var(--bg3)',
                  }}>
                    <div style={{ fontSize:28, marginBottom:4 }}>{icon}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk fields */}
            {type === 'risk' && (
              <>
                <div>
                  <Label>Тип события</Label>
                  <select value={riskType} onChange={e => setRiskType(e.target.value)} style={inpStyle}>
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
                    { v:1, icon:'🔴', title:'Уровень 1 — ОПАСНО СЕЙЧАС', desc:'Риск немедленной травмы · реакция ≤ 2 часа', color:'#dc2626', border:'#fecaca' },
                    { v:2, icon:'🟡', title:'Уровень 2 — МОЖЕТ ПРИВЕСТИ К ТРАВМЕ', desc:'Потенциально опасно · реакция ≤ 1 рабочий день', color:'#d97706', border:'#fed7aa' },
                    { v:3, icon:'🟢', title:'Уровень 3 — ЗАМЕЧАНИЕ', desc:'Улучшение условий труда · реакция ≤ 2 рабочих дня', color:'#16a34a', border:'#bbf7d0' },
                  ].map(({ v, icon, title, desc, color, border }) => (
                    <div key={v} onClick={() => setUrgency(v)} style={{
                      padding:'10px 12px', borderRadius:10, cursor:'pointer', marginBottom:6, transition:'.2s',
                      border:`2px solid ${urgency===v ? color : border}`,
                      background: urgency===v ? `${color}10` : 'transparent',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:20 }}>{icon}</span>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color }}>{title}</div>
                          <div style={{ fontSize:10, color:'#6b7280' }}>{desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--t2)', cursor:'pointer', padding:10, background:'var(--bg3)', borderRadius:10 }}>
                  <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} style={{ width:16, height:16 }} />
                  🎭 Отправить анонимно
                </label>
              </>
            )}

            {/* Location */}
            <div>
              <Label>Участок</Label>
              <select value={location} onChange={e => setLocation(e.target.value)} required style={inpStyle}>
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
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                placeholder="Опишите суть идеи или риска…" required style={{ ...inpStyle, resize:'none' }} />
              <div style={{ fontSize:10, color:'var(--t4)', marginTop:3, textAlign:'right' }}>{description.length} символов</div>
            </div>

            {/* Media */}
            <div>
              <Label>Фото / Видео (до 5)</Label>
              <label style={{ display:'block', padding:'12px', border:'2px dashed var(--bd)', borderRadius:10, textAlign:'center', cursor:'pointer', background:'var(--bg3)', transition:'.2s' }}
                onMouseOver={e => e.currentTarget.style.borderColor='var(--red)'}
                onMouseOut={e => e.currentTarget.style.borderColor='var(--bd)'}>
                <div style={{ fontSize:24, marginBottom:4 }}>📎</div>
                <div style={{ fontSize:12, color:'var(--t3)' }}>Нажмите или перетащите файлы</div>
                <input type="file" accept="image/*,video/*" multiple onChange={handleFiles} style={{ display:'none' }} />
              </label>

              {previews.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                  {previews.map((p, i) => (
                    <div key={i} style={{ position:'relative' }}>
                      <img src={p.src} style={{ width:70, height:70, objectFit:'cover', borderRadius:8, border:'1px solid var(--bd)', display:'block' }} />
                      <button onClick={() => removeFile(i)} style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'#ef4444', border:'2px solid var(--bg2)', color:'#fff', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={submitting} style={{
              width:'100%', padding:13, borderRadius:10, border:'none',
              background:'linear-gradient(135deg,#f53d2d,#c42b1c)', color:'#fff',
              fontSize:15, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase',
              fontFamily:"'Barlow Condensed',sans-serif", cursor:submitting?'not-allowed':'pointer',
              opacity:submitting?.6:1, boxShadow:'0 4px 14px rgba(245,61,45,.35)',
              transition:'.2s',
            }}>
              {submitting ? '⏳ Публикация…' : '🚀 Опубликовать'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function Label({ children }) {
  return <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>{children}</label>
}

const inpStyle = {
  width:'100%', padding:'11px 14px',
  border:'1.5px solid var(--bd)', borderRadius:10,
  background:'var(--bg3)', color:'var(--t1)',
  fontSize:14, outline:'none', fontFamily:'inherit',
  transition:'border-color .2s',
}
