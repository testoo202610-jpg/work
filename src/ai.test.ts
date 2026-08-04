import { describe, expect, it } from 'vitest'
import { aiProfile, runAi } from './ai'
import { BUILDING_STATS, UNIT_STATS } from './game'
import type { Building, ResourceNode, Unit } from './game'

const hq: Building = { id: 'ehq', type: 'headquarters', faction: 'enemy', x: 1660, y: 520, health: 1200, progress: 1, queue: [] }
const worker = (id: string): Unit => ({ id, type: 'worker', faction: 'enemy', x: 1580, y: 580, health: UNIT_STATS.worker.maxHealth, state: 'idle' })
const nodes: ResourceNode[] = [
  { id: 'f', type: 'food', x: 1810, y: 350, amount: 1800, maxAmount: 1800 },
  { id: 'w', type: 'wood', x: 1510, y: 240, amount: 1600, maxAmount: 1600 },
  { id: 's', type: 'stone', x: 1880, y: 820, amount: 1400, maxAmount: 1400 },
  { id: 'g', type: 'gold', x: 1120, y: 980, amount: 1100, maxAmount: 1100 },
]
const base = { resources: { food: 500, wood: 400, stone: 400, gold: 300 }, buildings: [hq], nodes, elapsed: 10, playerBaseSeen: undefined, underAttack: false, idCounter: 1 }

describe('enemy AI', () => {
  it('assigns idle workers to gather across resource types', () => {
    const result = runAi({ ...base, difficulty: 'medium', units: [worker('a'), worker('b'), worker('c'), worker('d')] })
    const gathering = result.units.filter((u) => u.state === 'gathering').length
    expect(gathering).toBeGreaterThanOrEqual(3)
  })
  it('trains a worker when economy is small', () => {
    const result = runAi({ ...base, difficulty: 'medium', units: [worker('a')] })
    expect(result.buildings[0].queue).toContain('worker')
    expect(result.resources.food).toBeLessThan(500)
  })
  it('builds a farm before population is full', () => {
    const poppy: Unit[] = Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, type: 'swordsman' as const, faction: 'enemy' as const, x: 1500, y: 400, health: 100, state: 'idle' as const }))
    const result = runAi({ ...base, difficulty: 'medium', units: [worker('a'), ...poppy], elapsed: 5 })
    expect(result.buildings.some((b) => b.type === 'farm' && b.progress < 1)).toBe(true)
    expect(result.decisions).toContain('population headroom')
  })
  it('builds economy or military structures when time and resources allow', () => {
    const result = runAi({ ...base, difficulty: 'hard', units: [worker('a'), worker('b'), worker('c'), worker('d'), worker('e')], elapsed: 40 })
    expect(result.buildings.some((b) => b.type === 'barracks' || b.type === 'farm')).toBe(true)
  })
  it('defends when base under attack', () => {
    const army = Array.from({ length: 4 }, (_, i) => ({ id: `m${i}`, type: 'swordsman' as const, faction: 'enemy' as const, x: 1500, y: 400, health: 100, state: 'idle' as const }))
    const invader: Unit = { id: 'p1', type: 'swordsman', faction: 'player', x: 1600, y: 540, health: 100, state: 'idle' }
    const result = runAi({ ...base, difficulty: 'medium', units: [...army, worker('w')], underAttack: true, playerBaseSeen: { x: 520, y: 690 } })
    void invader
    expect(result.decisions).toContain('defend base')
    expect(result.units.filter((u) => u.state === 'attacking').length).toBeGreaterThanOrEqual(3)
  })
  it('scales profiles by difficulty', () => {
    expect(aiProfile('easy').thinkInterval).toBeGreaterThan(aiProfile('hard').thinkInterval)
    expect(aiProfile('hard').armyTarget).toBeGreaterThan(aiProfile('easy').armyTarget)
  })
  it('keeps building placement away from resource nodes', () => {
    const many = { ...base, difficulty: 'medium' as const, units: [worker('a')], elapsed: 100, buildings: [hq], resources: { food: 0, wood: 1000, stone: 1000, gold: 1000 } }
    const result = runAi(many)
    const placed = result.buildings.find((b) => b.id !== 'ehq')
    if (placed) {
      expect(Math.hypot(placed.x - 1810, placed.y - 350)).toBeGreaterThan(40 * 2)
      expect(BUILDING_STATS[placed.type].buildTime).toBeGreaterThan(0)
    }
  })
})
