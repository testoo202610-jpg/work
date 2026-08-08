export type Kingdom = 'flame' | 'rivers' | 'mountains'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type ResourceType = 'food' | 'wood' | 'stone' | 'gold'
export type UnitType = 'worker' | 'swordsman' | 'archer' | 'cavalry' | 'commander'
export type BuildingType = 'headquarters' | 'barracks' | 'stable' | 'farm' | 'storage' | 'watchtower' | 'wall'
export type Faction = 'player' | 'enemy'
export type UpgradeId = 'weapons1' | 'armor1' | 'gathering1'
export const UPGRADES: Record<UpgradeId, { cost: Cost; time: number }> = { weapons1: { cost: { food: 0, wood: 140, stone: 0, gold: 80 }, time: 25 }, armor1: { cost: { food: 0, wood: 100, stone: 80, gold: 60 }, time: 25 }, gathering1: { cost: { food: 80, wood: 100, stone: 0, gold: 40 }, time: 20 } }

export interface Point { x: number; y: number }
export interface GridPoint { col: number; row: number }
export interface Cost { food: number; wood: number; stone: number; gold: number }
export interface BuildingFootprint { width: number; height: number }
export interface PathGrid { width: number; height: number; blocked: boolean[][] }
export interface UnitStats { maxHealth: number; speed: number; damage: number; range: number; cooldown: number; radius: number; cost: Cost; population: number }
export interface BuildingStats { maxHealth: number; armor: number; cost: Cost; population: number; buildTime: number }
export type UnitState = 'idle' | 'moving' | 'gathering' | 'returning' | 'attacking' | 'building' | 'repairing' | 'dead' | 'attackMoving' | 'holding'
export interface Unit { id: string; type: UnitType; faction: Faction; x: number; y: number; health: number; targetId?: string; carrying?: ResourceType; carryingAmount?: number; path?: Point[]; attackCooldown?: number; state: UnitState; commandDestination?: Point; holdPosition?: Point }
export interface Building { id: string; type: BuildingType; faction: Faction; x: number; y: number; health: number; progress: number; queue: UnitType[]; builderId?: string; queueProgress?: number; rallyPoint?: Point }
export interface ResourceNode { id: string; type: ResourceType; x: number; y: number; amount: number; maxAmount: number }
export interface Projectile { id: string; attackerId: string; attackerType: UnitType | 'watchtower'; faction: Faction; targetId: string; x: number; y: number; speed: number }
export interface ControlGroup { unitIds: string[] }
export interface SaveData { version: 1; kingdom: Kingdom; difficulty: Difficulty; resources: Cost; enemyResources: Cost; units: Unit[]; buildings: Building[]; nodes: ResourceNode[]; elapsed: number; camera: Point; explored: string[]; controlGroups?: Record<number, ControlGroup>; researchedUpgrades?: UpgradeId[]; activeResearch?: UpgradeId; researchProgress?: number }

export const GRID_SIZE = 40
export const MAP_COLS = 53
export const MAP_ROWS = 30
export const MAP_WIDTH = MAP_COLS * GRID_SIZE
export const MAP_HEIGHT = MAP_ROWS * GRID_SIZE

export const TOWER_DAMAGE = 22
export const TOWER_RANGE = 240
export const TOWER_COOLDOWN = 1.5
export const AURA_RANGE = 170
export const AURA_BONUS = 0.15
export const CARRY_CAPACITY = 25
export const GATHER_RANGE = 38
export const DROPOFF_RANGE = 48
export const BUILD_RANGE = 60
export const COUNTER_MULTIPLIER = 1.3
export const DEMOLISH_TIME = 3
export const REPAIR_HP_PER_SECOND = 40
export const REPAIR_TICK_SECONDS = 1
export const UNIT_VISION_RADIUS = 5.5
export const BUILDING_VISION_RADIUS = 7.5
export const TOWER_VISION_RADIUS = 10
export const OUTDATED_MARKER_SECONDS = 90
export const DEFAULT_FOG_COLOR = 0x0b1613
export const HOLD_RANGE = 200
export const ATTACK_MOVE_RANGE = 340

export const KINGDOMS: Record<Kingdom, { name: string; color: number; description: string; bonuses: string }> = {
  flame: { name: 'مملكة اللهب', color: 0xef6c4d, description: 'محاربون شرسون يضربون بقوة.', bonuses: '+10٪ ضرر عسكري' },
  rivers: { name: 'مملكة الأنهار', color: 0x55b8c9, description: 'اقتصاد سريع وحركة رشيقة.', bonuses: '+20٪ جمع و +15٪ سرعة عمال' },
  mountains: { name: 'مملكة الجبال', color: 0x9d8bd3, description: 'حصون صلبة ودفاع متين.', bonuses: '+20٪ صحة المباني والأبراج' },
}
export const UNIT_STATS: Record<UnitType, UnitStats> = {
  worker: { maxHealth: 55, speed: 95, damage: 5, range: 28, cooldown: 1.1, radius: 10, cost: { food: 50, wood: 0, stone: 0, gold: 0 }, population: 1 },
  swordsman: { maxHealth: 110, speed: 75, damage: 17, range: 36, cooldown: 0.9, radius: 11, cost: { food: 70, wood: 20, stone: 0, gold: 0 }, population: 1 },
  archer: { maxHealth: 70, speed: 78, damage: 14, range: 190, cooldown: 1.3, radius: 10, cost: { food: 45, wood: 45, stone: 0, gold: 10 }, population: 1 },
  cavalry: { maxHealth: 150, speed: 135, damage: 28, range: 40, cooldown: 1.2, radius: 12, cost: { food: 100, wood: 0, stone: 0, gold: 70 }, population: 2 },
  commander: { maxHealth: 260, speed: 82, damage: 32, range: 44, cooldown: 0.9, radius: 13, cost: { food: 150, wood: 40, stone: 0, gold: 120 }, population: 2 },
}
export const BUILDING_STATS: Record<BuildingType, BuildingStats & { footprint: BuildingFootprint }> = {
  headquarters: { maxHealth: 1200, armor: 8, cost: { food: 0, wood: 0, stone: 0, gold: 0 }, population: 10, buildTime: 0, footprint: { width: 4, height: 4 } },
  barracks: { maxHealth: 500, armor: 5, cost: { food: 0, wood: 180, stone: 80, gold: 0 }, population: 0, buildTime: 12, footprint: { width: 3, height: 3 } },
  stable: { maxHealth: 450, armor: 5, cost: { food: 0, wood: 220, stone: 60, gold: 40 }, population: 0, buildTime: 15, footprint: { width: 3, height: 3 } },
  farm: { maxHealth: 260, armor: 2, cost: { food: 0, wood: 80, stone: 0, gold: 0 }, population: 5, buildTime: 8, footprint: { width: 2, height: 2 } },
  storage: { maxHealth: 350, armor: 4, cost: { food: 0, wood: 120, stone: 40, gold: 0 }, population: 0, buildTime: 10, footprint: { width: 2, height: 2 } },
  watchtower: { maxHealth: 420, armor: 7, cost: { food: 0, wood: 100, stone: 140, gold: 40 }, population: 0, buildTime: 14, footprint: { width: 2, height: 2 } },
  wall: { maxHealth: 600, armor: 10, cost: { food: 0, wood: 60, stone: 100, gold: 0 }, population: 0, buildTime: 6, footprint: { width: 1, height: 2 } },
}
export const INITIAL_RESOURCES: Cost = { food: 380, wood: 260, stone: 160, gold: 100 }

export function toGrid(point: Point): GridPoint { return { col: Math.floor(point.x / GRID_SIZE), row: Math.floor(point.y / GRID_SIZE) } }
export function fromGrid(point: GridPoint): Point { return { x: point.col * GRID_SIZE + GRID_SIZE / 2, y: point.row * GRID_SIZE + GRID_SIZE / 2 } }

export function buildingOrigin(building: Point & { type: BuildingType }): GridPoint {
  const footprint = BUILDING_STATS[building.type].footprint
  return { col: Math.round(building.x / GRID_SIZE - footprint.width / 2), row: Math.round(building.y / GRID_SIZE - footprint.height / 2) }
}
export function footprintCells(type: BuildingType, origin: GridPoint): GridPoint[] {
  const footprint = BUILDING_STATS[type].footprint
  return Array.from({ length: footprint.width * footprint.height }, (_, index) => ({ col: origin.col + index % footprint.width, row: origin.row + Math.floor(index / footprint.width) }))
}

export interface BlockSets { buildingCells: ReadonlySet<string>; nodeCells: ReadonlySet<string> }
export function cellKey(col: number, row: number): string { return `${col},${row}` }
export function buildBlockSets(buildings: Building[], nodes: ResourceNode[]): BlockSets {
  const buildingCells = new Set<string>()
  buildings.filter((b) => b.health > 0).forEach((b) => footprintCells(b.type, buildingOrigin(b)).forEach((cell) => buildingCells.add(cellKey(cell.col, cell.row))))
  const nodeCells = new Set<string>()
  nodes.filter((n) => n.amount > 0).forEach((n) => { const cell = toGrid(n); nodeCells.add(cellKey(cell.col, cell.row)) })
  return { buildingCells, nodeCells }
}
export function isPlacementValid(type: BuildingType, origin: GridPoint, mapWidth: number, mapHeight: number, buildings: Building[], nodes: ResourceNode[], blockedCells?: ReadonlySet<string>): boolean {
  const cells = footprintCells(type, origin)
  if (cells.some((cell) => cell.col < 0 || cell.row < 0 || cell.col >= mapWidth || cell.row >= mapHeight)) return false
  if (blockedCells && cells.some((cell) => blockedCells.has(cellKey(cell.col, cell.row)))) return false
  const sets = buildBlockSets(buildings, nodes)
  return !cells.some((cell) => sets.buildingCells.has(cellKey(cell.col, cell.row)) || sets.nodeCells.has(cellKey(cell.col, cell.row)))
}

export function buildPath(grid: PathGrid, start: GridPoint, goal: GridPoint): GridPoint[] {
  const key = (point: GridPoint) => `${point.col},${point.row}`
  const inside = (point: GridPoint) => point.col >= 0 && point.row >= 0 && point.col < grid.width && point.row < grid.height
  const isBlocked = (point: GridPoint) => grid.blocked[point.row]?.[point.col] ?? true
  if (!inside(start) || !inside(goal) || isBlocked(start)) return []
  const targets: GridPoint[] = [goal]
  if (isBlocked(goal)) {
    const free: GridPoint[] = []
    for (let dRow = -2; dRow <= 2; dRow++) for (let dCol = -2; dCol <= 2; dCol++) {
      const candidate = { col: goal.col + dCol, row: goal.row + dRow }
      if (inside(candidate) && !isBlocked(candidate)) free.push(candidate)
    }
    if (!free.length) return []
    targets.push(...free)
  }
  const openSet: GridPoint[] = [start]
  const came = new Map<string, GridPoint>()
  const cost = new Map<string, number>([[key(start), 0]])
  const heuristic = (point: GridPoint) => Math.min(...targets.map((t) => Math.hypot(point.col - t.col, point.row - t.row)))
  const atGoal = (point: GridPoint) => targets.some((t) => t.col === point.col && t.row === point.row)
  let guard = 0
  while (openSet.length && guard++ < 12000) {
    let bestIndex = 0
    let bestScore = Infinity
    for (let i = 0; i < openSet.length; i++) { const score = (cost.get(key(openSet[i])) ?? Infinity) + heuristic(openSet[i]); if (score < bestScore) { bestScore = score; bestIndex = i } }
    const current = openSet.splice(bestIndex, 1)[0]
    if (atGoal(current) && (current.col !== start.col || current.row !== start.row)) {
      const path: GridPoint[] = [current]
      let cursor = current
      while (came.has(key(cursor))) { cursor = came.get(key(cursor))!; path.unshift(cursor) }
      return path
    }
    for (const delta of [{ col: 1, row: 0 }, { col: -1, row: 0 }, { col: 0, row: 1 }, { col: 0, row: -1 }, { col: 1, row: 1 }, { col: -1, row: -1 }, { col: 1, row: -1 }, { col: -1, row: 1 }]) {
      const next = { col: current.col + delta.col, row: current.row + delta.row }
      if (!inside(next) || isBlocked(next)) continue
      if (delta.col !== 0 && delta.row !== 0 && (isBlocked({ col: current.col + delta.col, row: current.row }) || isBlocked({ col: current.col, row: current.row + delta.row }))) continue
      const nextKey = key(next)
      const nextCost = (cost.get(key(current)) ?? Infinity) + (delta.col !== 0 && delta.row !== 0 ? 1.414 : 1)
      if (nextCost < (cost.get(nextKey) ?? Infinity)) {
        came.set(nextKey, current)
        cost.set(nextKey, nextCost)
        if (!openSet.some((point) => point.col === next.col && point.row === next.row)) openSet.push(next)
      }
    }
  }
  return []
}

export function groupSlots(destination: Point, count: number): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const ring = Math.floor(Math.sqrt(index))
    const angle = index * 2.399963
    const radius = ring * GRID_SIZE * 0.9
    return { x: destination.x + Math.cos(angle) * radius, y: destination.y + Math.sin(angle) * radius }
  })
}

export function separationForce(unit: Unit, neighbors: Unit[]): Point {
  let forceX = 0
  let forceY = 0
  neighbors.forEach((other) => {
    if (other.id === unit.id || other.state === 'dead') return
    const dx = unit.x - other.x
    const dy = unit.y - other.y
    const distance = Math.hypot(dx, dy)
    const minimum = UNIT_STATS[unit.type].radius + UNIT_STATS[other.type].radius + 2
    if (distance > 0 && distance < minimum) { const push = (minimum - distance) / minimum; forceX += (dx / distance) * push; forceY += (dy / distance) * push }
  })
  return { x: forceX, y: forceY }
}

export function applyDamage(health: number, damage: number, armor = 0): number { return Math.max(0, health - Math.max(1, Math.round(damage - armor))) }
export function counterMultiplier(attacker: UnitType, target: UnitType): number {
  if (attacker === 'cavalry' && target === 'archer') return COUNTER_MULTIPLIER
  if (attacker === 'archer' && (target === 'worker' || target === 'swordsman')) return COUNTER_MULTIPLIER
  return 1
}
export function attackDamage(attacker: Unit | { type: 'watchtower' }, target: Unit | Building, buildings: Building[] = [], units: Unit[] = [], researchedUpgrades: UpgradeId[] = []): number {
  let damage = attacker.type === 'watchtower' ? TOWER_DAMAGE : UNIT_STATS[attacker.type].damage
  if (researchedUpgrades.includes('weapons1') && attacker.type !== 'watchtower' && 'faction' in attacker && attacker.faction === 'player' && attacker.type !== 'worker') damage *= 1.1
  if (attacker.type !== 'watchtower' && 'state' in target) damage *= counterMultiplier(attacker.type, target.type)
  if ('type' in target && (target.type as string) in BUILDING_STATS) damage -= BUILDING_STATS[target.type as BuildingType].armor
  if (attacker.type !== 'watchtower') {
    const source = units.find((u) => u.id === (attacker as Unit).id)
    if (source) {
      const commander = units.find((u) => u.faction === source.faction && u.type === 'commander' && u.state !== 'dead' && Math.hypot(u.x - source.x, u.y - source.y) <= AURA_RANGE)
      if (commander && source.type !== 'commander') damage *= 1 + AURA_BONUS
    }
  }
  void buildings
  return Math.max(1, Math.round(damage))
}
export function resolveAttack(attacker: Unit | { id: string; type: 'watchtower'; faction: Faction }, target: Unit | Building, units: Unit[] = []): Unit | Building {
  const armor = 'state' in target ? 0 : BUILDING_STATS[(target as Building).type].armor
  const raw = attacker.type === 'watchtower' ? TOWER_DAMAGE : UNIT_STATS[attacker.type].damage * ('state' in target ? counterMultiplier(attacker.type, (target as Unit).type) : 1)
  const aura = attacker.type !== 'watchtower' && units.some((u) => u.id === (attacker as Unit).id) && units.some((u) => u.faction === attacker.faction && u.type === 'commander' && u.state !== 'dead' && u.id !== (attacker as Unit).id && Math.hypot(u.x - (attacker as Unit).x, u.y - (attacker as Unit).y) <= AURA_RANGE) ? 1 + AURA_BONUS : 1
  const health = applyDamage(target.health, raw * aura, armor)
  return { ...target, health, ...(health === 0 && 'state' in target ? { state: 'dead' as const } : {}) }
}

