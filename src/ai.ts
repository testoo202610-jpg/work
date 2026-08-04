import { addCost, BUILDING_STATS, buildPath, canAfford, capacity, deductCost, footprintCells, fromGrid, GRID_SIZE, isPlacementValid, MAP_COLS, MAP_ROWS, population, reservedPopulation, toGrid, UNIT_STATS } from './game'
import type { Building, BuildingType, Cost, Difficulty, Faction, Point, ResourceNode, ResourceType, Unit, UnitType } from './game'

export interface AiWorld {
  resources: Cost
  units: Unit[]
  buildings: Building[]
  nodes: ResourceNode[]
  elapsed: number
  difficulty: Difficulty
  playerBaseSeen?: Point
  underAttack: boolean
  idCounter: number
}
export interface AiResult {
  resources: Cost
  units: Unit[]
  buildings: Building[]
  decisions: string[]
  idCounter: number
}

interface Profile { thinkInterval: number; gatherRates: Record<ResourceType, number>; carryBonus: number; maxWorkers: number; armyTarget: number; attackGroup: number; buildLead: number }
const PROFILES: Record<Difficulty, Profile> = {
  easy: { thinkInterval: 2.6, gatherRates: { food: 9, wood: 7, stone: 6, gold: 5 }, carryBonus: 0, maxWorkers: 9, armyTarget: 6, attackGroup: 8, buildLead: 4 },
  medium: { thinkInterval: 1.5, gatherRates: { food: 13, wood: 11, stone: 9, gold: 8 }, carryBonus: 10, maxWorkers: 12, armyTarget: 10, attackGroup: 6, buildLead: 3 },
  hard: { thinkInterval: 1.0, gatherRates: { food: 17, wood: 14, stone: 12, gold: 10 }, carryBonus: 25, maxWorkers: 15, armyTarget: 14, attackGroup: 5, buildLead: 2 },
}
export const aiProfile = (difficulty: Difficulty): Profile => PROFILES[difficulty]

const workerCount = (units: Unit[], faction: Faction) => units.filter((u) => u.faction === faction && u.type === 'worker' && u.state !== 'dead').length
const military = (units: Unit[], faction: Faction) => units.filter((u) => u.faction === faction && u.state !== 'dead' && u.type !== 'worker')
const hasFinished = (buildings: Building[], faction: Faction, type: BuildingType) => buildings.some((b) => b.faction === faction && b.type === type && b.progress >= 1 && b.health > 0)

function desiredWorkforce(world: AiWorld): Partial<Record<ResourceType, number>> {
  const r = world.resources
  const want: Array<[ResourceType, number]> = [['food', 4], ['wood', 3], ['stone', 2], ['gold', 1]]
  if (r.gold < 120) want[3] = ['gold', 2]
  if (r.stone < 100) want[2] = ['stone', 3]
  const total = want.reduce((s, [, c]) => s + c, 0)
  const scale = Math.min(1, workerCount(world.units, 'enemy') / Math.max(1, total))
  const out: Partial<Record<ResourceType, number>> = {}
  want.forEach(([type, count]) => { out[type] = Math.max(0, Math.round(count * scale)) })
  return out
}

function assignWorkers(world: AiWorld): Unit[] {
  const desired = desiredWorkforce(world)
  const assignments = new Map<string, ResourceType>()
  const counts: Record<ResourceType, number> = { food: 0, wood: 0, stone: 0, gold: 0 }
  const profile = PROFILES[world.difficulty]
  const nodeFor = (type: ResourceType) => world.nodes.filter((n) => n.type === type && n.amount > 0).sort((a, b) => a.x - b.x)[0]
  const wantEntries = Object.entries(desired) as Array<[ResourceType, number]>
  let idle = 0
  return world.units.map((u) => {
    if (u.faction !== 'enemy' || u.type !== 'worker' || u.state === 'dead') return u
    let type = assignments.get(u.id) ?? (u.carrying as ResourceType | undefined)
    if (!type || (counts[type] ?? 0) >= (desired[type] ?? 0)) {
      type = undefined
      for (const [t, needed] of wantEntries) { if ((counts[t] ?? 0) < needed) { type = t; break } }
      if (!type) { idle++; type = undefined }
    }
    if (!type) {
      if (u.state === 'gathering' || u.state === 'returning') return u
      return idle > profile.maxWorkers ? u : { ...u, state: 'idle' as const, targetId: undefined, path: [] }
    }
    counts[type] = (counts[type] ?? 0) + 1
    assignments.set(u.id, type)
    const node = nodeFor(type)
    if (!node) return u
    if (u.state === 'building' || u.state === 'repairing') return u
    if ((u.state === 'gathering' || u.state === 'returning') && u.targetId) {
      const targetNode = world.nodes.find((n) => n.id === u.targetId)
      const targetDrop = world.buildings.find((b) => b.id === u.targetId)
      if (targetNode && targetNode.amount > 0 && targetNode.type === type) return u
      if (targetDrop) return u
    }
    return { ...u, state: 'gathering' as const, targetId: node.id, carryingAmount: 0, carrying: undefined, path: [] }
  })
}

