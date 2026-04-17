import React, { useState, useEffect, useRef } from 'react'
import { supabase, lvlInfo, LEVELS, fmtDate, avatarColor, initials } from '../../lib/supabase.js'
import LoadingDots from '../common/LoadingDots.jsx'

export default function ProfileSection({ user, updateUser, isDark, toggleDark, onLogout, showToast, clearProfileBadge, onShowDailyTasks, dailyDone, isActive }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [achievements, setAchievements] = useState([])
  const [myPosts, setMyPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stats')
  const [showReferral, setShowReferral] = useState(false)

  useEffect(() => { clearProfileBadge(); loadAll() }, [])
  useEffect(() => { if (isActive) clearProfileBadge() }, [isActive])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadLeaderboard(), loadAchievements(), loadMyPosts()])
    setLoading(false)
  }

  async function loadLeaderboard() {
    const { data } = await supabase.from('users').select('id,name,department,points,profile_pic').order('points',{ascending:false}).limit(20)
    setLeaderboard(data || [])
  }

  async function loadAchievements() {
    const { data } = await supabase.from('achievements').select('*').order('target')
    setAchievements(data || [])
  }

  async function loadMyPosts() {
    if (!user) return
    const { data } = await supabase.from('requests').select('id,type,status,likes,date').or(`author_id.eq.${user.empId},author.eq.${user.name}`).order('id',{ascending:false}).limit(100)
    setMyPosts(data || [])
  }

  async function handleTrainingComplete(answers) {
    const correct = answers.tq1==='idea' && answers.tq2==='profile'
    if (!correct) { showToast('Неверные ответы','error'); return }
    await supabase.from('users').update({ is_trained:true, points:(user.points||0)+40 }).eq('id',user.empId)
    updateUser({ isTrained:true, points:(user.points||0)+40 })
    showToast('🎓 Тренинг пройден! +40 ТОП')
  }

  const lv = lvlInfo(user?.points || 0)
  const lvIdx = LEVELS.findIndex(l => l.cls === lv.cls)
  const nextLv = LEVELS[lvIdx + 1]
  const progress = nextLv ? Math.min(100, Math.round(((user?.points - lv.min) / (lv.max - lv.min)) * 100)) : 100
  const myRank = leaderboard.findIndex(u => u.id === user?.empId) + 1
  const ideas = myPosts.filter(p => p.type==='idea').length
  const risks = myPosts.filter(p => p.type==='risk').length
  const totalLikes = myPosts.reduce((s,p) => s+(p.likes||0), 0)
  const completed = myPosts.filter(p => p.status==='completed').length

  return (
    <div style={{ paddingBottom:'calc(74px + env(safe-area-inset-bottom,0px))', minHeight:'100%' }}>

      {/* Profile Header — аватар по центру */}
      <div style={{
        background: 'var(--navy)',
        borderBottom: '3px solid var(--red)',
        paddingTop: 'max(env(safe-area-inset-top,0px), 20px)',
        paddingBottom: 16,
      }}>
        {/* Avatar centered */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 16px 0' }}>
          <AvatarUpload user={user} updateUser={updateUser} showToast={showToast} />

          <div style={{ marginTop:12, textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:800, color:'#e8e7e3' }}>{user?.name}</div>
            <div style={{ fontSize:13, color:'rgba(232,231,227,0.5)', marginTop:2 }}>{user?.department}</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginTop:8 }}>
              <span className={`level-badge ${lv.cls}`} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 12px', borderRadius:999, fontSize:12, fontWeight:700 }}>
                {lv.label}
              </span>
              {user?.isTrained && (
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:99, background:'rgba(34,197,94,.2)', color:'#86efac', border:'1px solid rgba(34,197,94,.3)' }}>🎓 Обучен</span>
              )}
            </div>
          </div>

          {/* Points centered */}
          <div style={{ marginTop:12, textAlign:'center' }}>
            <div style={{ fontSize:36, fontWeight:800, color:'#f53d2d', lineHeight:1 }}>{user?.points || 0}</div>
            <div style={{ fontSize:11, color:'rgba(232,231,227,.4)', textTransform:'uppercase', letterSpacing:'.08em' }}>ТОП баллов</div>
            {myRank > 0 && <div style={{ fontSize:12, color:'rgba(232,231,227,.4)', marginTop:2 }}>#{myRank} в рейтинге</div>}
          </div>
        </div>

        {/* Progress bar */}
        {nextLv && (
          <div style={{ padding:'12px 20px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'rgba(232,231,227,.4)', marginBottom:5 }}>
              <span>{lv.label}</span>
              <span>{nextLv.min - (user?.points||0)} до {nextLv.label}</span>
            </div>
            <div style={{ height:6, borderRadius:999, background:'rgba(255,255,255,.1)', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${progress}%`, borderRadius:999, background:'linear-gradient(90deg,#f53d2d,#c42b1c)', transition:'width .5s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, padding:'12px 12px 0' }}>
        {[
          {label:'Идей', value:ideas, icon:'💡'},
          {label:'Рисков', value:risks, icon:'⚠️'},
          {label:'Лайков', value:totalLikes, icon:'❤️'},
          {label:'Решено', value:completed, icon:'✅'},
        ].map(({label,value,icon}) => (
          <div key={label} style={{ background:'var(--bg2)', border:'1px solid var(--bd)', borderRadius:10, padding:'10px 6px', textAlign:'center' }}>
            <div style={{ fontSize:18 }}>{icon}</div>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)' }}>{value}</div>
            <div style={{ fontSize:9, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="no-scrollbar" style={{ display:'flex', overflowX:'auto', padding:'12px 12px 0', gap:6 }}>
        {[['stats','⚙️ Профиль'],['leaderboard','🏆 Рейтинг'],['achievements','🏅 Достижения'],['training','🎓 Тренинг']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flexShrink:0, padding:'7px 14px', borderRadius:20,
            border:`1.5px solid ${tab===t?'var(--red)':'var(--bd)'}`,
            background: tab===t?'rgba(245,61,45,.1)':'var(--bg3)',
            color: tab===t?'var(--red)':'var(--t2)',
            fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
          }}>{l}</button>
        ))}
      </div>

      <div style={{ padding:12 }}>
        {loading ? <LoadingDots /> : (
          <>
            {tab==='stats' && <StatsTab user={user} isDark={isDark} toggleDark={toggleDark} onLogout={onLogout} showReferral={() => setShowReferral(true)} showToast={showToast} updateUser={updateUser} onShowDailyTasks={onShowDailyTasks} dailyDone={dailyDone} />}
            {tab==='leaderboard' && <LeaderboardTab leaderboard={leaderboard} user={user} />}
            {tab==='achievements' && <AchievementsTab achievements={achievements} user={user} myPosts={myPosts} />}
            {tab==='training' && <TrainingTab user={user} onComplete={handleTrainingComplete} />}
          </>
        )}
      </div>

      {showReferral && <ReferralModal user={user} onClose={() => setShowReferral(false)} showToast={showToast} />}
    </div>
  )
}

// ── AVATAR UPLOAD ─────────────────────────────────────────────────────────────
function AvatarUpload({ user, updateUser, showToast }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5*1024*1024) { showToast('Файл слишком большой (макс. 5МБ)','error'); return }
    setUploading(true)
    try {
      const resized = await resizeImage(file, 400, 400)
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `avatars/${user.empId}.${ext}`
      const { error } = await supabase.storage.from('media').upload(path, resized, { upsert:true, contentType:file.type })
      if (error) throw error
      const { data:{ publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
      const url = `${publicUrl}?t=${Date.now()}`
      await supabase.from('users').update({ profile_pic:url }).eq('id', user.empId)
      updateUser({ profilePic:url })
      showToast('✅ Фото обновлено!')
    } catch (err) { showToast('Ошибка: '+err.message,'error') }
    setUploading(false)
  }

  async function removePic() {
    if (!confirm('Удалить фото?')) return
    await supabase.from('users').update({ profile_pic:null }).eq('id', user.empId)
    updateUser({ profilePic:null }); showToast('Фото удалено')
  }

  const size = 96

  return (
    <div style={{ position:'relative', flexShrink:0 }}>
      {/* Avatar */}
      <div style={{ position:'relative', width:size, height:size }}>
        {user?.profilePic
          ? <img src={user.profilePic} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', border:'3px solid rgba(255,255,255,.2)', display:'block' }} />
          : <div style={{ width:size, height:size, borderRadius:'50%', background:avatarColor(user?.name||''), display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, fontWeight:800, color:'#fff', border:'3px solid rgba(255,255,255,.2)' }}>
              {initials(user?.name||'?')}
            </div>
        }
        {user?.isTrained && (
          <div style={{ position:'absolute', bottom:2, right:2, width:24, height:24, borderRadius:'50%', background:'#22c55e', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid var(--navy)' }}>
            <svg width="12" height="12" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
          </div>
        )}
        {/* Upload overlay */}
        <div onClick={() => !uploading && inputRef.current?.click()} style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(0,0,0,.5)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', opacity:0, transition:'opacity .2s' }}
          onMouseOver={e=>e.currentTarget.style.opacity='1'} onMouseOut={e=>e.currentTarget.style.opacity='0'}>
          {uploading
            ? <div className="anim-spin" style={{ width:22, height:22, border:'2px solid #fff', borderTopColor:'transparent', borderRadius:'50%' }} />
            : <>
                <svg width="20" height="20" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" strokeWidth="2"/></svg>
                <span style={{ fontSize:9, color:'#fff', marginTop:2 }}>Изменить</span>
              </>
          }
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display:'none' }} />
      {user?.profilePic && (
        <button onClick={removePic} style={{ position:'absolute', top:-4, right:-4, width:22, height:22, borderRadius:'50%', background:'#ef4444', border:'2px solid var(--navy)', color:'#fff', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
      )}
    </div>
  )
}

function resizeImage(file, maxW, maxH) {
  return new Promise(resolve => {
    const img = new Image(), url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(maxW/img.width, maxH/img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width*scale); canvas.height = Math.round(img.height*scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => resolve(blob), file.type, 0.85)
    }
    img.src = url
  })
}

// ── STATS TAB ─────────────────────────────────────────────────────────────────
function StatsTab({ user, isDark, toggleDark, onLogout, showReferral, showToast, updateUser, onShowDailyTasks, dailyDone }) {
  const [editMode, setEditMode] = useState(false)
  const [phone, setPhone] = useState(user?.phone||'')
  const [email, setEmail] = useState(user?.email||'')
  const [saving, setSaving] = useState(false)

  async function saveProfile() {
    setSaving(true)
    await supabase.from('users').update({ phone, email }).eq('id', user.empId)
    updateUser({ phone, email }); setEditMode(false); showToast('✅ Сохранено')
    setSaving(false)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Daily tasks button */}
      {onShowDailyTasks && (
        <button onClick={onShowDailyTasks} style={{
          width:'100%', padding:'12px 16px', borderRadius:10,
          border:`1.5px solid ${dailyDone?'rgba(34,197,94,.3)':'rgba(245,61,45,.2)'}`,
          background: dailyDone?'rgba(34,197,94,.06)':'rgba(245,61,45,.06)',
          color:'var(--t1)', fontSize:14, fontWeight:700, cursor:'pointer', textAlign:'left',
          display:'flex', alignItems:'center', gap:10,
        }}>
          <span style={{ fontSize:22 }}>🎯</span>
          <div>
            <div>Ежедневные задачи</div>
            <div style={{ fontSize:11, color:'var(--t3)', fontWeight:400, marginTop:1 }}>
              {dailyDone ? '✅ Все выполнены сегодня!' : 'Выполняй задачи, получай ТОП'}
            </div>
          </div>
          <span style={{ marginLeft:'auto', fontSize:12, color:'var(--t4)' }}>›</span>
        </button>
      )}

      {/* Contact info */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--bd)', borderRadius:10, overflow:'hidden' }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bd)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.05em' }}>Контактные данные</span>
          <button onClick={() => setEditMode(!editMode)} style={{ background:'none', border:'none', fontSize:12, color:'var(--acc)', fontWeight:700, cursor:'pointer' }}>
            {editMode ? 'Отмена' : '✏️ Изменить'}
          </button>
        </div>
        <div style={{ padding:14 }}>
          {[['Табельный',user?.empId],['ФИО',user?.name],['Участок',user?.department]].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--bg3)' }}>
              <span style={{ fontSize:12, color:'var(--t3)' }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{v}</span>
            </div>
          ))}
          {editMode ? (
            <>
              {[['Телефон',phone,setPhone],['Email',email,setEmail]].map(([l,v,set]) => (
                <div key={l} style={{ marginTop:8 }}>
                  <label style={{ fontSize:11, color:'var(--t3)', display:'block', marginBottom:3 }}>{l}</label>
                  <input value={v} onChange={e=>set(e.target.value)} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--bd)', borderRadius:6, background:'var(--bg3)', color:'var(--t1)', fontSize:13, outline:'none' }} />
                </div>
              ))}
              <button onClick={saveProfile} disabled={saving} style={{ width:'100%', marginTop:10, padding:9, borderRadius:6, border:'none', background:'var(--red)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {saving?'Сохранение…':'Сохранить'}
              </button>
            </>
          ) : (
            <>
              {[['Телефон',user?.phone||'—'],['Email',user?.email||'—'],['Telegram',user?.telegramUsername?`@${user.telegramUsername}`:'—']].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--bg3)' }}>
                  <span style={{ fontSize:12, color:'var(--t3)' }}>{l}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{v}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      {[
        {label:'🎁 Реферальная программа', action:showReferral},
        {label:isDark?'☀️ Светлая тема':'🌙 Тёмная тема', action:toggleDark},
        {label:'🚪 Выйти', action:onLogout, danger:true},
      ].map(({label,action,danger}) => (
        <button key={label} onClick={action} style={{
          width:'100%', padding:'13px 16px', borderRadius:10,
          border:`1px solid ${danger?'#fecaca':'var(--bd)'}`,
          background: danger?'#fef2f2':'var(--bg2)',
          color: danger?'#ef4444':'var(--t1)',
          fontSize:14, fontWeight:700, cursor:'pointer', textAlign:'left',
        }}>{label}</button>
      ))}
    </div>
  )
}

function InfoRow({label,value}) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--bg3)' }}>
      <span style={{ fontSize:12, color:'var(--t3)' }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{value}</span>
    </div>
  )
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────
function LeaderboardTab({ leaderboard, user }) {
  const medals = ['🥇','🥈','🥉']
  return (
    <div>
      {leaderboard.map((u, i) => {
        const isMe = u.id === user?.empId
        const lv = lvlInfo(u.points || 0)
        return (
          <div key={u.id} style={{
            display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10,
            border:`1px solid ${isMe?'var(--red)':'var(--bd)'}`, marginBottom:6,
            background:i===0?'rgba(251,191,36,.08)':i===1?'rgba(156,163,175,.08)':i===2?'rgba(249,115,22,.08)':'var(--bg3)',
            borderLeft:`3px solid ${isMe?'var(--red)':'transparent'}`,
          }}>
            <div style={{ fontSize:i<3?22:14, fontWeight:700, color:'var(--t3)', width:28, textAlign:'center', flexShrink:0 }}>{i<3?medals[i]:`#${i+1}`}</div>
            {u.profile_pic
              ? <img src={u.profile_pic} style={{ width:36,height:36,borderRadius:'50%',objectFit:'cover',flexShrink:0 }} />
              : <div style={{ width:36,height:36,borderRadius:'50%',background:avatarColor(u.name),display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:12,flexShrink:0 }}>{initials(u.name)}</div>
            }
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:isMe?'var(--red)':'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}{isMe?' (Вы)':''}</div>
              <div style={{ fontSize:11, color:'var(--t3)' }}>{u.department}</div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--red)' }}>{u.points||0}</div>
              <span className={`level-badge ${lv.cls}`} style={{ fontSize:9, padding:'1px 6px', borderRadius:999, display:'inline-block' }}>{lv.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── ACHIEVEMENTS ──────────────────────────────────────────────────────────────
function AchievementsTab({ achievements, user, myPosts }) {
  const completed = user?.completedAchievements || []
  const myLikes = myPosts.reduce((s,p) => s+(p.likes||0), 0)

  function getProgress(ach) {
    const target = ach.target || 1
    let val = 0
    if (ach.target_type==='posts') val = myPosts.length
    if (ach.target_type==='ideas') val = myPosts.filter(p=>p.type==='idea').length
    if (ach.target_type==='risks') val = myPosts.filter(p=>p.type==='risk').length
    if (ach.target_type==='likes') val = myLikes
    if (ach.target_type==='points') val = user?.points||0
    return { pct:Math.min(100,Math.round((val/target)*100)), val, target }
  }

  return (
    <div>
      {achievements.map(ach => {
        const isDone = completed.includes(ach.id)
        const { pct, val, target } = getProgress(ach)
        return (
          <div key={ach.id} style={{
            display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10,
            border:`1px solid ${isDone?'rgba(34,197,94,.3)':'var(--bd)'}`,
            marginBottom:7, background:isDone?'rgba(34,197,94,.05)':'var(--bg3)',
          }}>
            <div style={{ fontSize:28, width:36, textAlign:'center', flexShrink:0 }}>{isDone?ach.icon||'🏅':'🔒'}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                <div style={{ fontSize:13, fontWeight:700, color:isDone?'var(--t1)':'var(--t2)' }}>{ach.title}</div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--acc)', flexShrink:0 }}>+{ach.points} ТОП</div>
              </div>
              {ach.description && <div style={{ fontSize:11, color:'var(--t3)', marginBottom:5 }}>{ach.description}</div>}
              <div style={{ height:4, borderRadius:999, background:'var(--bd)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, borderRadius:999, background:isDone?'#22c55e':'linear-gradient(90deg,#f53d2d,#c42b1c)', transition:'width .5s' }} />
              </div>
              <div style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>{isDone?'✅ Выполнено':`${val} / ${target} (${pct}%)`}</div>
            </div>
          </div>
        )
      })}
      {achievements.length===0 && <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--t3)' }}>Достижения не настроены</div>}
    </div>
  )
}

// ── TRAINING ──────────────────────────────────────────────────────────────────
function TrainingTab({ user, onComplete }) {
  const [answers, setAnswers] = useState({})
  if (user?.isTrained) return (
    <div style={{ textAlign:'center', padding:'40px 20px' }}>
      <div style={{ fontSize:56, marginBottom:12 }}>🎓</div>
      <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)' }}>Тренинг пройден!</div>
      <div style={{ fontSize:13, color:'var(--t3)', marginTop:6 }}>Вы прошли обучение по системе безопасности</div>
    </div>
  )
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--bd)', borderRadius:10, padding:14 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)', marginBottom:10 }}>📚 Инструкция</div>
        <div style={{ fontSize:13, color:'var(--t2)', lineHeight:1.7 }}>
          <p style={{ marginBottom:8 }}><strong>💡 Идея</strong> — предложение по улучшению рабочих процессов или условий труда.</p>
          <p style={{ marginBottom:8 }}><strong>⚠️ Риск</strong> — обнаруженная опасность или нарушение требований безопасности.</p>
          <p><strong>🏆 ТОП</strong> — за каждую публикацию начисляются баллы. Копите и повышайте уровень!</p>
        </div>
      </div>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--bd)', borderRadius:10, padding:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', marginBottom:14 }}>📝 Тест (+40 ТОП)</div>
        {[
          { q:'1. Какой тип заявки для предложения улучшений?', key:'tq1', opts:[['risk','⚠️ Риск'],['idea','💡 Идея']] },
          { q:'2. Где посмотреть баллы и уровень?', key:'tq2', opts:[['feed','📋 Лента'],['profile','👤 Профиль']] },
        ].map(({ q, key, opts }) => (
          <div key={key} style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, color:'var(--t1)', fontWeight:600, marginBottom:8 }}>{q}</div>
            {opts.map(([v,l]) => (
              <label key={v} onClick={() => setAnswers(a=>({...a,[key]:v}))} style={{
                display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--t2)',
                cursor:'pointer', marginBottom:8, padding:'10px 12px', borderRadius:8,
                background:answers[key]===v?'rgba(245,61,45,.08)':'var(--bg3)',
                border:`1.5px solid ${answers[key]===v?'var(--red)':'var(--bd)'}`, transition:'.2s',
              }}>
                <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${answers[key]===v?'var(--red)':'var(--bd)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {answers[key]===v && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--red)' }} />}
                </div>
                {l}
              </label>
            ))}
          </div>
        ))}
        <button onClick={() => onComplete(answers)} disabled={!answers.tq1||!answers.tq2}
          style={{ width:'100%', padding:13, borderRadius:10, border:'none', background:'var(--red)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', opacity:(!answers.tq1||!answers.tq2)?.5:1, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.06em', textTransform:'uppercase' }}>
          ✅ Завершить тест +40 ТОП
        </button>
      </div>
    </div>
  )
}