export function visionRadiusOfUnit(type: UnitType): number { return type === 'commander' ? 7 : UNIT_VISION_RADIUS }
export function visionRadiusOfBuilding(type: BuildingType): number { return type === 'watchtower' ? TOWER_VISION_RADIUS : BUILDING_VISION_RADIUS }
export function computeVisibleCells(units: Unit[], buildings: Building[], faction: Faction): Set<string> {
  const visible = new Set<string>()
  const add = (cx: number, cy: number, radius: number) => {
    const ceil = Math.ceil(radius)
    for (let dr = -ceil; dr <= ceil; dr++) for (let dc = -ceil; dc <= ceil; dc++) {
      if (Math.hypot(dc, dr) > radius + 0.4) continue
      const col = cx + dc, row = cy + dr
      if (col >= 0 && row >= 0 && col < MAP_COLS && row < MAP_ROWS) visible.add(cellKey(col, row))
    }
  }
  units.filter((u) => u.faction === faction && u.state !== 'dead').forEach((u) => { const c = toGrid(u); add(c.col, c.row, visionRadiusOfUnit(u.type)) })
  buildings.filter((b) => b.faction === faction && b.health > 0).forEach((b) => { const c = toGrid(b); add(c.col, c.row, visionRadiusOfBuilding(b.type)) })
  return visible
}
export function mergeExplored(explored: Iterable<string>, visible: Iterable<string>): string[] {
  const set = new Set<string>(explored)
  for (const cell of visible) set.add(cell)
  return [...set]
}
export function cellVisible(visible: ReadonlySet<string>, x: number, y: number): boolean { const c = toGrid({ x, y }); return visible.has(cellKey(c.col, c.row)) }

export function reservedPopulation(buildings: Building[], faction: Faction): number {
  return buildings.filter((b) => b.faction === faction && b.progress >= 1).reduce((sum, b) => sum + b.queue.reduce((s, type) => s + UNIT_STATS[type].population, 0), 0)
}
export function population(units: Unit[], faction: Faction): number { return units.filter((u) => u.faction === faction && u.state !== 'dead').reduce((sum, u) => sum + UNIT_STATS[u.type].population, 0) }
export function capacity(buildings: Building[], faction: Faction): number { return buildings.filter((b) => b.faction === faction && b.health > 0 && b.progress >= 1).reduce((sum, b) => sum + BUILDING_STATS[b.type].population, 0) }
export function canAfford(resources: Cost, cost: Cost): boolean { return (Object.keys(cost) as ResourceType[]).every((key) => resources[key] >= cost[key]) }
export function deductCost(resources: Cost, cost: Cost): Cost { return { food: resources.food - cost.food, wood: resources.wood - cost.wood, stone: resources.stone - cost.stone, gold: resources.gold - cost.gold } }
export function addCost(resources: Cost, amount: Cost): Cost { return { food: resources.food + amount.food, wood: resources.wood + amount.wood, stone: resources.stone + amount.stone, gold: resources.gold + amount.gold } }
export function damageAfterArmor(damage: number, armor: number): number { return Math.max(1, damage - armor) }