function findSite(world: AiWorld, type: BuildingType, near: Point): Point | null {
  for (let ring = 2; ring < 16; ring++) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const candidate = { x: near.x + Math.cos(angle) * ring * GRID_SIZE, y: near.y + Math.sin(angle) * ring * GRID_SIZE }
      const origin = { col: Math.round(candidate.x / GRID_SIZE - BUILDING_STATS[type].footprint.width / 2), row: Math.round(candidate.y / GRID_SIZE - BUILDING_STATS[type].footprint.height / 2) }
      if (isPlacementValid(type, origin, MAP_COLS, MAP_ROWS, world.buildings, world.nodes)) {
        const snapped = fromGrid({ col: Math.round(candidate.x / GRID_SIZE), row: Math.round(candidate.y / GRID_SIZE) })
        const originSnap = { col: Math.round(snapped.x / GRID_SIZE - BUILDING_STATS[type].footprint.width / 2), row: Math.round(snapped.y / GRID_SIZE - BUILDING_STATS[type].footprint.height / 2) }
        if (isPlacementValid(type, originSnap, MAP_COLS, MAP_ROWS, world.buildings, world.nodes)) return snapped
      }
    }
  }
  return null
}

interface Plan { kind: 'build' | 'train' | 'attack' | 'scout'; building?: BuildingType; unit?: UnitType; reason: string }

function choosePlan(world: AiWorld): Plan | null {
  const profile = PROFILES[world.difficulty]
  const pop = population(world.units, 'enemy') + reservedPopulation(world.buildings, 'enemy')
  const cap = capacity(world.buildings, 'enemy')
  const army = military(world.units, 'enemy').length
  const hq = world.buildings.find((b) => b.faction === 'enemy' && b.type === 'headquarters' && b.health > 0)

  if (world.underAttack && army >= 3) return { kind: 'attack', reason: 'defend base' }
  if (cap > 0 && cap - pop <= profile.buildLead && canAfford(world.resources, BUILDING_STATS.farm.cost) && world.buildings.filter((b) => b.faction === 'enemy' && b.type === 'farm' && b.progress < 1).length === 0) return { kind: 'build', building: 'farm', reason: 'population headroom' }
  if (!hasFinished(world.buildings, 'enemy', 'barracks') && world.elapsed > 25 && canAfford(world.resources, BUILDING_STATS.barracks.cost) && !world.buildings.some((b) => b.faction === 'enemy' && b.type === 'barracks' && b.progress < 1)) return { kind: 'build', building: 'barracks', reason: 'military production' }
  if (hq && workerCount(world.units, 'enemy') < profile.maxWorkers && canAfford(world.resources, UNIT_STATS.worker.cost) && pop + UNIT_STATS.worker.population <= cap && hq.queue.length < 2) return { kind: 'train', unit: 'worker', reason: 'economy workers' }
  if (hasFinished(world.buildings, 'enemy', 'barracks') && !hasFinished(world.buildings, 'enemy', 'stable') && world.elapsed > 70 && canAfford(world.resources, BUILDING_STATS.stable.cost)) return { kind: 'build', building: 'stable', reason: 'cavalry unlock' }
  if (world.elapsed > 50 && !hasFinished(world.buildings, 'enemy', 'watchtower') && world.resources.stone > BUILDING_STATS.watchtower.cost.stone + 60 && canAfford(world.resources, BUILDING_STATS.watchtower.cost)) return { kind: 'build', building: 'watchtower', reason: 'base defense' }
  if (army < profile.armyTarget) {
    if (hasFinished(world.buildings, 'enemy', 'barracks')) {
      const options: UnitType[] = world.resources.gold > 60 ? ['swordsman', 'archer', 'archer'] : ['swordsman']
      for (const type of options) if (canAfford(world.resources, UNIT_STATS[type].cost) && pop + UNIT_STATS[type].population <= cap) return { kind: 'train', unit: type, reason: 'army growth' }
    }
    if (hasFinished(world.buildings, 'enemy', 'stable') && canAfford(world.resources, UNIT_STATS.cavalry.cost) && pop + 2 <= cap) return { kind: 'train', unit: 'cavalry', reason: 'army cavalry' }
    return null
  }
  if (!world.playerBaseSeen && world.elapsed > 60) return { kind: 'scout', reason: 'find player base' }
  if (army >= profile.attackGroup && world.playerBaseSeen) return { kind: 'attack', reason: 'assault' }
  return null
}

