import React, { useState, useEffect } from 'react'
import { supabase, fmtDate } from '../../lib/supabase.js'
import { notifyUser } from '../../lib/telegram.js'
import LoadingDots from '../common/LoadingDots.jsx'
import { Pagination } from './AdminUsers.jsx'

const STATUS_MAP = {
  pending:    { label: 'Ожидает',   color: '#f59e0b', icon: '⏳' },
  processing: { label: 'Готовится', color: '#3b82f6', icon: '🔄' },
  ready:      { label: 'Готово!',   color: '#22c55e', icon: '✅' },
  completed:  { label: 'Получено',  color: '#8b5cf6', icon: '🎉' },
  cancelled:  { label: 'Отменено',  color: '#ef4444', icon: '❌' },
}

const PAGE_SIZE = 15

export default function AdminShop({ adminUser, showToast }) {
  const [tab, setTab] = useState('orders') // orders | items
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([])
  const [users, setUsers] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editStatus, setEditStatus] = useState('')
  const [editComment, setEditComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  // Item form
  const [showItemForm, setShowItemForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [itemForm, setItemForm] = useState({ name:'', description:'', icon:'🎁', price:100, stock:-1, category:'general', active:true })
  const [savingItem, setSavingItem] = useState(false)

  useEffect(() => { loadAll() }, [])

  // Realtime new orders
  useEffect(() => {
    const ch = supabase.channel('admin-shop-rt')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'shop_orders' }, payload => {
        setOrders(prev => [payload.new, ...prev])
        showToast(`🎁 Новая заявка #${payload.new.id}: ${payload.new.item_name}`)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: ord }, { data: itm }, { data: usr }] = await Promise.all([
      supabase.from('shop_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('shop_items').select('*').order('price'),
      supabase.from('users').select('id,name,department,phone,telegram_username'),
    ])
    setOrders(ord || [])
    setItems(itm || [])
    const umap = {}
    ;(usr || []).forEach(u => { umap[u.id] = u })
    setUsers(umap)
    setLoading(false)
  }

  async function updateOrder() {
    if (!selected) return
    setSaving(true)
    const updates = {
      status: editStatus,
      admin_comment: editComment || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('shop_orders').update(updates).eq('id', selected.id)
    if (error) { showToast('Ошибка: ' + error.message, 'error'); setSaving(false); return }

    setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, ...updates } : o))
    setSelected(s => ({ ...s, ...updates }))

    // Notify user
    const st = STATUS_MAP[editStatus]
    if (st && selected.user_id) {
      await notifyUser(
        supabase, selected.user_id,
        `${st.icon} Подарок: ${st.label}`,
        `${selected.item_icon} ${selected.item_name}${editComment ? `\n${editComment}` : ''}`,
        'system'
      )
    }

    showToast('✅ Статус обновлён'); setSaving(false)
  }

  async function saveItem(e) {
    e.preventDefault(); setSavingItem(true)
    const data = { ...itemForm, price: parseInt(itemForm.price)||0, stock: parseInt(itemForm.stock)||(-1) }
    const { error } = editItem
      ? await supabase.from('shop_items').update(data).eq('id', editItem.id)
      : await supabase.from('shop_items').insert(data)
    if (error) showToast('Ошибка: ' + error.message, 'error')
    else {
      showToast(editItem ? '✅ Обновлено' : '✅ Добавлено')
      setShowItemForm(false); setEditItem(null)
      setItemForm({ name:'', description:'', icon:'🎁', price:100, stock:-1, category:'general', active:true })
      loadAll()
    }
    setSavingItem(false)
  }

  async function toggleItemActive(item) {
    await supabase.from('shop_items').update({ active: !item.active }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: !i.active } : i))
  }

  async function deleteItem(id) {
    if (!confirm('Удалить товар?')) return
    await supabase.from('shop_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id)); showToast('Удалено')
  }

  function printReceipt(order) {
    const u = users[order.user_id] || {}
    const date = new Date().toLocaleDateString('ru', { day:'2-digit', month:'long', year:'numeric' })
    const orderDate = new Date(order.created_at).toLocaleDateString('ru', { day:'2-digit', month:'long', year:'numeric' })

    const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<title>Бланк выдачи — ${order.item_name}</title>
<style>
  @page { size: A4; margin: 20mm 20mm 25mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; background: #fff; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
  .header .company { font-size: 10pt; color: #444; margin-bottom: 4px; }
  .header h1 { font-size: 16pt; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
  .header .doc-num { font-size: 10pt; color: #666; margin-top: 4px; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #666; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 10px; }
  .row { display: flex; margin-bottom: 7px; align-items: baseline; gap: 6px; }
  .row .label { font-size: 10pt; color: #555; white-space: nowrap; min-width: 140px; }
  .row .value { font-size: 11pt; font-weight: bold; border-bottom: 1px solid #999; flex: 1; min-height: 18px; padding-bottom: 1px; }
  .item-box { border: 2px solid #000; border-radius: 4px; padding: 16px; margin: 16px 0; display: flex; align-items: center; gap: 16px; }
  .item-icon { font-size: 40pt; }
  .item-info .name { font-size: 14pt; font-weight: bold; }
  .item-info .price { font-size: 11pt; color: #555; margin-top: 4px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 32px; }
  .sig-block { }
  .sig-title { font-size: 10pt; font-weight: bold; margin-bottom: 6px; }
  .sig-line { border-bottom: 1px solid #000; height: 28px; margin-bottom: 4px; }
  .sig-name { font-size: 9pt; color: #555; text-align: center; }
  .footer { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 9pt; color: #888; text-align: center; }
  .stamp-area { border: 1px dashed #999; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; font-size: 9pt; color: #bbb; text-align: center; margin: 0 auto; }
  .notice { background: #f9f9f9; border-left: 3px solid #333; padding: 8px 12px; font-size: 9pt; margin-top: 12px; }
</style></head>
<body>
  <div class="header">
    <div class="company">Akkermann — Система безопасности и мотивации</div>
    <h1>Бланк выдачи подарка</h1>
    <div class="doc-num">№ ${String(order.id).padStart(6,'0')} от ${date}</div>
  </div>

  <div class="section">
    <div class="section-title">Получатель</div>
    <div class="row"><span class="label">ФИО:</span><span class="value">${u.name || order.user_id}</span></div>
    <div class="row"><span class="label">Подразделение:</span><span class="value">${u.department || '—'}</span></div>
    <div class="row"><span class="label">Табельный номер:</span><span class="value">${order.user_id}</span></div>
    ${u.phone ? `<div class="row"><span class="label">Телефон:</span><span class="value">${u.phone}</span></div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Предмет выдачи</div>
    <div class="item-box">
      <div class="item-icon">${order.item_icon || '🎁'}</div>
      <div class="item-info">
        <div class="name">${order.item_name}</div>
        <div class="price">Стоимость: ${order.item_price} ТОП · Дата заявки: ${orderDate}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Сведения о выдаче</div>
    <div class="row"><span class="label">Дата выдачи:</span><span class="value"></span></div>
    <div class="row"><span class="label">Место выдачи:</span><span class="value"></span></div>
    <div class="row"><span class="label">Выдал:</span><span class="value">${adminUser.name}</span></div>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-title">Выдал:</div>
      <div class="sig-line"></div>
      <div class="sig-name">${adminUser.name} / подпись</div>
    </div>
    <div class="sig-block">
      <div class="sig-title">Получил(а):</div>
      <div class="sig-line"></div>
      <div class="sig-name">${u.name || '________________'} / подпись</div>
    </div>
  </div>

  <div style="margin-top:28px; display:flex; justify-content:center;">
    <div class="stamp-area">М.П.</div>
  </div>

  <div class="notice">
    Подписывая данный документ, получатель подтверждает, что подарок получен в надлежащем состоянии и претензий не имеет.
  </div>

  <div class="footer">
    Akkermann Pulse · Сформировано: ${date} · Заявка #${String(order.id).padStart(6,'0')}
  </div>

  <script>window.onload = () => window.print()</script>
</body></html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    showToast('📄 Бланк открыт — сохраните через Файл → Печать → Сохранить как PDF')
  }

  const filteredOrders = orders.filter(o => statusFilter === 'all' || o.status === statusFilter)
  const pageOrders = filteredOrders.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const stats = {
    pending:    orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    ready:      orders.filter(o => o.status === 'ready').length,
    completed:  orders.filter(o => o.status === 'completed').length,
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16, borderBottom:'2px solid #d1cfc9', paddingBottom:12 }}>
        {[['orders','📦 Заявки'],['items','🎁 Товары']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'8px 20px', borderRadius:3, border:'none', cursor:'pointer',
            background: tab===t ? '#f53d2d' : '#f2f1ee',
            color: tab===t ? '#fff' : '#2a3f52',
            fontSize:13, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif",
          }}>{l}</button>
        ))}
        <button onClick={loadAll} style={{ marginLeft:'auto', padding:'8px 14px', borderRadius:3, border:'1px solid #d1cfc9', background:'#fff', color:'#5a7080', fontSize:12, cursor:'pointer' }}>🔄 Обновить</button>
      </div>

      {loading ? <LoadingDots /> : (
        <>
          {/* ── ORDERS TAB ── */}
          {tab === 'orders' && (
            <div style={{ display:'flex', gap:16, height:'calc(100vh - 200px)' }}>
              <div style={{ flex: selected ? '0 0 55%' : 1, display:'flex', flexDirection:'column', minWidth:0 }}>

                {/* Stats */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:12 }}>
                  {Object.entries(stats).map(([k,v]) => {
                    const st = STATUS_MAP[k]
                    return (
                      <div key={k} onClick={() => { setStatusFilter(k===statusFilter?'all':k); setPage(1) }}
                        style={{ background:'#fff', border:`1px solid ${statusFilter===k?st.color:'#d1cfc9'}`, borderTop:`3px solid ${st.color}`, borderRadius:3, padding:'10px 12px', cursor:'pointer', transition:'.15s' }}>
                        <div style={{ fontSize:20, fontWeight:800, color:st.color }}>{v}</div>
                        <div style={{ fontSize:10, color:'#5a7080', textTransform:'uppercase' }}>{st.label}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Filter pills */}
                <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
                  <button onClick={() => { setStatusFilter('all'); setPage(1) }} style={{ padding:'4px 12px', borderRadius:99, border:`1px solid ${statusFilter==='all'?'#f53d2d':'#d1cfc9'}`, background:statusFilter==='all'?'rgba(245,61,45,.1)':'#fff', color:statusFilter==='all'?'#f53d2d':'#5a7080', fontSize:12, fontWeight:700, cursor:'pointer' }}>Все ({orders.length})</button>
                  {Object.entries(STATUS_MAP).map(([k,st]) => (
                    <button key={k} onClick={() => { setStatusFilter(k); setPage(1) }} style={{ padding:'4px 12px', borderRadius:99, border:`1px solid ${statusFilter===k?st.color:'#d1cfc9'}`, background:statusFilter===k?`${st.color}18`:'#fff', color:statusFilter===k?st.color:'#5a7080', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      {st.icon} {st.label}
                    </button>
                  ))}
                </div>

                {/* Table */}
                <div style={{ flex:1, overflowY:'auto', background:'#fff', borderRadius:3, border:'1px solid #d1cfc9', overflow:'hidden' }}>
                  {filteredOrders.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'40px 20px', color:'#8fa0ae' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                      <div>Заявок нет</div>
                    </div>
                  ) : (
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead style={{ position:'sticky', top:0, zIndex:5 }}>
                        <tr>{['#','Товар','Сотрудник','Дата','Статус'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {pageOrders.map(o => {
                          const st = STATUS_MAP[o.status]||STATUS_MAP.pending
                          const u = users[o.user_id]
                          const isSel = selected?.id === o.id
                          return (
                            <tr key={o.id}
                              onClick={() => { setSelected(o); setEditStatus(o.status); setEditComment(o.admin_comment||'') }}
                              style={{ background:isSel?'rgba(245,61,45,.05)':'', cursor:'pointer', borderLeft:isSel?'3px solid #f53d2d':'3px solid transparent' }}
                              onMouseOver={e => !isSel&&(e.currentTarget.style.background='#f5f4f0')}
                              onMouseOut={e => !isSel&&(e.currentTarget.style.background='')}>
                              <td style={tdStyle}><span style={{ fontFamily:'monospace', color:'#f53d2d', fontSize:11, fontWeight:700 }}>#{String(o.id).padStart(4,'0')}</span></td>
                              <td style={tdStyle}>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <span style={{ fontSize:20 }}>{o.item_icon||'🎁'}</span>
                                  <div>
                                    <div style={{ fontSize:12, fontWeight:600, color:'#0f1c2c' }}>{o.item_name}</div>
                                    <div style={{ fontSize:10, color:'#f53d2d', fontWeight:700 }}>{o.item_price} ТОП</div>
                                  </div>
                                </div>
                              </td>
                              <td style={tdStyle}>
                                <div style={{ fontSize:12, fontWeight:600 }}>{u?.name||o.user_id}</div>
                                <div style={{ fontSize:10, color:'#5a7080' }}>{u?.department||'—'}</div>
                              </td>
                              <td style={{ ...tdStyle, fontSize:11, whiteSpace:'nowrap' }}>{fmtDate(o.created_at)}</td>
                              <td style={tdStyle}><span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, background:`${st.color}18`, color:st.color, whiteSpace:'nowrap' }}>{st.icon} {st.label}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <Pagination page={page} total={filteredOrders.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </div>

              {/* Detail panel */}
              {selected && (
                <div style={{ flex:1, background:'#fff', borderRadius:3, border:'1px solid #d1cfc9', overflow:'hidden', display:'flex', flexDirection:'column', minWidth:280 }}>
                  <div style={{ padding:'12px 16px', background:'#0f1c2c', borderBottom:'2px solid #f53d2d', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                    <span style={{ fontSize:14, fontWeight:800, color:'#e8e7e3', fontFamily:"'Barlow Condensed',sans-serif" }}>ЗАЯВКА #{String(selected.id).padStart(4,'0')}</span>
                    <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', color:'rgba(232,231,227,.7)', fontSize:20, cursor:'pointer' }}>×</button>
                  </div>

                  <div style={{ overflowY:'auto', flex:1, padding:16 }}>
                    {/* Item info */}
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, padding:'12px', background:'#f2f1ee', borderRadius:8 }}>
                      <span style={{ fontSize:40 }}>{selected.item_icon||'🎁'}</span>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:'#0f1c2c' }}>{selected.item_name}</div>
                        <div style={{ fontSize:13, fontWeight:800, color:'#f53d2d', marginTop:2 }}>{selected.item_price} ТОП</div>
                        <div style={{ fontSize:11, color:'#5a7080' }}>Заявка от {fmtDate(selected.created_at)}</div>
                      </div>
                    </div>

                    {/* User info */}
                    {users[selected.user_id] && (
                      <div style={{ marginBottom:14, padding:'10px 12px', background:'#f2f1ee', borderRadius:8 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#5a7080', textTransform:'uppercase', marginBottom:6 }}>Получатель</div>
                        {[
                          ['ФИО', users[selected.user_id]?.name],
                          ['Участок', users[selected.user_id]?.department||'—'],
                          ['Телефон', users[selected.user_id]?.phone||'—'],
                          ['Telegram', users[selected.user_id]?.telegram_username?`@${users[selected.user_id].telegram_username}`:'—'],
                        ].map(([l,v]) => (
                          <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid #e8e7e3' }}>
                            <span style={{ fontSize:11, color:'#5a7080' }}>{l}</span>
                            <span style={{ fontSize:12, fontWeight:600, color:'#0f1c2c' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Status update */}
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      <div>
                        <Label>Статус</Label>
                        <select value={editStatus} onChange={e=>setEditStatus(e.target.value)} style={{ width:'100%', ...inpStyle }}>
                          {Object.entries(STATUS_MAP).map(([k,st]) => <option key={k} value={k}>{st.icon} {st.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Комментарий для сотрудника</Label>
                        <textarea value={editComment} onChange={e=>setEditComment(e.target.value)} rows={3}
                          placeholder="Напр.: Приходите в HR отдел с 9:00 до 18:00"
                          style={{ width:'100%', padding:'8px 11px', border:'1px solid #d1cfc9', borderBottom:'2px solid #d1cfc9', borderRadius:3, background:'#f2f1ee', color:'#0f1c2c', fontSize:13, outline:'none', resize:'none', fontFamily:'inherit' }} />
                      </div>
                      <button onClick={updateOrder} disabled={saving} style={{ width:'100%', padding:11, borderRadius:3, border:'none', background:'linear-gradient(135deg,#f53d2d,#c42b1c)', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', opacity:saving?.6:1, fontFamily:"'Barlow Condensed',sans-serif", textTransform:'uppercase' }}>
                        {saving ? 'СОХРАНЕНИЕ…' : '✅ ОБНОВИТЬ И УВЕДОМИТЬ'}
                      </button>

                      {/* PDF receipt button */}
                      <button onClick={() => printReceipt(selected)}
                        style={{ width:'100%', padding:11, borderRadius:3, border:'1px solid #d1cfc9', background:'#f2f1ee', color:'#0f1c2c', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Barlow Condensed',sans-serif", textTransform:'uppercase', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        📄 РАСПЕЧАТАТЬ БЛАНК ВЫДАЧИ
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ITEMS TAB ── */}
          {tab === 'items' && (
            <div>
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
                <button onClick={() => { setShowItemForm(true); setEditItem(null); setItemForm({name:'',description:'',icon:'🎁',price:100,stock:-1,category:'general',active:true}) }}
                  style={{ padding:'9px 20px', borderRadius:3, border:'none', background:'linear-gradient(135deg,#f53d2d,#c42b1c)', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Barlow Condensed',sans-serif", textTransform:'uppercase' }}>
                  + Добавить товар
                </button>
              </div>

              {/* Item form modal */}
              {showItemForm && (
                <div onClick={e=>{if(e.target===e.currentTarget){setShowItemForm(false);setEditItem(null)}}}
                  style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
                  <div className="fade-in" style={{ background:'#fff', borderRadius:8, width:'100%', maxWidth:520, overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,.3)' }}>
                    <div style={{ padding:'12px 16px', background:'#0f1c2c', borderBottom:'2px solid #f53d2d', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:14, fontWeight:800, color:'#e8e7e3', fontFamily:"'Barlow Condensed',sans-serif", textTransform:'uppercase' }}>{editItem?'✏️ Редактировать':'+ Новый товар'}</span>
                      <button onClick={()=>{setShowItemForm(false);setEditItem(null)}} style={{ background:'none',border:'none',color:'rgba(232,231,227,.7)',fontSize:20,cursor:'pointer' }}>×</button>
                    </div>
                    <form onSubmit={saveItem} style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'80px 1fr', gap:12 }}>
                        <div><Label>Иконка</Label><input value={itemForm.icon} onChange={e=>setItemForm(f=>({...f,icon:e.target.value}))} style={{ ...inpStyle, textAlign:'center', fontSize:24 }} /></div>
                        <div><Label>Название *</Label><input value={itemForm.name} onChange={e=>setItemForm(f=>({...f,name:e.target.value}))} required style={inpStyle} /></div>
                      </div>
                      <div><Label>Описание</Label><textarea value={itemForm.description} onChange={e=>setItemForm(f=>({...f,description:e.target.value}))} rows={2} style={{ ...inpStyle, resize:'none' }} /></div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                        <div><Label>Цена (ТОП) *</Label><input type="number" value={itemForm.price} onChange={e=>setItemForm(f=>({...f,price:e.target.value}))} required min="1" style={inpStyle} /></div>
                        <div><Label>Кол-во (-1=∞)</Label><input type="number" value={itemForm.stock} onChange={e=>setItemForm(f=>({...f,stock:e.target.value}))} style={inpStyle} /></div>
                        <div><Label>Категория</Label>
                          <select value={itemForm.category} onChange={e=>setItemForm(f=>({...f,category:e.target.value}))} style={inpStyle}>
                            <option value="general">Общее</option>
                            <option value="merch">Мерч</option>
                            <option value="office">Канцелярия</option>
                            <option value="benefits">Привилегии</option>
                            <option value="voucher">Сертификаты</option>
                            <option value="electronics">Электроника</option>
                          </select>
                        </div>
                      </div>
                      <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'#0f1c2c' }}>
                        <input type="checkbox" checked={itemForm.active} onChange={e=>setItemForm(f=>({...f,active:e.target.checked}))} /> Активный (виден пользователям)
                      </label>
                      <div style={{ display:'flex', gap:10, marginTop:4 }}>
                        <button type="button" onClick={()=>{setShowItemForm(false);setEditItem(null)}} style={{ flex:1, padding:10, borderRadius:3, border:'1px solid #d1cfc9', background:'#f2f1ee', color:'#5a7080', fontSize:13, fontWeight:700, cursor:'pointer' }}>Отмена</button>
                        <button type="submit" disabled={savingItem} style={{ flex:2, padding:10, borderRadius:3, border:'none', background:'linear-gradient(135deg,#f53d2d,#c42b1c)', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:"'Barlow Condensed',sans-serif", textTransform:'uppercase', opacity:savingItem?.6:1 }}>
                          {savingItem ? 'Сохранение…' : editItem ? '✅ Сохранить' : '+ Добавить'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Items grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                {items.map(item => (
                  <div key={item.id} style={{ background:'#fff', borderRadius:8, border:`1px solid ${item.active?'#d1cfc9':'#fecaca'}`, overflow:'hidden', opacity:item.active?1:.6 }}>
                    <div style={{ height:80, background:item.active?'rgba(245,61,45,.05)':'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, position:'relative' }}>
                      {item.icon}
                      {!item.active && <div style={{ position:'absolute', top:4, right:4, fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:3, background:'#ef4444', color:'#fff' }}>Скрыт</div>}
                    </div>
                    <div style={{ padding:'10px 12px' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#0f1c2c', marginBottom:4 }}>{item.name}</div>
                      {item.description && <div style={{ fontSize:11, color:'#5a7080', marginBottom:6, lineHeight:1.4 }}>{item.description}</div>}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:14, fontWeight:800, color:'#f53d2d' }}>{item.price} ТОП</span>
                        <span style={{ fontSize:10, color:'#5a7080' }}>{item.stock===-1?'∞':item.stock} шт.</span>
                      </div>
                      <div style={{ display:'flex', gap:6, marginTop:10 }}>
                        <button onClick={() => { setEditItem(item); setItemForm({...item}); setShowItemForm(true) }}
                          style={{ flex:1, padding:'5px', borderRadius:4, border:'1px solid #d1cfc9', background:'#f2f1ee', color:'#2a3f52', fontSize:11, fontWeight:700, cursor:'pointer' }}>✏️ Изм.</button>
                        <button onClick={() => toggleItemActive(item)}
                          style={{ flex:1, padding:'5px', borderRadius:4, border:'none', background:item.active?'rgba(239,68,68,.1)':'rgba(34,197,94,.1)', color:item.active?'#ef4444':'#16a34a', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          {item.active?'🙈 Скрыть':'👁️ Показ.'}
                        </button>
                        <button onClick={() => deleteItem(item.id)}
                          style={{ padding:'5px 8px', borderRadius:4, border:'none', background:'rgba(239,68,68,.1)', color:'#ef4444', fontSize:11, cursor:'pointer' }}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Label({children}) {
  return <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#5a7080', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{children}</label>
}

const thStyle = { padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'#e8e7e3', textTransform:'uppercase', letterSpacing:'.05em', background:'#0f1c2c', borderBottom:'2px solid #f53d2d', whiteSpace:'nowrap', fontFamily:"'Barlow Condensed',sans-serif" }
const tdStyle = { padding:'9px 12px', fontSize:13, color:'#2a3f52', borderBottom:'1px solid #f2f1ee', verticalAlign:'middle' }
const inpStyle = { width:'100%', padding:'8px 11px', border:'1px solid #d1cfc9', borderBottom:'2px solid #d1cfc9', borderRadius:3, background:'#f2f1ee', color:'#0f1c2c', fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }
