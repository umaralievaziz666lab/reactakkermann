import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { notifyUser } from '../../lib/telegram.js'

const TASKS = [
  { id:'login',   icon:'🌅', label:'Войти в приложение',      points:5,  type:'auto' },
  { id:'post',    icon:'📝', label:'Опубликовать заявку',      points:10, type:'manual', check: async (uid) => {
    const today = new Date(); today.setHours(0,0,0,0)
    const { count } = await supabase.from('requests').select('*',{count:'exact',head:true})
      .eq('author_id', uid).gte('created_at', today.toISOString())
    return count > 0
  }},
  { id:'like',    icon:'❤️', label:'Поставить лайк',           points:3,  type:'manual', check: async (uid) => {
    const today = new Date(); today.setHours(0,0,0,0)
    const { count } = await supabase.from('likes').select('*',{count:'exact',head:true})
      .eq('user_id', uid).gte('created_at', today.toISOString())
    return count > 0
  }},
  { id:'comment', icon:'💬', label:'Написать комментарий',     points:5,  type:'manual', check: async (uid) => {
    const today = new Date(); today.setHours(0,0,0,0)
    const { count } = await supabase.from('comments').select('*',{count:'exact',head:true})
      .eq('user_id', uid).gte('created_at', today.toISOString())
    return count > 0
  }},
  { id:'risk',    icon:'⚠️', label:'Сообщить о риске',         points:15, type:'manual', check: async (uid) => {
    const today = new Date(); today.setHours(0,0,0,0)
    const { count } = await supabase.from('requests').select('*',{count:'exact',head:true})
      .eq('author_id', uid).eq('type','risk').gte('created_at', today.toISOString())
    return count > 0
  }},
]