export function runAi(world: AiWorld): AiResult {
  const profile = PROFILES[world.difficulty]
  let resources = { ...world.resources }
  let units = assignWorkers(world)
  let buildings = world.buildings.map((b) => ({ ...b }))
  const decisions: string[] = []
  let idCounter = world.idCounter

  const hq = buildings.find((b) => b.faction === 'enemy' && b.type === 'headquarters' && b.health > 0)
  if (!hq) return { resources, units, buildings, decisions, idCounter }

  // Gathering trickle: workers deposit via real movement, but to keep bookkeeping simple each gathering worker credits fractional income.
  units.forEach((u) => {
    if (u.faction !== 'enemy' || u.type !== 'worker' || u.state !== 'gathering') return
    const node = world.nodes.find((n) => n.id === u.targetId)
    if (!node || node.amount <= 0) return
    const rate = profile.gatherRates[node.type] / 25
    resources = addCost(resources, { food: node.type === 'food' ? rate : 0, wood: node.type === 'wood' ? rate : 0, stone: node.type === 'stone' ? rate : 0, gold: node.type === 'gold' ? rate : 0 })
  })

  const plan = choosePlan({ ...world, units, buildings })
  if (!plan) return { resources, units, buildings, decisions, idCounter }

  if (plan.kind === 'build' && plan.building) {
    const site = findSite(world, plan.building, hq)
    const builder = units.find((u) => u.faction === 'enemy' && u.type === 'worker' && u.state !== 'dead' && u.state !== 'building')
    if (site && builder) {
      const id = `enemy-${plan.building}-${idCounter++}`
      buildings = [...buildings, { id, type: plan.building, faction: 'enemy', x: site.x, y: site.y, health: 1, progress: 0, queue: [], builderId: builder.id }]
      resources = deductCost(resources, BUILDING_STATS[plan.building].cost)
      units = units.map((u) => u.id === builder.id ? { ...u, state: 'building' as const, targetId: id, carryingAmount: 0, path: buildPath({ width: MAP_COLS, height: MAP_ROWS, blocked: gridFromBuildings(buildings) }, toGrid(u), toGrid(site)).slice(1).map(fromGrid) } : u)
      decisions.push(plan.reason)
    }
  } else if (plan.kind === 'train' && plan.unit) {
    const trainer = plan.unit === 'worker' ? hq : plan.unit === 'cavalry' ? buildings.find((b) => b.faction === 'enemy' && b.type === 'stable' && b.progress >= 1) : buildings.find((b) => b.faction === 'enemy' && b.type === 'barracks' && b.progress >= 1)
    if (trainer && trainer.queue.length < 4) {
      resources = deductCost(resources, UNIT_STATS[plan.unit].cost)
      buildings = buildings.map((b) => b.id === trainer.id ? { ...b, queue: [...b.queue, plan.unit!] } : b)
      decisions.push(plan.reason)
    }
  } else if (plan.kind === 'scout') {
    const scout = military(units, 'enemy').find((u) => u.state === 'idle' || u.state === 'moving')
    if (scout) {
      units = units.map((u) => u.id === scout.id ? { ...u, state: 'moving' as const, path: [{ x: 520, y: 690 }] } : u)
      decisions.push(plan.reason)
    }
  } else if (plan.kind === 'attack') {
    const army = military(units, 'enemy')
    if (army.length) {
      const target = world.underAttack
        ? world.units.filter((u) => u.faction === 'player' && u.state !== 'dead').sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))[0]
        : undefined
      units = units.map((u) => army.some((a) => a.id === u.id) ? { ...u, state: 'attacking' as const, targetId: target?.id ?? 'player-hq', path: [] } : u)
      decisions.push(plan.reason)
    }
  }
  return { resources, units, buildings, decisions, idCounter }
}

function gridFromBuildings(buildings: Building[]): boolean[][] {
  const blocked = Array.from({ length: MAP_ROWS }, () => Array<boolean>(MAP_COLS).fill(false))
  buildings.filter((b) => b.health > 0 && b.progress >= 1).forEach((b) => {
    footprintCells(b.type, { col: Math.round(b.x / GRID_SIZE - BUILDING_STATS[b.type].footprint.width / 2), row: Math.round(b.y / GRID_SIZE - BUILDING_STATS[b.type].footprint.height / 2) }).forEach((cell) => {
      if (blocked[cell.row]?.[cell.col] !== undefined) blocked[cell.row][cell.col] = true
    })
  })
  return blocked
}

export const aiInternals = { desiredWorkforce, choosePlan, findSite }
