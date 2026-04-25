import React, { useState, useEffect, useRef } from 'react'
import { supabase, pad, fmtDate, initials, avatarColor, STATUS_MAP, PAGE_SIZE } from '../../lib/supabase.js'
import PullToRefresh from '../common/PullToRefresh.jsx'
import SkeletonCard from '../common/SkeletonCard.jsx'
import FeedCard from './FeedCard.jsx'
import DetailModal from './DetailModal.jsx'

const TABS = ['all', 'my', 'assigned']
const TAB_LABELS = { all: 'ОБЩАЯ', my: 'МОИ', assigned: 'НАЗНАЧЕННЫЕ' }

export default function FeedSection({ user, showToast, updateUser }) {
  const [tab, setTab] = useState('all')
  const [posts, setPosts] = useState([])
  const [likedPosts, setLikedPosts] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState({ type: 'all', urgency: 'all' })
  const swipeStartRef = useRef(null)

  useEffect(() => { loadPosts(true) }, [tab])

  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('feed-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, payload => {
        if (tab === 'all') {
          setPosts(prev => [payload.new, ...prev])
          if (payload.new.type === 'risk' && payload.new.risk_urgency === 1) playAlert()
        }
      })
      .subscribe()
    loadLikes()
    return () => supabase.removeChannel(ch)
  }, [user?.empId, tab])

  async function loadPosts(reset = true) {
    if (reset) setLoading(true)
    let q = supabase.from('requests').select('*').order('id', { ascending: false }).limit(PAGE_SIZE)
    if (tab === 'my') q = q.or(`author_id.eq.${user?.empId},author.eq.${user?.name}`)
    if (tab === 'assigned') q = q.eq('assigned_to', user?.name)
    const { data } = await q
    if (reset) setPosts(data || [])
    setHasMore((data || []).length === PAGE_SIZE)
    setLoading(false)
  }

  async function loadLikes() {
    if (!user) return
    const { data } = await supabase.from('likes').select('post_id').eq('user_id', user.empId)
    setLikedPosts(new Set((data || []).map(l => l.post_id)))
  }

  async function handleLike(post) {
    if (!user) return
    const liked = likedPosts.has(post.id)
    const newLikes = liked ? (post.likes || 1) - 1 : (post.likes || 0) + 1
    setLikedPosts(prev => { const s = new Set(prev); liked ? s.delete(post.id) : s.add(post.id); return s })
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes } : p))
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.empId)
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.empId })
      const pts = (user.points || 0) + 2
      await supabase.from('users').update({ points: pts }).eq('id', user.empId)
      updateUser({ points: pts })
    }
    await supabase.from('requests').update({ likes: newLikes }).eq('id', post.id)
  }

  function playAlert() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const beep = (t, f, d) => {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = 'square'; o.frequency.value = f
        g.gain.setValueAtTime(.2, t); g.gain.exponentialRampToValueAtTime(.001, t + d)
        o.start(t); o.stop(t + d)
      }
      beep(ctx.currentTime, 880, .1); beep(ctx.currentTime + .12, 880, .1); beep(ctx.currentTime + .24, 1175, .2)
    } catch {}
  }

  const filtered = posts.filter(p => {
    if (filters.type !== 'all' && p.type !== filters.type) return false
    if (filters.urgency !== 'all' && String(p.risk_urgency) !== filters.urgency) return false
    if (search) {
      const q = search.toLowerCase()
      return String(p.id).includes(q) || (p.description || '').toLowerCase().includes(q) || (p.author || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <PullToRefresh onRefresh={() => loadPosts(true)}>
      <div
        onTouchStart={e => { swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchEnd={e => {
          if (!swipeStartRef.current) return
          const dx = e.changedTouches[0].clientX - swipeStartRef.current.x
          const dy = Math.abs(e.changedTouches[0].clientY - swipeStartRef.current.y)
          swipeStartRef.current = null
          if (Math.abs(dx) > 55 && dy < 70) {
            const cur = TABS.indexOf(tab)
            const next = dx < 0 ? Math.min(cur + 1, 2) : Math.max(cur - 1, 0)
            if (next !== cur) setTab(TABS[next])
          }
        }}
        style={{ minHeight: '100%' }}
      >
        {/* ── HEADER ── */}
        <div style={{
          background: 'var(--navy)',
          paddingTop: 'max(env(safe-area-inset-top,0px), 8px)',
          borderBottom: '2px solid var(--red)',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          {/* Logo row */}
          <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', letterSpacing: '.14em', color: '#EEEAE0' }}>
              AKKERMANN <span style={{ color: 'var(--red)' }}>PULSE</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setFilterOpen(!filterOpen)} style={{
                background: (filters.type !== 'all' || filters.urgency !== 'all') ? 'var(--red-lo)' : 'rgba(255,255,255,.08)',
                border: `1px solid ${(filters.type !== 'all' || filters.urgency !== 'all') ? 'var(--red)' : 'rgba(255,255,255,.15)'}`,
                borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                color: (filters.type !== 'all' || filters.urgency !== 'all') ? 'var(--red)' : 'rgba(232,231,227,.6)',
                fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M6 8h12M10 12h4"/>
                </svg>
                Фильтр
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '8px 16px 0' }}>
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" fill="none" stroke="rgba(255,255,255,.3)" viewBox="0 0 24 24" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по ID, описанию, автору…"
                style={{ width:'100%', padding:'9px 12px 9px 34px', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, color:'#fff', fontSize:13, outline:'none', fontFamily:'var(--font-body)' }} />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', padding: '8px 16px 0' }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '8px 4px', fontSize: 12,
                fontFamily: 'var(--font-display)', letterSpacing: '.08em',
                color: tab === t ? '#fff' : 'rgba(232,231,227,.35)',
                background: 'none', border: 'none',
                borderBottom: `2.5px solid ${tab === t ? 'var(--red)' : 'transparent'}`,
                cursor: 'pointer', transition: 'all .2s',
              }}>{TAB_LABELS[t]}</button>
            ))}
          </div>

          {/* Filter drawer */}
          {filterOpen && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['all','Все'],['idea','💡 Идеи'],['risk','⚠️ Риски']].map(([v,l]) => (
                <button key={v} onClick={() => setFilters(f=>({...f,type:v}))} style={{
                  padding:'4px 12px', borderRadius:99, fontSize:11, fontWeight:600, cursor:'pointer',
                  border:`1px solid ${filters.type===v?'var(--red)':'rgba(255,255,255,.15)'}`,
                  background: filters.type===v ? 'var(--red-lo)' : 'rgba(255,255,255,.06)',
                  color: filters.type===v ? 'var(--red)' : 'rgba(232,231,227,.6)',
                }}>{l}</button>
              ))}
              <div style={{ width:'100%', height:1, background:'rgba(255,255,255,.06)' }} />
              {[['all','Все уровни'],['1','🔴 L1'],['2','🟡 L2'],['3','🟢 L3']].map(([v,l]) => (
                <button key={v} onClick={() => setFilters(f=>({...f,urgency:v}))} style={{
                  padding:'4px 12px', borderRadius:99, fontSize:11, fontWeight:600, cursor:'pointer',
                  border:`1px solid ${filters.urgency===v?'var(--red)':'rgba(255,255,255,.15)'}`,
                  background: filters.urgency===v ? 'var(--red-lo)' : 'rgba(255,255,255,.06)',
                  color: filters.urgency===v ? 'var(--red)' : 'rgba(232,231,227,.6)',
                }}>{l}</button>
              ))}
              {(filters.type!=='all'||filters.urgency!=='all') && (
                <button onClick={() => setFilters({type:'all',urgency:'all'})} style={{ padding:'4px 12px', borderRadius:99, fontSize:11, cursor:'pointer', border:'1px solid rgba(239,68,68,.4)', background:'rgba(239,68,68,.1)', color:'#fca5a5' }}>✕ Сбросить</button>
              )}
            </div>
          )}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding:'10px 10px', paddingBottom:'calc(74px + env(safe-area-inset-bottom,0px))' }}>
          {loading ? (
            [1,2,3,4].map(i => <SkeletonCard key={i} />)
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--t3)' }}>
              <div style={{ fontSize:48, marginBottom:10 }}>📋</div>
              <div style={{ fontSize:16, fontFamily:'var(--font-display)', letterSpacing:'.06em' }}>ПУСТО</div>
              <div style={{ fontSize:13, color:'var(--t4)', marginTop:4 }}>Будьте первым — создайте заявку!</div>
            </div>
          ) : (
            <>
              {filtered.map(post => (
                <FeedCard key={post.id} post={post} user={user}
                  isLiked={likedPosts.has(post.id)}
                  onLike={() => handleLike(post)}
                  onDetail={() => setDetailId(post.id)} />
              ))}
            </>
          )}
        </div>

        {detailId && (
          <DetailModal postId={detailId} posts={posts} user={user}
            onClose={() => setDetailId(null)}
            onUpdate={updated => setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))}
            showToast={showToast} updateUser={updateUser} />
        )}
      </div>
    </PullToRefresh>
  )
}
