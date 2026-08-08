import { useEffect, useState } from 'react'
import { BUILDING_STATS, capacity, KINGDOMS, population, reservedPopulation, UNIT_STATS } from './game'
import type { Difficulty, Kingdom, UnitType } from './game'
import { GameCanvas, MiniMap } from './GameCanvas'
import { useGameStore } from './store'
/* istanbul ignore next */
// Expose store for test introspection when running under E2E test bridge.
if (typeof window !== 'undefined') {
  // @ts-expect-error test bridge
  window.__useGameStore__ = useGameStore
  // @ts-expect-error test bridge
  if (window.__RTS_TEST_TIMESCALE__) useGameStore.setState({})
}
import './App.css'

const labels = { food: 'طعام', wood: 'خشب', stone: 'حجر', gold: 'ذهب' } as const
const unitLabel: Record<UnitType, string> = { worker: 'عامل', swordsman: 'مقاتل', archer: 'رامٍ', cavalry: 'فارس', commander: 'قائد' }
const buildingLabel: Record<string, string> = { headquarters: 'المقر الرئيسي', barracks: 'ثكنة', stable: 'إسطبل', farm: 'مزرعة', storage: 'مخزن', watchtower: 'برج مراقبة', wall: 'سور' }

function Menu() {
  const state = useGameStore()
  const [kingdom, setKingdom] = useState<Kingdom>(state.kingdom)
  const [difficulty, setDifficulty] = useState<Difficulty>(state.difficulty)
  const [hasSave] = useState(() => Boolean(localStorage.getItem('dragon-kingdoms-save')))
  return (
    <main className="menu">
      <div className="brand-mark">✦</div>
      <p className="eyebrow">ممالك السهول الثلاث</p>
      <h1>ممالك التنين</h1>
      <p className="subtitle">حرب السهول</p>
      <section className="menu-card">
        <h2>اختر مملكتك</h2>
        <div className="kingdoms">
          {(Object.keys(KINGDOMS) as Kingdom[]).map((key) => (
            <button key={key} className={`kingdom ${kingdom === key ? 'active' : ''}`} style={{ '--kingdom': `#${KINGDOMS[key].color.toString(16).padStart(6, '0')}` } as React.CSSProperties} onClick={() => setKingdom(key)}>
              <strong>{KINGDOMS[key].name}</strong>
              <span>{KINGDOMS[key].description}</span>
              <small>{KINGDOMS[key].bonuses}</small>
            </button>
          ))}
        </div>
        <h2>مستوى الخصم</h2>
        <div className="difficulty">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((key) => (
            <button key={key} className={difficulty === key ? 'active' : ''} onClick={() => setDifficulty(key)}>
              {key === 'easy' ? 'سهل' : key === 'medium' ? 'متوسط' : 'صعب'}
            </button>
          ))}
        </div>
        <button className="primary" onClick={() => { state.setSetup(kingdom, difficulty); state.start() }}>ابدأ المعركة</button>
        {hasSave && <button className="secondary" onClick={() => state.load()}>متابعة اللعبة</button>}
        <p className="hint">نسخة أصلية بالكامل — الرسومات والأصوات مولدة برمجياً</p>
      </section>
    </main>
  )
}

function SettingsPanel() {
  const state = useGameStore()
  if (!state.showSettings) return null
  return (
    <div className="settings-panel">
      <h3>الإعدادات</h3>
      <label>سرعة الكاميرا<input type="range" min={200} max={1200} step={20} value={state.settings.cameraSpeed} onChange={(e) => state.updateSettings({ cameraSpeed: Number(e.target.value) })} /></label>
      <label>مستوى المؤثرات<input type="range" min={0} max={1} step={0.05} value={state.settings.soundVolume} onChange={(e) => state.updateSettings({ soundVolume: Number(e.target.value) })} /></label>
      <label>مستوى الموسيقى<input type="range" min={0} max={1} step={0.05} value={state.settings.musicVolume} onChange={(e) => state.updateSettings({ musicVolume: Number(e.target.value) })} /></label>
      <label className="row"><input type="checkbox" checked={state.settings.muted} onChange={(e) => state.updateSettings({ muted: e.target.checked })} /> كتم الصوت</label>
      <button className="secondary" onClick={state.toggleSettings}>إغلاق</button>
    </div>
  )
}

