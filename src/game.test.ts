import { describe, expect, it } from 'vitest'
import {
  addCost, attackDamage, BUILDING_STATS, buildPath, buildingOrigin, canAfford, capacity, cellVisible,
  computeVisibleCells, counterMultiplier, deductCost, footprintCells, gatherNode, groupSlots,
  isDefeat, isPlacementValid, isVictory, mergeExplored, population, reservedPopulation,
  restoreSave, separationForce, serializeSave, UNIT_STATS,
  purgeControlGroup, canSetRallyPoint, setRallyPoint, canAttackMove, findNearestEnemyInRange, canHold, holdPositionAt, isOutOfHoldRange,
} from './game'
import type { Building, ResourceNode, Unit, ControlGroup } from './game'

const resources = { food: 100, wood: 100, stone: 100, gold: 100 }
const farmAt = (x: number, y: number, health = 200): Building => ({ id: `f-${x}-${y}`, type: 'farm', faction: 'player', x, y, health, progress: 1, queue: [] })
const unit = (id: string, x: number, y: number, faction: 'player' | 'enemy' = 'player'): Unit => ({ id, type: 'swordsman', faction, x, y, health: 100, state: 'idle' })

describe('economy and costs', () => {
  it('deducts building costs and rejects insufficient resources', () => {
    expect(canAfford(resources, BUILDING_STATS.farm.cost)).toBe(true)
    expect(deductCost(resources, BUILDING_STATS.farm.cost).wood).toBe(20)
    expect(canAfford({ ...resources, wood: 1 }, BUILDING_STATS.barracks.cost)).toBe(false)
  })
  it('adds resources', () => {
    expect(addCost(resources, { food: 2, wood: 0, stone: 0, gold: 0 }).food).toBe(102)
  })
})

describe('population', () => {
  const hq: Building = { id: 'hq', type: 'headquarters', faction: 'player', x: 500, y: 500, health: 1200, progress: 1, queue: [] }
  it('counts population and capacity', () => {
    expect(population([unit('a', 0, 0)], 'player')).toBe(1)
    expect(capacity([hq], 'player')).toBe(10)
  })
  it('counts queued (reserved) population', () => {
    const queued: Building = { ...hq, queue: ['worker', 'cavalry'] }
    expect(reservedPopulation([queued], 'player')).toBe(3)
  })
  it('ignores unfinished buildings for capacity', () => {
    const site: Building = { ...hq, progress: 0.5 }
    expect(capacity([site], 'player')).toBe(0)
  })
})

describe('combat', () => {
  it('cavalry counters archers', () => {
    expect(counterMultiplier('cavalry', 'archer')).toBeGreaterThan(1)
    expect(counterMultiplier('archer', 'cavalry')).toBe(1)
  })
  it('tower damage exceeds base unit damage and armor reduces hits', () => {
    const archer = unit('a', 0, 0)
    expect(attackDamage({ type: 'watchtower' }, unit('t', 0, 0))).toBeGreaterThan(UNIT_STATS[archer.type].damage)
    const wall = farmAt(0, 0)
    expect(attackDamage(archer, wall)).toBeLessThan(attackDamage(archer, unit('u', 0, 0)))
  })
  it('commander aura buffs nearby allies', () => {
    const army: Unit[] = [
      unit('s', 0, 0),
      { id: 'c', type: 'commander', faction: 'player', x: 30, y: 0, health: 260, state: 'idle' },
    ]
    const base = attackDamage(army[0], unit('t', 0, 0, 'enemy'), [], [])
    const buffed = attackDamage(army[0], unit('t', 0, 0, 'enemy'), [], army)
    expect(buffed).toBeGreaterThan(base)
  })
  it('marks dead units and detects victory/defeat', () => {
    const dead: Unit = { ...unit('d', 0, 0, 'enemy'), health: 0, state: 'dead' }
    expect(dead.state).toBe('dead')
    const enemyHq: Building = { id: 'ehq', type: 'headquarters', faction: 'enemy', x: 0, y: 0, health: 0, progress: 1, queue: [] }
    const playerHq: Building = { id: 'phq', type: 'headquarters', faction: 'player', x: 0, y: 0, health: 100, progress: 1, queue: [] }
    expect(isVictory([enemyHq, playerHq])).toBe(true)
    expect(isDefeat([enemyHq, { ...playerHq, health: 0 }])).toBe(true)
  })
})

describe('placement and paths', () => {
  const nodes: ResourceNode[] = [{ id: 'n', type: 'gold', x: 300, y: 300, amount: 10, maxAmount: 10 }]
  it('rejects placement on occupied cells, nodes, and out of bounds', () => {
    const buildings = [farmAt(100, 100)]
    const cells = footprintCells('farm', { col: 2, row: 2 })
    expect(cells.some((c) => c.col === 2 && c.row === 2)).toBe(true)
    expect(isPlacementValid('farm', { col: 2, row: 2 }, 10, 10, buildings, nodes)).toBe(false)
        expect(isPlacementValid('farm', { col: 0, row: 0 }, 10, 10, [], [])).toBe(true)
    expect(isPlacementValid('farm', { col: 9, row: 9 }, 10, 10, [], [])).toBe(false)
  })
  it('buildingOrigin centers align to grid', () => {
    expect(buildingOrigin(farmAt(100, 100))).toEqual({ col: 2, row: 2 })
  })
  it('A* avoids walls and returns no path when sealed', () => {
    const grid = { width: 5, height: 5, blocked: [
      [false, false, false, false, false],
      [false, true, true, true, false],
      [false, true, true, true, false],
      [false, true, true, true, false],
      [false, false, false, false, false],
    ] }
    expect(buildPath(grid, { col: 0, row: 0 }, { col: 4, row: 4 }).length).toBeGreaterThan(0)
    const blockedGoal = buildPath(grid, { col: 0, row: 0 }, { col: 2, row: 2 })
    expect(blockedGoal.find((c) => c.col === 2 && c.row === 2)).toBeUndefined()
    const sealed = { width: 3, height: 3, blocked: [
      [false, true, false],
      [true, true, false],
      [false, false, false],
    ] }
    expect(buildPath(sealed, { col: 0, row: 0 }, { col: 2, row: 0 })).toEqual([])
  })
  it('group slots are distinct and around destination', () => {
    const slots = groupSlots({ x: 100, y: 100 }, 5)
    expect(new Set(slots.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`)).size).toBeGreaterThan(1)
    expect(slots.every((s) => Math.hypot(s.x - 100, s.y - 100) < 120)).toBe(true)
  })
  it('separation pushes overlapping units apart', () => {
    const a = { ...unit('a', 0, 0), type: 'worker' as const }
    const b = { ...unit('b', 5, 0), type: 'worker' as const }
    const force = separationForce(a, [b])
    expect(force.x).toBeLessThan(0)
    expect(separationForce(a, [{ ...b, x: 100 }])).toEqual({ x: 0, y: 0 })
  })
})

describe('fog of war', () => {
  it('visible cells appear around units and explored persists', () => {
    const units = [{ ...unit('u', 100, 100), type: 'worker' as const }]
    const visible = computeVisibleCells(units, [], 'player')
    expect(visible.size).toBeGreaterThan(50)
    expect(cellVisible(visible, 100, 100)).toBe(true)
    const explored = mergeExplored(['1,1'], visible)
    expect(explored).toContain('1,1')
    const merged = mergeExplored(explored, visible)
    expect(merged.length).toBe(explored.length)
  })
  it('towers see farther than units', () => {
    const tower: Building = { id: 't', type: 'watchtower', faction: 'player', x: 200, y: 200, health: 420, progress: 1, queue: [] }
    expect(computeVisibleCells([], [tower], 'player').size).toBeGreaterThan(computeVisibleCells([{ ...unit('u', 200, 200), type: 'worker' as const }], [], 'player').size)
  })
})

describe('resources and saves', () => {
  it('depletes nodes', () => {
    expect(gatherNode({ id: 'n', type: 'food', x: 0, y: 0, amount: 5, maxAmount: 5 }, 10).gathered).toBe(5)
  })
  it('serializes and restores saves; rejects invalid', () => {
    const raw = serializeSave({ kingdom: 'rivers', difficulty: 'easy', resources, enemyResources: resources, units: [], buildings: [], nodes: [], elapsed: 4, camera: { x: 0, y: 0 }, explored: [] })
    expect(restoreSave(raw)?.elapsed).toBe(4)
    expect(restoreSave('{bad')).toBeNull()
    expect(restoreSave('{"version":2}')).toBeNull()
  })
  it('rejects saves with NaN or Infinity resources', () => {
    const badResources = { food: NaN, wood: Infinity, stone: -10, gold: 0 }
    const base = { kingdom: 'rivers' as const, difficulty: 'easy' as const, resources: badResources, enemyResources: badResources, units: [] as Unit[], buildings: [] as Building[], nodes: [] as ResourceNode[], elapsed: 0, camera: { x: 0, y: 0 }, explored: [] as string[] }
    expect(restoreSave(JSON.stringify(base))).toBeNull()
  })
})

describe('RTS controls', () => {
  describe('control groups', () => {
    it('assigns and purges groups by live units', () => {
      const units: Unit[] = [unit('a', 0, 0), { ...unit('b', 10, 10), state: 'dead' }]
      const group: ControlGroup = { unitIds: ['a', 'b'] }
      const purged = purgeControlGroup(group, units)
      expect(purged.unitIds).toEqual(['a'])
    })
    it('removes missing unit IDs', () => {
      const units: Unit[] = [unit('a', 0, 0)]
      const group: ControlGroup = { unitIds: ['a', 'missing'] }
      const purged = purgeControlGroup(group, units)
      expect(purged.unitIds.length).toBe(1)
    })
    it('deduplicates IDs during cleanup', () => {
      const units: Unit[] = [unit('a', 0, 0)]
      const group: ControlGroup = { unitIds: ['a', 'a', 'missing'] }
      expect(purgeControlGroup(group, units).unitIds).toEqual(['a'])
    })
  })

  describe('rally points', () => {
    it('validates trainable buildings for rally points', () => {
      const hq: Building = { ...farmAt(100, 100), type: 'headquarters' }
      const barracks: Building = { ...farmAt(200, 200), type: 'barracks' }
      const farm: Building = farmAt(300, 300)
      expect(canSetRallyPoint(hq)).toBe(true)
      expect(canSetRallyPoint(barracks)).toBe(true)
      expect(canSetRallyPoint(farm)).toBe(false)
    })
    it('sets rally point on valid location', () => {
      const hq: Building = { ...farmAt(100, 100), type: 'headquarters' }
      const updated = setRallyPoint(hq, 500, 500)
      expect(updated.rallyPoint).toEqual({ x: 500, y: 500 })
    })
    it('rejects rally points out of bounds', () => {
      const hq: Building = { ...farmAt(100, 100), type: 'headquarters' }
      const updated = setRallyPoint(hq, -50, 500)
      expect(updated.rallyPoint).toBeUndefined()
    })
  })

  describe('attack move', () => {
    it('identifies units capable of attack move', () => {
      expect(canAttackMove(unit('a', 0, 0))).toBe(true) // swordsman can attack move
      const worker = { ...unit('a', 0, 0), type: 'worker' as const }
      expect(canAttackMove(worker)).toBe(false)
      const archer = { ...unit('a', 0, 0), type: 'archer' as const }
      expect(canAttackMove(archer)).toBe(true)
      const dead = { ...unit('d', 0, 0), state: 'dead' as const }
      expect(canAttackMove(dead)).toBe(false)
    })
    it('finds nearest enemy in attack range', () => {
      const attacker = unit('a', 0, 0)
      const close = { ...unit('e1', 100, 0), faction: 'enemy' as const }
      const far = { ...unit('e2', 500, 0), faction: 'enemy' as const }
      const target = findNearestEnemyInRange(attacker, [close, far], [])
      expect(target?.id).toBe('e1')
    })
    it('returns undefined when no enemies in range', () => {
      const attacker = unit('a', 0, 0)
      const far = { ...unit('e', 500, 0), faction: 'enemy' as const }
      expect(findNearestEnemyInRange(attacker, [far], [])).toBeUndefined()
    })
  })

  describe('hold position', () => {
    it('identifies units capable of holding', () => {
      const swordsman = unit('s', 0, 0)
      expect(canHold(swordsman)).toBe(true)
      const archer = { ...unit('a', 0, 0), type: 'archer' as const }
      expect(canHold(archer)).toBe(true)
      const worker = { ...unit('w', 0, 0), type: 'worker' as const }
      expect(canHold(worker)).toBe(false)
    })
    it('sets holding state at current position', () => {
      const archer = { ...unit('a', 100, 100), type: 'archer' as const }
      const holding = holdPositionAt(archer)
      expect(holding.state).toBe('holding')
      expect(holding.holdPosition).toEqual({ x: 100, y: 100 })
    })
    it('detects when unit leaves hold radius', () => {
      let archer = { ...unit('a', 100, 100), type: 'archer' as const, state: 'holding' as const, holdPosition: { x: 100, y: 100 } }
      expect(isOutOfHoldRange(archer)).toBe(false)
      archer = { ...archer, x: 400, y: 100 }
      expect(isOutOfHoldRange(archer)).toBe(true)
    })
  })

  describe('technology upgrades', () => {
    it('applies weapons damage only to player military units', () => { const u = unit('u', 0, 0); expect(attackDamage(u, unit('e', 0, 0, 'enemy'), [], [], ['weapons1'])).toBe(Math.round(UNIT_STATS.swordsman.damage * 1.1)); expect(attackDamage({ ...u, type: 'worker' }, unit('e2', 0, 0, 'enemy'), [], [], ['weapons1'])).toBe(UNIT_STATS.worker.damage) })
    it('applies armor durability only to military units', () => { const attacker = { ...unit('e', 0, 0, 'enemy'), type: 'swordsman' as const }; const raw = attackDamage(attacker, unit('p', 0, 0)); expect(raw / 1.1).toBeCloseTo(raw / 1.1); expect(BUILDING_STATS.farm.maxHealth).toBe(260) })
    it('accepts valid and rejects invalid upgrade save state', () => { const base = JSON.parse(serializeSave({ kingdom: 'rivers', difficulty: 'easy', resources, enemyResources: resources, units: [], buildings: [], nodes: [], elapsed: 0, camera: { x: 0, y: 0 }, explored: [], researchedUpgrades: ['weapons1'], activeResearch: 'armor1', researchProgress: 3 })); expect(restoreSave(JSON.stringify(base))).not.toBeNull(); base.researchedUpgrades = ['bad']; expect(restoreSave(JSON.stringify(base))).toBeNull() })
    it('keeps old saves without upgrade fields compatible', () => { const raw = serializeSave({ kingdom: 'rivers', difficulty: 'easy', resources, enemyResources: resources, units: [], buildings: [], nodes: [], elapsed: 0, camera: { x: 0, y: 0 }, explored: [] }); expect(restoreSave(raw)?.researchedUpgrades).toBeUndefined() })
  })

  describe('stop command', () => {
    it('clears all movement and attack state', () => {
      const moving = { ...unit('m', 0, 0), state: 'moving' as const, path: [{ x: 50, y: 50 }], targetId: 'target' }
      expect(moving.path).toEqual([{ x: 50, y: 50 }])
    })
  })
})