export function gatherNode(node: ResourceNode, requested: number): { node: ResourceNode; gathered: number } { const gathered = Math.min(requested, node.amount); return { node: { ...node, amount: node.amount - gathered }, gathered } }
export function isVictory(buildings: Building[]): boolean { return !buildings.some((b) => b.faction === 'enemy' && b.type === 'headquarters' && b.health > 0) }
export function isDefeat(buildings: Building[]): boolean { return !buildings.some((b) => b.faction === 'player' && b.type === 'headquarters' && b.health > 0) }
export function serializeSave(data: Omit<SaveData, 'version'>): string { return JSON.stringify({ ...data, version: 1 }) }

// Deep SaveData validation
function isValidControlGroups(value: unknown): value is Record<number, ControlGroup> {
  if (value === undefined) return true
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value).every(([key, group]) => /^[1-5]$/.test(key) && !!group && typeof group === 'object' && Array.isArray((group as ControlGroup).unitIds) && (group as ControlGroup).unitIds.every((id) => typeof id === 'string' && id.length > 0))
}

function isFiniteNonnegative(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0
}

function isValidKingdom(k: unknown): k is Kingdom {
  return k === 'flame' || k === 'rivers' || k === 'mountains'
}

function isValidDifficulty(d: unknown): d is Difficulty {
  return d === 'easy' || d === 'medium' || d === 'hard'
}

function isValidResourceType(r: unknown): r is ResourceType {
  return r === 'food' || r === 'wood' || r === 'stone' || r === 'gold'
}

function isValidUnitType(u: unknown): u is UnitType {
  return u === 'worker' || u === 'swordsman' || u === 'archer' || u === 'cavalry' || u === 'commander'
}

function isValidBuildingType(b: unknown): b is BuildingType {
  return b === 'headquarters' || b === 'barracks' || b === 'stable' || b === 'farm' || b === 'storage' || b === 'watchtower' || b === 'wall'
}

function isValidUnitState(s: unknown): s is UnitState {
  const validStates: UnitState[] = ['idle', 'moving', 'gathering', 'returning', 'attacking', 'building', 'repairing', 'dead', 'attackMoving', 'holding']
  return validStates.includes(s as UnitState)
}

function isValidPoint(p: unknown): p is Point {
  return !!p && typeof p === 'object' && isFiniteNonnegative((p as Point).x) && isFiniteNonnegative((p as Point).y)
}

function isValidCost(c: unknown): c is Cost {
  return !!c && typeof c === 'object' && ['food', 'wood', 'stone', 'gold'].every((key) => isFiniteNonnegative((c as Cost)[key as ResourceType]))
}

function isValidUnit(u: unknown): u is Unit {
  if (!u || typeof u !== 'object') return false
  const unit = u as Unit
  return typeof unit.id === 'string' && unit.id.length > 0 &&
    isValidUnitType(unit.type) &&
    (unit.faction === 'player' || unit.faction === 'enemy') &&
    isFiniteNonnegative(unit.x) && isFiniteNonnegative(unit.y) &&
    isFiniteNonnegative(unit.health) && unit.health <= UNIT_STATS[unit.type].maxHealth * 1.5 &&
    isValidUnitState(unit.state) &&
    (unit.targetId === undefined || typeof unit.targetId === 'string') &&
    (unit.carrying === undefined || isValidResourceType(unit.carrying)) &&
    (unit.carryingAmount === undefined || isFiniteNonnegative(unit.carryingAmount)) &&
    (unit.path === undefined || Array.isArray(unit.path)) &&
    (unit.attackCooldown === undefined || isFiniteNonnegative(unit.attackCooldown)) &&
    (unit.commandDestination === undefined || isValidPoint(unit.commandDestination)) &&
    (unit.holdPosition === undefined || isValidPoint(unit.holdPosition))
}