// ── REFERRAL MODAL ────────────────────────────────────────────────────────────
function ReferralModal({ user, onClose, showToast }) {
  const refCode = `REF_${user?.empId}`
  async function copy() {
    try { await navigator.clipboard.writeText(refCode) }
    catch { const el=document.createElement('textarea'); el.value=refCode; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el) }
    showToast('Код скопирован!')
  }
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div className="slide-up" style={{ background:'var(--bg2)', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:440, padding:24, borderTop:'3px solid var(--red)' }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🎁</div>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)' }}>Пригласи коллегу!</div>
          <div style={{ fontSize:13, color:'var(--t3)', marginTop:6 }}>За каждого коллегу — <strong style={{ color:'var(--acc)' }}>+50 ТОП</strong></div>
        </div>
        <div style={{ background:'var(--bg3)', borderRadius:14, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', marginBottom:6 }}>Твой реферальный код</div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, fontSize:20, fontWeight:800, color:'var(--acc)', fontFamily:'monospace', letterSpacing:'.1em' }}>{refCode}</div>
            <button onClick={copy} style={{ padding:'8px 14px', borderRadius:10, background:'var(--red)', color:'#fff', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}>Копировать</button>
          </div>
        </div>
        <button onClick={onClose} style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid var(--bd)', background:'var(--bg3)', color:'var(--t2)', fontSize:14, fontWeight:700, cursor:'pointer' }}>Закрыть</button>
      </div>
    </div>
  )
}