export default function DailyTasks({ user, updateUser, showToast, onClose }) {
  const [completed, setCompleted] = useState([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(null)

  useEffect(() => { checkTasks() }, [])

  async function checkTasks() {
    setLoading(true)
    // Get today's completed tasks from localStorage
    const todayKey = `daily_${user.empId}_${new Date().toDateString()}`
    const saved = JSON.parse(localStorage.getItem(todayKey) || '[]')
    const done = [...saved]

    // Auto-complete login task
    if (!done.includes('login')) {
      done.push('login')
      // Award points
      await awardPoints('login', 5)
    }

    // Check other tasks
    for (const task of TASKS.filter(t => t.type === 'manual')) {
      if (!done.includes(task.id) && task.check) {
        const isDone = await task.check(user.empId)
        if (isDone) done.push(task.id)
      }
    }

    localStorage.setItem(todayKey, JSON.stringify(done))
    setCompleted(done)
    setLoading(false)
  }

  async function awardPoints(taskId, pts) {
    try {
      const newPoints = (user.points || 0) + pts
      await supabase.from('users').update({ points: newPoints }).eq('id', user.empId)
      updateUser({ points: newPoints })
    } catch {}
  }

  async function claimTask(task) {
    if (completed.includes(task.id) || claiming) return
    setClaiming(task.id)

    // Check if task is done
    let isDone = false
    if (task.check) isDone = await task.check(user.empId)

    if (isDone) {
      await awardPoints(task.id, task.points)
      const todayKey = `daily_${user.empId}_${new Date().toDateString()}`
      const saved = JSON.parse(localStorage.getItem(todayKey) || '[]')
      saved.push(task.id)
      localStorage.setItem(todayKey, JSON.stringify(saved))
      setCompleted(prev => [...prev, task.id])
      showToast(`🎯 +${task.points} ТОП за "${task.label}"!`, 'success')

      // Check if all tasks done
      const allDone = TASKS.every(t => [...completed, task.id].includes(t.id))
      if (allDone) {
        await awardPoints('bonus', 20)
        showToast('🎉 Все задачи выполнены! Бонус +20 ТОП!', 'success')
        await notifyUser(supabase, user.empId, '🎉 Все ежедневные задачи!', 'Вы выполнили все задачи дня и получили бонус +20 ТОП!', 'daily_task')
      }
    } else {
      showToast(`Сначала выполни: ${task.label}`, 'error')
    }
    setClaiming(null)
  }

  const totalPts = TASKS.reduce((s, t) => completed.includes(t.id) ? s + t.points : s, 0)
  const maxPts = TASKS.reduce((s, t) => s + t.points, 0) + 20 // +20 bonus
  const progress = Math.round((completed.length / TASKS.length) * 100)
  const allDone = TASKS.every(t => completed.includes(t.id))

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div className="slide-up" style={{ background:'var(--bg2)', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:440, borderTop:'3px solid var(--red)', overflow:'hidden' }}>

        <div style={{ padding:'14px 16px', borderBottom:'2px solid var(--bd)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--navy)' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff', fontFamily:"'Barlow Condensed',sans-serif" }}>🎯 ЕЖЕДНЕВНЫЕ ЗАДАЧИ</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'rgba(232,231,227,.7)', cursor:'pointer' }}>×</button>
        </div>

        <div style={{ padding:16 }}>
          {/* Progress */}
          <div style={{ background:'var(--bg3)', borderRadius:12, padding:14, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>
                {allDone ? '🎉 Все задачи выполнены!' : `Выполнено ${completed.length} из ${TASKS.length}`}
              </span>
              <span style={{ fontSize:14, fontWeight:800, color:'var(--red)' }}>+{totalPts} ТОП</span>
            </div>
            <div style={{ height:8, borderRadius:999, background:'var(--bd)', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${progress}%`, borderRadius:999, background:'linear-gradient(90deg,#f53d2d,#c42b1c)', transition:'width .5s' }} />
            </div>
            <div style={{ fontSize:10, color:'var(--t4)', marginTop:4 }}>
              Максимум за день: <strong>{maxPts} ТОП</strong> (включая бонус +20 за все задачи)
            </div>
          </div>

          {/* Tasks list */}
          {loading ? (
            <div style={{ textAlign:'center', padding:'20px 0', color:'var(--t3)' }}>Проверяем задачи…</div>
          ) : TASKS.map(task => {
            const isDone = completed.includes(task.id)
            const isClaiming = claiming === task.id
            return (
              <div key={task.id} style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'12px 14px', borderRadius:10, marginBottom:8,
                background: isDone ? 'rgba(34,197,94,.06)' : 'var(--bg3)',
                border:`1.5px solid ${isDone ? 'rgba(34,197,94,.25)' : 'var(--bd)'}`,
                transition:'.2s',
              }}>
                <div style={{ fontSize:24, flexShrink:0 }}>{task.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color: isDone ? '#16a34a' : 'var(--t1)', textDecoration: isDone ? 'line-through' : 'none' }}>
                    {task.label}
                  </div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>+{task.points} ТОП</div>
                </div>
                {isDone ? (
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="14" height="14" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                  </div>
                ) : (
                  <button onClick={() => claimTask(task)} disabled={!!claiming}
                    style={{ padding:'5px 12px', borderRadius:8, border:'none', background:'var(--red)', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', opacity:claiming?.6:1, flexShrink:0 }}>
                    {isClaiming ? '⏳' : 'Получить'}
                  </button>
                )}
              </div>
            )
          })}

          {/* Bonus task */}
          <div style={{
            display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10,
            background: allDone ? 'rgba(251,191,36,.08)' : 'var(--bg3)',
            border:`1.5px solid ${allDone ? 'rgba(251,191,36,.4)' : 'var(--bd)'}`,
          }}>
            <div style={{ fontSize:24, flexShrink:0 }}>🏆</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color: allDone ? '#d97706' : 'var(--t3)' }}>Выполнить все задачи</div>
              <div style={{ fontSize:11, color:'var(--t3)' }}>Бонус +20 ТОП</div>
            </div>
            {allDone && (
              <div style={{ width:28, height:28, borderRadius:'50%', background:'#f59e0b', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="14" height="14" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
              </div>
            )}
          </div>

          <div style={{ fontSize:11, color:'var(--t4)', textAlign:'center', marginTop:12 }}>
            🔄 Задачи обновляются каждый день в 00:00
          </div>
        </div>
      </div>
    </div>
  )
}
