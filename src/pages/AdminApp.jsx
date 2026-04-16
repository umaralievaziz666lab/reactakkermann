import React, { useState, useEffect } from 'react'
import { supabase, store } from '../lib/supabase.js'
import AdminLayout from '../components/admin/AdminLayout.jsx'

export default function AdminApp() {
  const [empId, setEmpId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminUser, setAdminUser] = useState(null)

  useEffect(() => {
    const cached = store.get('admin_u')
    if (cached) {
      try {
        const u = JSON.parse(cached)
        if (u?.role && ['admin','manager','engineer'].includes(u.role)) {
          setAdminUser(u)
        }
      } catch {}
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', empId)
      .single()

    if (!data) {
      setError('Пользователь не найден')
      setLoading(false)
      return
    }

    if (!['admin','manager','engineer'].includes(data.role)) {
      setError('Недостаточно прав доступа')
      setLoading(false)
      return
    }

    store.set('admin_u', JSON.stringify(data))
    setAdminUser(data)
    setLoading(false)
  }

  if (adminUser) {
    return (
      <AdminLayout
        adminUser={adminUser}
        onLogout={() => {
          store.del('admin_u')
          setAdminUser(null)
        }}
      />
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,rgba(245,61,45,.07),rgba(196,43,28,.07))',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 40,
        width: '100%', maxWidth: 360,
        boxShadow: '0 20px 60px rgba(245,61,45,.15)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 6,
            background: '#f53d2d',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, margin: '0 auto 12px'
          }}>⚙️</div>
          <div style={{
            fontSize: 17, fontWeight: 800,
            background: 'linear-gradient(135deg,#f53d2d,#c42b1c)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>AKKERMANN PULSE</div>
          <div style={{
            fontSize: 12, color: '#5a7080', marginTop: 3,
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: '.06em', textTransform: 'uppercase'
          }}>ПАНЕЛЬ АДМИНИСТРАТОРА</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{
              fontSize: 11, fontWeight: 700, color: '#5a7080',
              textTransform: 'uppercase', letterSpacing: '.05em',
              display: 'block', marginBottom: 4
            }}>Табельный номер</label>
            <input
              value={empId}
              onChange={e => setEmpId(e.target.value)}
              required
              placeholder="Введите табельный номер"
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid #d1cfc9',
                borderBottom: '2px solid #d1cfc9',
                borderRadius: 3, fontSize: 14, outline: 'none',
                background: '#f2f1ee', color: '#0f1c2c',
              }}
            />
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: 12, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: 12, borderRadius: 3, border: 'none',
              background: 'linear-gradient(135deg,#f53d2d,#c42b1c)',
              color: '#fff', fontSize: 14, fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? .7 : 1,
              letterSpacing: '.08em',
              fontFamily: "'Barlow Condensed', sans-serif",
              textTransform: 'uppercase',
            }}
          >
            {loading ? 'ПРОВЕРКА…' : 'ВОЙТИ →'}
          </button>
        </form>
      </div>
    </div>
  )
}
