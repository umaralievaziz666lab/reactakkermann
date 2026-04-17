import React, { useState, useEffect } from 'react'
import { supabase, fmtDate } from '../../lib/supabase.js'
import LoadingDots from '../common/LoadingDots.jsx'

const CAT_MAP = {
  announcement: { icon: '📢', label: 'Объявление', color: '#3b82f6' },
  achievement:  { icon: '🏆', label: 'Достижение', color: '#f59e0b' },
  safety:       { icon: '🛡️', label: 'Безопасность', color: '#22c55e' },
  general:      { icon: '📌', label: 'Общее', color: '#6b7280' },
}

export default function NewsSection({ user, showToast, isActive }) {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [gallery, setGallery] = useState(null) // { images, index }

  useEffect(() => { loadNews() }, [])
  useEffect(() => { if (isActive && news.length === 0) loadNews() }, [isActive])

  async function loadNews() {
    setLoading(true)
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false }).limit(50)
    setNews(data || [])
    setLoading(false)
  }

  function parseMedia(val) {
    if (!val) return []
    if (Array.isArray(val)) return val
    try { return JSON.parse(val) } catch { return [] }
  }

  return (
    <div style={{ paddingBottom: 'calc(74px + env(safe-area-inset-bottom,0px))', minHeight: '100%' }}>

      {/* Header — по центру, с отступом от Telegram кнопок */}
      <div style={{
        background: 'var(--navy)',
        borderBottom: '3px solid var(--red)',
        paddingTop: 'max(env(safe-area-inset-top,0px), 16px)',
        paddingBottom: 0,
      }}>
        <div style={{
          textAlign: 'center',
          padding: '12px 16px 0',
          fontSize: 17, fontWeight: 800,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          fontFamily: "'Barlow Condensed',sans-serif",
          color: '#e8e7e3',
        }}>
          📰 НОВОСТИ
        </div>
        <div style={{ height: 10 }} />
      </div>

      <div style={{ padding: '10px 12px' }}>
        {loading ? <LoadingDots /> : news.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t3)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
            <div>Новостей пока нет</div>
          </div>
        ) : news.map(n => {
          const cat = CAT_MAP[n.category] || CAT_MAP.general
          const isOpen = expanded === n.id
          const media = parseMedia(n.media)

          return (
            <div key={n.id} style={{
              background: 'var(--bg2)', border: '1px solid var(--bd)',
              borderRadius: 12, marginBottom: 10, overflow: 'hidden',
              boxShadow: 'var(--shadow)',
            }}>
              {/* Card header */}
              <div onClick={() => setExpanded(isOpen ? null : n.id)}
                style={{ padding: '12px 14px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: `${cat.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                  }}>{cat.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: `${cat.color}15`, color: cat.color }}>{cat.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--t4)', marginLeft: 'auto' }}>{fmtDate(n.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.4, marginBottom: 4 }}>{n.title}</div>
                {!isOpen && (
                  <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.content}
                  </div>
                )}
              </div>

              {/* Expanded content */}
              {isOpen && (
                <div style={{ padding: '0 14px 14px' }}>
                  <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7, marginBottom: media.length > 0 ? 12 : 0 }}>
                    {n.content}
                  </div>

                  {/* Media grid */}
                  {media.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {media.length === 1 ? (
                        <img
                          src={media[0]}
                          onClick={() => setGallery({ images: media, index: 0 })}
                          style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 10, cursor: 'pointer', display: 'block' }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: media.length === 3 ? '1fr 1fr' : 'repeat(2,1fr)', gap: 4 }}>
                          {media.map((m, i) => (
                            <div key={i}
                              onClick={() => setGallery({ images: media, index: i })}
                              style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: 8, cursor: 'pointer', gridColumn: media.length === 3 && i === 0 ? 'span 2' : 'span 1' }}>
                              <img src={m} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                              {i === 3 && media.length > 4 && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 800 }}>+{media.length - 4}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {n.author && (
                    <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 8 }}>— {n.author}</div>
                  )}
                </div>
              )}

              {/* Expand toggle */}
              <div onClick={() => setExpanded(isOpen ? null : n.id)}
                style={{ padding: '6px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t4)' }}>{isOpen ? 'Свернуть' : 'Читать далее'}</span>
                <span style={{ fontSize: 10, color: 'var(--t4)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: '.2s' }}>▼</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Gallery */}
      {gallery && (
        <NewsGallery images={gallery.images} startIndex={gallery.index} onClose={() => setGallery(null)} />
      )}
    </div>
  )
}

function NewsGallery({ images, startIndex, onClose }) {
  const [idx, setIdx] = React.useState(startIndex)
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.95)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>{idx+1} / {images.length}</span>
        <button onClick={onClose} style={{ width:34,height:34,borderRadius:'50%',background:'rgba(255,255,255,.15)',border:'none',color:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 16px' }}>
        <img src={images[idx]} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:8 }} />
      </div>
      {images.length > 1 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, padding:'12px 16px', paddingBottom:'calc(env(safe-area-inset-bottom,0px) + 12px)' }}>
          {images.map((_, i) => (
            <div key={i} onClick={() => setIdx(i)} style={{ width:i===idx?32:8, height:8, borderRadius:99, background:i===idx?'#f53d2d':'rgba(255,255,255,.3)', cursor:'pointer', transition:'.2s' }} />
          ))}
        </div>
      )}
      {idx > 0 && <button onClick={() => setIdx(i=>i-1)} style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,.15)',border:'none',color:'#fff',fontSize:22,cursor:'pointer' }}>‹</button>}
      {idx < images.length-1 && <button onClick={() => setIdx(i=>i+1)} style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,.15)',border:'none',color:'#fff',fontSize:22,cursor:'pointer' }}>›</button>}
    </div>
  )
}
