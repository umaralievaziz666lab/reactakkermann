import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function Registration({ onRegister }) {
  const [form, setForm] = useState({ name: '', empId: '', phone: '', email: '', department: '', refCode: '' })
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tgUser, setTgUser] = useState(null)

  useEffect(() => {
    loadDepts()
    const tg = window.Telegram?.WebApp
    if (tg?.initDataUnsafe?.user) {
      setTgUser(tg.initDataUnsafe.user)
      const u = tg.initDataUnsafe.user
      if (u.first_name || u.last_name) {
        setForm(f => ({ ...f, name: [u.first_name, u.last_name].filter(Boolean).join(' ') }))
      }
    }
  }, [])

  async function loadDepts() {
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepts(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.empId || !form.department) {
      setError('Заполните обязательные поля')
      return
    }
    setLoading(true)
    setError('')
    try {
      // Check if empId already exists
      const { data: existing } = await supabase.from('users').select('id').eq('id', form.empId).single()
      if (existing) {
        setError('Этот табельный номер уже зарегистрирован')
        setLoading(false)
        return
      }
      await onRegister(form)
    } catch (err) {
      setError(err.message || 'Ошибка регистрации')
    }
    setLoading(false)
  }

  // Build department options grouped by parent
  const parents = depts.filter(d => !d.parent_id)
  const children = depts.filter(d => d.parent_id)

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, overflowY: 'auto',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--bg2)',
        borderRadius: 6, padding: '28px 24px',
        boxShadow: '0 8px 40px rgba(0,0,0,.2)',
        borderTop: '4px solid var(--red)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 8,
            background: 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, margin: '0 auto 12px',
          }}>🚀</div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: 'var(--t1)',
            fontFamily: "'Barlow Condensed', sans-serif",
            textTransform: 'uppercase', letterSpacing: '.05em',
          }}>ДОБРО ПОЖАЛОВАТЬ!</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif" }}>
            Система безопасности Akkermann
          </div>
        </div>

        {tgUser && (
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
            padding: '10px 12px', fontSize: 12, color: '#1e40af',
            marginBottom: 14, textAlign: 'center',
          }}>✅ Данные Telegram получены</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="ФИО *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Иванов Иван Иванович" />
          <Field label="Табельный номер *" value={form.empId} onChange={v => setForm(f => ({ ...f, empId: v }))} placeholder="12345" />
          <Field label="Телефон" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+998 XX XXX XX XX" type="tel" />
          <Field label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="user@example.com" type="email" />

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Участок *</label>
            <select
              value={form.department}
              onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              required
              style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--bd)', borderBottom: '2px solid var(--bd)', borderRadius: 4, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 14, outline: 'none' }}
            >
              <option value="">Выберите участок</option>
              {parents.map(p => (
                <optgroup key={p.id} label={p.name}>
                  <option value={p.name}>{p.name}</option>
                  {children.filter(c => c.parent_id === p.id).map(c => (
                    <option key={c.id} value={c.name}>└ {c.name}</option>
                  ))}
                </optgroup>
              ))}
              {depts.length === 0 && <option disabled>Загрузка…</option>}
            </select>
          </div>

          <Field label="Реферальный код (необязательно)" value={form.refCode}
            onChange={v => setForm(f => ({ ...f, refCode: v.toUpperCase() }))} placeholder="REF_12345" />

          {error && <div style={{ color: '#ef4444', fontSize: 12, textAlign: 'center' }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: 13, borderRadius: 4, border: 'none',
              background: 'linear-gradient(135deg,#f53d2d,#c42b1c)',
              color: '#fff', fontSize: 14, fontWeight: 800,
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: '.08em', textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? .6 : 1, marginTop: 4,
            }}
          >
            {loading ? 'Регистрация…' : 'Начать работу'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder} required={label.includes('*')}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--bd)', borderBottom: '2px solid var(--bd)', borderRadius: 4, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
        onFocus={e => e.target.style.borderColor = 'var(--red)'}
        onBlur={e => e.target.style.borderColor = 'var(--bd)'}
      />
    </div>
  )
}