function isValidBuilding(b: unknown): b is Building {
  if (!b || typeof b !== 'object') return false
  const building = b as Building
  return typeof building.id === 'string' && building.id.length > 0 &&
    isValidBuildingType(building.type) &&
    (building.faction === 'player' || building.faction === 'enemy') &&
    isFiniteNonnegative(building.x) && isFiniteNonnegative(building.y) &&
    isFiniteNonnegative(building.health) && building.health <= BUILDING_STATS[building.type].maxHealth * 1.5 &&
    isFiniteNonnegative(building.progress) && building.progress >= 0 && building.progress <= 1 &&
    Array.isArray(building.queue) && building.queue.every(isValidUnitType) &&
    (building.builderId === undefined || typeof building.builderId === 'string') &&
    (building.queueProgress === undefined || isFiniteNonnegative(building.queueProgress)) &&
    (building.rallyPoint === undefined || isValidPoint(building.rallyPoint))
}

function isValidResourceNode(n: unknown): n is ResourceNode {
  if (!n || typeof n !== 'object') return false
  const node = n as ResourceNode
  return typeof node.id === 'string' && node.id.length > 0 &&
    isValidResourceType(node.type) &&
    isFiniteNonnegative(node.x) && isFiniteNonnegative(node.y) &&
    isFiniteNonnegative(node.amount) && node.amount <= node.maxAmount * 1.1 &&
    isFiniteNonnegative(node.maxAmount)
}

function hasDuplicateIds(items: { id: string }[]): boolean {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) return true
    seen.add(item.id)
  }
  return false
}

function isValidSaveData(data: unknown): data is SaveData {
  if (!data || typeof data !== 'object') return false
  const save = data as SaveData

  // Version check
  if (save.version !== 1) return false

  // Enums
  if (!isValidKingdom(save.kingdom) || !isValidDifficulty(save.difficulty)) return false

  // Resources
  if (!isValidCost(save.resources) || !isValidCost(save.enemyResources)) return false

  // Collections
  if (!Array.isArray(save.units) || !save.units.every(isValidUnit)) return false
  if (!Array.isArray(save.buildings) || !save.buildings.every(isValidBuilding)) return false
  if (!Array.isArray(save.nodes) || !save.nodes.every(isValidResourceNode)) return false

  // Duplicate ID checks
  if (hasDuplicateIds(save.units) || hasDuplicateIds(save.buildings) || hasDuplicateIds(save.nodes)) return false

  // Elapsed and camera
  if (!isFiniteNonnegative(save.elapsed)) return false
  if (!isValidPoint(save.camera)) return false

  // Explored cells
  if (!Array.isArray(save.explored) || !save.explored.every((cell) => typeof cell === 'string' && /^\d+,\d+$/.test(cell))) return false

  // Control groups
  if (!isValidControlGroups(save.controlGroups)) return false

  return true
}

function isValidUpgradeState(save: SaveData): boolean {
  if (save.researchedUpgrades !== undefined && (!Array.isArray(save.researchedUpgrades) || new Set(save.researchedUpgrades).size !== save.researchedUpgrades.length || !save.researchedUpgrades.every((u) => u in UPGRADES))) return false
  if (save.activeResearch !== undefined && !(save.activeResearch in UPGRADES)) return false
  if (save.activeResearch && save.researchedUpgrades?.includes(save.activeResearch)) return false
  return save.researchProgress === undefined || (Number.isFinite(save.researchProgress) && save.researchProgress >= 0 && save.researchProgress <= (save.activeResearch ? UPGRADES[save.activeResearch].time : 0))
}
export function restoreSave(raw: string): SaveData | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isValidSaveData(parsed) || !isValidUpgradeState(parsed)) return null
    return parsed as SaveData
  } catch {
    return null
  }
}

