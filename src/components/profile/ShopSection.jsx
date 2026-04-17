import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { notifyRole, notifyUser } from '../../lib/telegram.js'
import LoadingDots from '../common/LoadingDots.jsx'

const STATUS_MAP = {
  pending:    { label: 'Ожидает',     icon: '⏳', color: '#f59e0b', desc: 'Заявка принята, ожидает обработки' },
  processing: { label: 'Готовится',   icon: '🔄', color: '#3b82f6', desc: 'Закупщики обрабатывают вашу заявку' },
  ready:      { label: 'Готово!',     icon: '✅', color: '#22c55e', desc: 'Подарок готов — приходите за ним!' },
  completed:  { label: 'Получено',    icon: '🎉', color: '#8b5cf6', desc: 'Подарок успешно получен' },
  cancelled:  { label: 'Отменено',    icon: '❌', color: '#ef4444', desc: 'Заявка отменена' },
}

const CAT_LABELS = {
  general: 'Все', merch: '👕 Мерч', office: '📎 Канцелярия',
  benefits: '🌟 Привилегии', voucher: '🎟️ Сертификаты', electronics: '📱 Электроника',
}

export default function ShopSection({ user, updateUser, showToast }) {
  const [items, setItems] = useState([])
  const [myOrders, setMyOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('shop') // shop | orders
  const [catFilter, setCatFilter] = useState('general')
  const [confirmItem, setConfirmItem] = useState(null)
  const [ordering, setOrdering] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)

  useEffect(() => { loadAll() }, [])

  // Realtime order updates
  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('shop-rt')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'shop_orders',
        filter: `user_id=eq.${user.empId}`
      }, payload => {
        setMyOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
        const st = STATUS_MAP[payload.new.status]
        if (st) showToast(`${st.icon} Заявка #${payload.new.id}: ${st.label}`)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user?.empId])

  async function loadAll() {
    setLoading(true)
    const [{ data: shopData }, { data: ordersData }] = await Promise.all([
      supabase.from('shop_items').select('*').eq('active', true).order('price'),
      user ? supabase.from('shop_orders').select('*').eq('user_id', user.empId).order('created_at', { ascending: false }) : { data: [] }
    ])
    setItems(shopData || [])
    setMyOrders(ordersData || [])
    setLoading(false)
  }

  async function placeOrder(item) {
    if (!user) return
    if ((user.points || 0) < item.price) {
      showToast(`Недостаточно ТОП! Нужно ${item.price}, у вас ${user.points || 0}`, 'error')
      return
    }
    setOrdering(true)
    try {
      // Deduct points
      const newPoints = (user.points || 0) - item.price
      await supabase.from('users').update({ points: newPoints }).eq('id', user.empId)
      updateUser({ points: newPoints })

      // Create order
      const { data: order, error } = await supabase.from('shop_orders').insert({
        user_id: user.empId,
        item_id: item.id,
        item_name: item.name,
        item_icon: item.icon,
        item_price: item.price,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select().single()

      if (error) throw error

      setMyOrders(prev => [order, ...prev])

      // Notify admins/managers
      await notifyRole(
        supabase,
        ['admin', 'manager'],
        `🎁 Новая заявка на подарок #${order.id}`,
        `${user.name} заказал: ${item.icon} ${item.name} (${item.price} ТОП)`,
        'system'
      )

      showToast(`✅ Заявка оформлена! -${item.price} ТОП`)
      setConfirmItem(null)
      setTab('orders')
    } catch (err) {
      showToast('Ошибка: ' + err.message, 'error')
      // Refund points on error
      updateUser({ points: user.points })
    }
    setOrdering(false)
  }

  const categories = ['general', ...new Set(items.map(i => i.category).filter(Boolean))]
  const filteredItems = catFilter === 'general' ? items : items.filter(i => i.category === catFilter)

  const pendingCount = myOrders.filter(o => ['pending','processing','ready'].includes(o.status)).length

  return (
    <div style={{ paddingBottom: 'calc(74px + env(safe-area-inset-bottom,0px))', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ background: 'var(--navy)', borderBottom: '3px solid var(--red)', paddingTop: 'max(env(safe-area-inset-top,0px),16px)' }}>
        <div style={{ textAlign: 'center', padding: '12px 16px 0', fontSize: 17, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed',sans-serif", color: '#e8e7e3' }}>
          🏪 МАГАЗИН ПОДАРКОВ
        </div>

        {/* Balance */}
        <div style={{ textAlign: 'center', padding: '6px 0 10px' }}>
          <span style={{ fontSize: 13, color: 'rgba(232,231,227,.5)' }}>Ваш баланс: </span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#f53d2d' }}>{user?.points || 0} ТОП</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          {[['shop','🛍️ Магазин'], ['orders',`📦 Мои заявки${pendingCount > 0 ? ` (${pendingCount})` : ''}`]].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '9px 4px', fontSize: 12, fontWeight: 700,
              color: tab === t ? '#fff' : 'rgba(232,231,227,.5)',
              background: 'none', border: 'none',
              borderBottom: `3px solid ${tab === t ? '#f53d2d' : 'transparent'}`,
              cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? <LoadingDots /> : (
        <>
          {/* ── SHOP TAB ── */}
          {tab === 'shop' && (
            <div>
              {/* Category filter */}
              <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 12px', borderBottom: '1px solid var(--bd)' }}>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setCatFilter(cat)} style={{
                    flexShrink: 0, padding: '5px 12px', borderRadius: 20,
                    border: `1.5px solid ${catFilter === cat ? 'var(--red)' : 'var(--bd)'}`,
                    background: catFilter === cat ? 'rgba(245,61,45,.1)' : 'var(--bg3)',
                    color: catFilter === cat ? 'var(--red)' : 'var(--t2)',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>{CAT_LABELS[cat] || cat}</button>
                ))}
              </div>

              {/* Items grid */}
              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {filteredItems.map(item => {
                  const canAfford = (user?.points || 0) >= item.price
                  return (
                    <div key={item.id} style={{
                      background: 'var(--bg2)', borderRadius: 12,
                      border: '1px solid var(--bd)',
                      overflow: 'hidden', display: 'flex', flexDirection: 'column',
                      boxShadow: 'var(--shadow)', transition: 'transform .2s',
                    }}
                      onMouseOver={e => e.currentTarget.style.transform = 'scale(1.01)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {/* Image or icon */}
                      <div style={{
                        height: 90, background: canAfford
                          ? 'linear-gradient(135deg,rgba(245,61,45,.08),rgba(196,43,28,.04))'
                          : 'var(--bg3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 44, position: 'relative',
                      }}>
                        {item.image
                          ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : item.icon
                        }
                        {!canAfford && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px 12px 0 0' }}>
                            <span style={{ fontSize: 24 }}>🔒</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: '10px 10px 8px', flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.3, marginBottom: 4 }}>{item.name}</div>
                        {item.description && (
                          <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.4, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {item.description}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: canAfford ? '#f53d2d' : 'var(--t4)' }}>
                            {item.price} ТОП
                          </span>
                          {item.stock === 0 && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,.1)', padding: '2px 6px', borderRadius: 4 }}>НЕТ</span>
                          )}
                        </div>
                      </div>

                      {/* Button */}
                      <button
                        onClick={() => canAfford && item.stock !== 0 && setConfirmItem(item)}
                        disabled={!canAfford || item.stock === 0}
                        style={{
                          margin: '0 10px 10px',
                          padding: '9px',
                          borderRadius: 8, border: 'none',
                          background: canAfford && item.stock !== 0
                            ? 'linear-gradient(135deg,#f53d2d,#c42b1c)'
                            : 'var(--bd)',
                          color: canAfford && item.stock !== 0 ? '#fff' : 'var(--t4)',
                          fontSize: 12, fontWeight: 700, cursor: canAfford && item.stock !== 0 ? 'pointer' : 'not-allowed',
                          fontFamily: "'Barlow Condensed',sans-serif",
                          letterSpacing: '.04em', textTransform: 'uppercase',
                          transition: '.2s',
                        }}
                      >
                        {item.stock === 0 ? 'Нет в наличии' : !canAfford ? `Нужно ещё ${item.price - (user?.points||0)}` : 'Получить 🎁'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── ORDERS TAB ── */}
          {tab === 'orders' && (
            <div style={{ padding: 12 }}>
              {myOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t3)' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Заявок пока нет</div>
                  <div style={{ fontSize: 12, marginTop: 4, color: 'var(--t4)' }}>Выберите подарок в магазине!</div>
                </div>
              ) : myOrders.map(order => {
                const st = STATUS_MAP[order.status] || STATUS_MAP.pending
                return (
                  <div key={order.id} onClick={() => setSelectedOrder(order)}
                    style={{
                      background: 'var(--bg2)', borderRadius: 12, marginBottom: 10,
                      border: '1px solid var(--bd)', overflow: 'hidden',
                      borderLeft: `4px solid ${st.color}`, cursor: 'pointer',
                    }}>
                    {/* Status banner for active orders */}
                    {['pending','processing','ready'].includes(order.status) && (
                      <div style={{ background: `${st.color}15`, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{st.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                        {order.status === 'ready' && <span style={{ fontSize: 11, color: st.color, marginLeft: 4 }}>— Приходите забирать!</span>}
                      </div>
                    )}

                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 36, flexShrink: 0 }}>{order.item_icon || '🎁'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{order.item_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                          Заявка #{order.id} · {new Date(order.created_at).toLocaleDateString('ru',{day:'2-digit',month:'2-digit',year:'2-digit'})}
                        </div>
                        {order.admin_comment && (
                          <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4, background: 'var(--bg3)', padding: '4px 8px', borderRadius: 6 }}>
                            💬 {order.admin_comment}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--red)' }}>{order.item_price} ТОП</div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: `${st.color}18`, color: st.color }}>
                          {st.label}
                        </span>
                      </div>
                    </div>

                    {/* Progress steps */}
                    <OrderProgress status={order.status} />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Confirm modal */}
      {confirmItem && (
        <ConfirmModal
          item={confirmItem}
          user={user}
          ordering={ordering}
          onConfirm={() => placeOrder(confirmItem)}
          onClose={() => setConfirmItem(null)}
        />
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  )
}

// ── ORDER PROGRESS STEPPER ────────────────────────────────────────────────────
function OrderProgress({ status }) {
  const steps = [
    { key: 'pending',    label: 'Принято' },
    { key: 'processing', label: 'Готовится' },
    { key: 'ready',      label: 'Готово' },
    { key: 'completed',  label: 'Получено' },
  ]
  if (status === 'cancelled') return null
  const activeIdx = steps.findIndex(s => s.key === status)

  return (
    <div style={{ padding: '8px 14px 12px', display: 'flex', alignItems: 'center' }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: i <= activeIdx ? STATUS_MAP[s.key]?.color || '#f53d2d' : 'var(--bd)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: '#fff', fontWeight: 700,
              border: i === activeIdx ? `3px solid ${STATUS_MAP[s.key]?.color || '#f53d2d'}` : 'none',
              transition: '.3s',
            }}>
              {i < activeIdx ? '✓' : i + 1}
            </div>
            <div style={{ fontSize: 9, color: i <= activeIdx ? 'var(--t2)' : 'var(--t4)', marginTop: 3, textAlign: 'center', fontWeight: i === activeIdx ? 700 : 400 }}>
              {s.label}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < activeIdx ? '#f53d2d' : 'var(--bd)', transition: '.3s', marginTop: -12 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── CONFIRM MODAL ─────────────────────────────────────────────────────────────
function ConfirmModal({ item, user, ordering, onConfirm, onClose }) {
  const after = (user?.points || 0) - item.price
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="slide-up" style={{ background: 'var(--bg2)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 440, padding: 24, borderTop: '3px solid var(--red)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>{item.icon}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>{item.name}</div>
          {item.description && <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 6 }}>{item.description}</div>}
        </div>

        <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--t2)' }}>Стоимость</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#f53d2d' }}>-{item.price} ТОП</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--t2)' }}>Ваш баланс</span>
            <span style={{ fontSize: 13, color: 'var(--t2)' }}>{user?.points || 0} ТОП</span>
          </div>
          <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Остаток</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: after >= 0 ? 'var(--t1)' : '#ef4444' }}>{after} ТОП</span>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', marginBottom: 16 }}>
          После подтверждения заявка уйдёт на обработку.<br />Мы уведомим вас когда подарок будет готов!
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--t2)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
          <button onClick={onConfirm} disabled={ordering} style={{
            flex: 2, padding: 13, borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#f53d2d,#c42b1c)',
            color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
            opacity: ordering ? .6 : 1, fontFamily: "'Barlow Condensed',sans-serif",
            letterSpacing: '.06em', textTransform: 'uppercase',
            boxShadow: '0 4px 14px rgba(245,61,45,.35)',
          }}>
            {ordering ? '⏳ Оформление…' : '🎁 Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ORDER DETAIL MODAL ────────────────────────────────────────────────────────
function OrderDetailModal({ order, onClose }) {
  const st = STATUS_MAP[order.status] || STATUS_MAP.pending
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="slide-up" style={{ background: 'var(--bg2)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 440, borderTop: '3px solid var(--red)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#e8e7e3', fontFamily: "'Barlow Condensed',sans-serif" }}>ЗАЯВКА #{order.id}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(232,231,227,.7)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 52 }}>{order.item_icon || '🎁'}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{order.item_name}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f53d2d', marginTop: 2 }}>{order.item_price} ТОП</div>
            </div>
          </div>

          {/* Status */}
          <div style={{ background: `${st.color}10`, border: `1px solid ${st.color}30`, borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{st.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: st.color }}>{st.label}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{st.desc}</div>
            </div>
          </div>

          {order.admin_comment && (
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 4 }}>Комментарий</div>
              <div style={{ fontSize: 13, color: 'var(--t2)' }}>{order.admin_comment}</div>
            </div>
          )}

          <OrderProgress status={order.status} />

          <div style={{ fontSize: 11, color: 'var(--t4)', textAlign: 'center', marginTop: 8 }}>
            Оформлено: {new Date(order.created_at).toLocaleString('ru',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
      </div>
    </div>
  )
}