function SelectedPanel() {
  const state = useGameStore()
  const selected = state.selectedIds[0]
  const unit = state.units.find((u) => u.id === selected)
  const building = state.buildings.find((b) => b.id === selected)
  const groupCount = state.selectedIds.length

  if (unit) {
    const stats = UNIT_STATS[unit.type]
    return (
      <>
        <div className="selected-card">
          <div className="avatar">⚔</div>
          <strong>{unitLabel[unit.type]}{groupCount > 1 ? ` ×${groupCount}` : ''}</strong>
          <span>الصحة {Math.floor(unit.health)} / {stats.maxHealth}</span>
          <span>الضرر {stats.damage} · المدى {stats.range} · الحالة {unit.state}</span>
        </div>
      </>
    )
  }
  if (building) {
    const stats = BUILDING_STATS[building.type]
    return (
      <>
        <div className="selected-card">
          <div className="avatar">⌂</div>
          <strong>{buildingLabel[building.type]}</strong>
          <span>الصحة {Math.floor(building.health)} / {stats.maxHealth}</span>
          {building.progress < 1 && <span>قيد البناء {Math.floor(building.progress * 100)}٪</span>}
        </div>
        {building.faction === 'player' && building.progress < 1 && (
          <button className="secondary" onClick={() => state.cancelConstruction(building.id)}>إلغاء البناء — استرداد 75٪</button>
        )}
        {building.faction === 'player' && building.progress >= 1 && building.type !== 'headquarters' && (
          <button className="secondary danger-btn" onClick={() => state.demolish(building.id)}>هدم (Delete مرتين)</button>
        )}
        {building.faction === 'player' && building.type === 'headquarters' && building.progress >= 1 && (
          <div className="commands">
            <h3>التقنيات</h3>
            {(['weapons1', 'armor1', 'gathering1'] as const).map((id) => (
              <button key={id} onClick={() => state.research(id)} disabled={state.researchedUpgrades.includes(id) || Boolean(state.activeResearch)}>
                {id === 'weapons1' ? 'أسلحة I' : id === 'armor1' ? 'درع I' : 'جمع I'}
                <small>{state.researchedUpgrades.includes(id) ? 'مكتملة' : state.activeResearch === id ? `بحث ${Math.floor(state.researchProgress)}ث` : 'بحث'}</small>
              </button>
            ))}
          </div>
        )}
        {building.faction === 'player' && building.type !== 'headquarters' && building.progress >= 1 && (
          <div className="commands">
            <h3>الإنتاج</h3>
            {(Object.keys(unitLabel) as UnitType[])
              .filter((type) => (building.type === 'barracks' ? type === 'swordsman' || type === 'archer' : building.type === 'stable' && type === 'cavalry'))
              .map((type) => {
                const cost = UNIT_STATS[type].cost
                return (
                  <button key={type} onClick={() => state.train(building.id, type)}>
                    {unitLabel[type]}
                    <small>{[cost.food ? `${cost.food} طعام` : '', cost.wood ? `${cost.wood} خشب` : '', cost.gold ? `${cost.gold} ذهب` : ''].filter(Boolean).join(' · ')}</small>
                  </button>
                )
              })}
            {building.queue.length > 0 && (
              <p className="queue-line">الطابور: {building.queue.map((q) => unitLabel[q]).join('، ')} — {Math.floor(Math.min(1, (building.queueProgress ?? 0) / 8) * 100)}٪</p>
            )}
          </div>
        )}
        {building.faction === 'player' && building.progress >= 1 && building.health < stats.maxHealth && (
          <button className="secondary" onClick={() => state.orderRepair(building.id)}>إصلاح (عامل)</button>
        )}
      </>
    )
  }
  return (
    <div className="commands">
      <h3>بناء</h3>
      {(['farm', 'barracks', 'stable', 'storage', 'watchtower', 'wall'] as const).map((type) => (
        <button key={type} onClick={() => state.beginPlacement(type)}>
          {buildingLabel[type]}
          <small>{[BUILDING_STATS[type].cost.wood ? `${BUILDING_STATS[type].cost.wood} خشب` : '', BUILDING_STATS[type].cost.stone ? `${BUILDING_STATS[type].cost.stone} حجر` : '', BUILDING_STATS[type].cost.gold ? `${BUILDING_STATS[type].cost.gold} ذهب` : ''].filter(Boolean).join(' · ')}</small>
        </button>
      ))}
    </div>
  )
}

function Hud() {
  const state = useGameStore()
  const pop = population(state.units, 'player') + reservedPopulation(state.buildings, 'player')
  const cap = capacity(state.buildings, 'player')
  useEffect(() => {
    const timer = window.setInterval(() => { if (useGameStore.getState().phase === 'playing') useGameStore.getState().save() }, 120000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="resources">
          {(Object.keys(labels) as Array<keyof typeof labels>).map((key) => (
            <span key={key}><i className={`resource-dot ${key}`} />{labels[key]} <b>{Math.floor(state.resources[key])}</b></span>
          ))}
        </div>
        <div className="match-info">
          <span>السكان <b className={pop >= cap ? 'danger' : ''}>{pop} / {cap}</b></span>
          <span>الوقت {Math.floor(state.elapsed / 60).toString().padStart(2, '0')}:{Math.floor(state.elapsed % 60).toString().padStart(2, '0')}</span>
          <button onClick={state.save}>حفظ</button>
          <button onClick={state.load}>تحميل</button>
          <button onClick={state.toggleSettings}>إعدادات</button>
        </div>
      </header>
      <section className="viewport">
        <GameCanvas />
        <aside className="side-panel">
          <h3>المختار</h3>
          <SelectedPanel />
        </aside>
        <MiniMap />
        <SettingsPanel />
        <div className="alerts">{state.message && <button onClick={state.clearMessage}>{state.message}</button>}</div>
      </section>
      {state.phase !== 'playing' && (
        <div className="result">
          <div className="result-card">
            <span className="eyebrow">{state.phase === 'victory' ? 'انتصار' : 'هزيمة'}</span>
            <h2>{state.phase === 'victory' ? 'سقط مقر العدو' : 'سقط مقر مملكتك'}</h2>
            <button className="primary" onClick={state.start}>معركة جديدة</button>
            <button className="secondary" onClick={() => useGameStore.setState({ phase: 'menu' })}>العودة للقائمة</button>
          </div>
        </div>
      )}
    </main>
  )
}

export default function App() {
  return useGameStore((s) => s.phase) === 'menu' ? <Menu /> : <Hud />
}