export function createProjectile(attackerId: string, attackerType: UnitType | 'watchtower', faction: Faction, target: Unit | Building, x: number, y: number, id: string): Projectile {
  return { id, attackerId, attackerType, faction, targetId: target.id, x, y, speed: 420 }
}
export function advanceProjectile(projectile: Projectile, target: Point, dt: number): Projectile {
  const distance = Math.hypot(target.x - projectile.x, target.y - projectile.y)
  if (distance === 0) return projectile
  const step = projectile.speed * dt
  if (distance <= step) return { ...projectile, x: target.x, y: target.y }
  return { ...projectile, x: projectile.x + ((target.x - projectile.x) / distance) * step, y: projectile.y + ((target.y - projectile.y) / distance) * step }
}
export function projectileReached(projectile: Projectile, target: Point): boolean { return Math.hypot(target.x - projectile.x, target.y - projectile.y) < 2 }

// Control Groups Management
export function purgeControlGroup(group: ControlGroup, units: Unit[]): ControlGroup {
  const liveIds = new Set(units.filter((u) => u.faction === 'player' && u.state !== 'dead').map((u) => u.id))
  return { unitIds: [...new Set(group.unitIds.filter((id) => liveIds.has(id)))] }
}

// Rally Points
const TRAINABLE_BUILDINGS: BuildingType[] = ['headquarters', 'barracks', 'stable']
export function canSetRallyPoint(building: Building): boolean {
  return TRAINABLE_BUILDINGS.includes(building.type) && building.faction === 'player' && building.progress >= 1 && building.health > 0
}
export function isValidRallyPointLocation(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x <= MAP_WIDTH && y <= MAP_HEIGHT
}
export function setRallyPoint(building: Building, x: number, y: number): Building {
  if (!canSetRallyPoint(building) || !isValidRallyPointLocation(x, y)) return building
  return { ...building, rallyPoint: { x, y } }
}
export function clearRallyPoint(building: Building): Building {
  return { ...building, rallyPoint: undefined }
}

// Attack Move
export function canAttackMove(unit: Unit): boolean {
  return unit.faction === 'player' && unit.state !== 'dead' && (unit.type === 'swordsman' || unit.type === 'archer' || unit.type === 'cavalry' || unit.type === 'commander')
}
export function findNearestEnemyInRange(unit: Unit, units: Unit[], buildings: Building[]): Unit | Building | undefined {
  const candidates: Array<Unit | Building> = [
    ...units.filter((u) => u.faction !== unit.faction && u.state !== 'dead' && Math.hypot(u.x - unit.x, u.y - unit.y) < ATTACK_MOVE_RANGE),
    ...buildings.filter((b) => b.faction !== unit.faction && b.health > 0 && Math.hypot(b.x - unit.x, b.y - unit.y) < ATTACK_MOVE_RANGE),
  ]
  candidates.sort((a, b) => Math.hypot(a.x - unit.x, a.y - unit.y) - Math.hypot(b.x - unit.x, b.y - unit.y))
  return candidates[0]
}

// Hold Position
export function canHold(unit: Unit): boolean {
  return unit.faction === 'player' && unit.state !== 'dead' && (unit.type === 'swordsman' || unit.type === 'archer' || unit.type === 'cavalry' || unit.type === 'commander')
}
export function holdPositionAt(unit: Unit): Unit {
  if (!canHold(unit)) return unit
  return { ...unit, state: 'holding', holdPosition: { x: unit.x, y: unit.y }, commandDestination: undefined, targetId: undefined, path: [] }
}
export function isOutOfHoldRange(unit: Unit): boolean {
  if (unit.state !== 'holding' || !unit.holdPosition) return false
  return Math.hypot(unit.x - unit.holdPosition.x, unit.y - unit.holdPosition.y) > HOLD_RANGE
}
