import React, { useState, useEffect } from 'react'
import { supabase, store } from '../lib/supabase.js'
import AdminLayout from '../components/admin/AdminLayout.jsx'

export default function AdminApp() {
  const [authStep, setAuthStep] = useState('id') // id | 2fa | app
  const [empId, setEmpId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminUser, setAdminUser] = useState(null)
  const [expectedCode, setExpectedCode] = useState(null)

  useEffect(() => {
    const cached = store.get('admin_u')
    if (cached) {
      try {
        const u = JSON.parse(cached)
        if (u?.role && ['admin','manager'].includes(u.role)) {
          setAdminUser(u)
          setAuthStep('app')
        }
      } catch {}
    }
  }, [])

  async function handleIdSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { data } = await supabase.from('users').select('*').eq('id', empId).single()
    if (!data) { setError('Пользователь не найден'); setLoading(false); return }
    if (!['admin','manager','engineer'].includes(data.role)) {
      setError('Недостаточно прав доступа')
      setLoading(false); return
    }
    // Generate 2FA code
    const code6 = String(Math.floor(100000 + Math.random() * 900000))
    setExpectedCode(code6)
    // Send via Telegram bot (or store in DB)
    await supabase.from('users').update({ two_fa_code: code6, two_fa_expires: new Date(Date.now() + 5 * 60000).toISOString() }).eq('id', data.id)
    // If user has telegram_id, send via Edge Function
    if (data.telegram_id) {
      try {
        await supabase.functions.invoke('send-code', { body: { telegram_id: data.telegram_id, code: code6 } })
      } catch {}
    }
    setAdminUser(data)
    setAuthStep('2fa')
    setLoading(false)
  }

  async function handleVerify() {
    setError(''); setLoading(true)
    // Verify against DB
    const { data } = await supabase.from('users').select('two_fa_code,two_fa_expires').eq('id', adminUser.id).single()
    const now = new Date()
    if (data?.two_fa_code === code && new Date(data.two_fa_expires) > now) {
      // Clear code
      await supabase.from('users').update({ two_fa_code: null, two_fa_expires: null }).eq('id', adminUser.id)
      store.set('admin_u', JSON.stringify(adminUser))
      setAuthStep('app')
    } else if (code === expectedCode) {
      // Fallback: accept locally generated code
      store.set('admin_u', JSON.stringify(adminUser))
      setAuthStep('app')
    } else {
      setError('Неверный код или срок истёк')
    }
    setLoading(false)
  }

  if (authStep === 'app' && adminUser) {
    return <AdminLayout adminUser={adminUser} onLogout={() => { store.del('admin_u'); setAuthStep('id'); setAdminUser(null) }} />
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg,rgba(245,61,45,.07),rgba(196,43,28,.07))',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 40, width: '100%', maxWidth: 360,
        boxShadow: '0 20px 60px rgba(245,61,45,.15)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 54, height: 54, borderRadius: 6, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px' }}>
            <svg width="28" height="28" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" strokeWidth="1.5"/></svg>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, background: 'linear-gradient(135deg,#f53d2d,#c42b1c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AKKERMANN PULSE</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '.06em', textTransform: 'uppercase' }}>ПАНЕЛЬ АДМИНИСТРАТОРА</div>
        </div>

        {authStep === 'id' && (
          <form onSubmit={handleIdSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Табельный номер</label>
              <input value={empId} onChange={e => setEmpId(e.target.value)} required placeholder="11111"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--bd)', borderBottom: '2px solid var(--bd)', borderRadius: 3, background: '#f9f9f9', fontSize: 14, outline: 'none' }} />
            </div>
            {error && <div style={{ color: '#ef4444', fontSize: 12, textAlign: 'center' }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 12, borderRadius: 3, border: 'none', background: 'linear-gradient(135deg,#f53d2d,#c42b1c)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: loading ? .7 : 1, letterSpacing: '.08em', fontFamily: "'Barlow Condensed', sans-serif', textTransform: 'uppercase'" }}>
              {loading ? 'ПРОВЕРКА…' : 'ДАЛЕЕ →'}
            </button>
          </form>
        )}

        {authStep === '2fa' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>📱</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Код отправлен в Telegram</div>
              <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 4 }}>Проверьте бот <strong>@AkkermannPulseBot</strong></div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Введите 6-значный код</label>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,''))} maxLength={6} placeholder="000000"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--bd)', borderRadius: 3, fontSize: 22, letterSpacing: '.3em', textAlign: 'center', outline: 'none', fontFamily: 'monospace' }} />
            </div>
            {error && <div style={{ color: '#ef4444', fontSize: 12, textAlign: 'center' }}>{error}</div>}
            <button onClick={handleVerify} disabled={loading || code.length < 6}
              style={{ width: '100%', padding: 12, borderRadius: 3, border: 'none', background: 'linear-gradient(135deg,#f53d2d,#c42b1c)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: (loading || code.length < 6) ? .6 : 1 }}>
              ✅ ПОДТВЕРДИТЬ
            </button>
            <button onClick={() => { setAuthStep('id'); setCode(''); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 12, cursor: 'pointer', textAlign: 'center' }}>
              ← Назад
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
