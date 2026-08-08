import { create } from 'zustand'
import {
  addCost, advanceProjectile, attackDamage, BUILDING_STATS, UPGRADES, buildPath, canAfford, capacity, cellKey,
  computeVisibleCells, createProjectile, deductCost, fromGrid, GRID_SIZE, groupSlots,
  INITIAL_RESOURCES, isDefeat, isVictory, MAP_COLS, MAP_HEIGHT, MAP_ROWS, MAP_WIDTH,
  mergeExplored, OUTDATED_MARKER_SECONDS, population, projectileReached, REPAIR_HP_PER_SECOND,
  reservedPopulation, restoreSave, separationForce, serializeSave, toGrid, UNIT_STATS,
  purgeControlGroup, setRallyPoint, canAttackMove, canHold, holdPositionAt,
} from './game'
import type { Building, BuildingType, Cost, ControlGroup, Difficulty, GridPoint, Kingdom, Point, Projectile, ResourceNode, Unit, UnitType } from './game'
import { aiProfile, runAi } from './ai'
import { MSG } from './i18n'
import { configureAudio, playCue, startMusic } from './audio'

export interface FogMarker { id: string; type: BuildingType; x: number; y: number; seenAt: number }
export interface Settings { cameraSpeed: number; soundVolume: number; musicVolume: number; muted: boolean }

const SAVE_KEY = 'dragon-kingdoms-save'
const SETTINGS_KEY = 'dragon-kingdoms-settings'
export const DEFAULT_SETTINGS: Settings = { cameraSpeed: 520, soundVolume: 0.8, musicVolume: 0.5, muted: false }
const scaleCost = (cost: Cost, ratio: number): Cost => ({ food: cost.food * ratio, wood: Math.floor(cost.wood * ratio), stone: Math.floor(cost.stone * ratio), gold: Math.floor(cost.gold * ratio) })
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

interface GameState {
  kingdom: Kingdom; difficulty: Difficulty
  resources: Cost; enemyResources: Cost
  units: Unit[]; buildings: Building[]; nodes: ResourceNode[]; projectiles: Projectile[]
  elapsed: number; camera: Point; explored: string[]; visible: string[]; fogMarkers: FogMarker[]
  phase: 'menu' | 'playing' | 'victory' | 'defeat'
  selectedIds: string[]; message: string
  placement?: BuildingType; preview?: Point; demolishArmedId?: string; aiIdCounter: number; lastIdleAlert: number
  controlGroups: Record<number, ControlGroup>; rallyPointBuildingId?: string; lastGroupKeyPressTime: Record<number, number>; researchedUpgrades: import('./game').UpgradeId[]; activeResearch?: import('./game').UpgradeId; researchProgress: number
  settings: Settings; showSettings: boolean
  setSetup: (kingdom: Kingdom, difficulty: Difficulty) => void
  start: () => void; select: (ids: string[], additive?: boolean) => void
  tick: (dt: number) => void
  moveSelected: (x: number, y: number) => void; gatherSelected: (nodeId: string) => void
  placeBuilding: (type: BuildingType, x: number, y: number) => boolean
  beginPlacement: (type: BuildingType) => void; updatePreview: (x: number, y: number) => void
  confirmPlacement: () => boolean; cancelPlacement: () => void
  train: (buildingId: string, type: UnitType) => boolean
  attack: (targetId: string) => void
  orderRepair: (buildingId: string) => void; cancelConstruction: (buildingId: string) => void; demolish: (buildingId: string) => void
  save: () => void; load: () => boolean
  setCamera: (camera: Point) => void; clearMessage: () => void
  updateSettings: (partial: Partial<Settings>) => void; toggleSettings: () => void
  assignToControlGroup: (groupNum: number) => void; selectFromControlGroup: (groupNum: number) => void
  setRallyPointMode: (buildingId?: string) => void; applyRallyPoint: (x: number, y: number) => void
  stopSelected: () => void; holdSelected: () => void; attackMoveSelected: (x: number, y: number) => void; research: (id: import('./game').UpgradeId) => boolean
}

const trainingTime = (type: UnitType) => type === 'worker' ? 5 : type === 'cavalry' ? 12 : type === 'commander' ? 20 : 8
let uid = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${uid++}`

const initialUnits = (): Unit[] => [
  ...[1, 2, 3, 4].map((id): Unit => ({ id: `worker-${id}`, type: 'worker', faction: 'player', x: 430 + id * 34, y: 760, health: UNIT_STATS.worker.maxHealth, state: 'idle' })),
  { id: 'player-commander', type: 'commander', faction: 'player', x: 640, y: 800, health: UNIT_STATS.commander.maxHealth, state: 'idle' },
]
const initialEnemyUnits = (): Unit[] => [1, 2, 3, 4].map((id): Unit => ({ id: `enemy-worker-${id}`, type: 'worker', faction: 'enemy', x: 1560 + id * 30, y: 600, health: UNIT_STATS.worker.maxHealth, state: 'idle' }))
const initialBuildings = (): Building[] => [
  { id: 'player-hq', type: 'headquarters', faction: 'player', x: 520, y: 690, health: BUILDING_STATS.headquarters.maxHealth, progress: 1, queue: [] },
  { id: 'enemy-hq', type: 'headquarters', faction: 'enemy', x: 1660, y: 520, health: BUILDING_STATS.headquarters.maxHealth, progress: 1, queue: [] },
]
const initialNodes = (): ResourceNode[] => [
  { id: 'food-1', type: 'food', x: 300, y: 560, amount: 1800, maxAmount: 1800 },
  { id: 'wood-1', type: 'wood', x: 720, y: 850, amount: 1600, maxAmount: 1600 },
  { id: 'stone-1', type: 'stone', x: 920, y: 420, amount: 1400, maxAmount: 1400 },
  { id: 'gold-1', type: 'gold', x: 1320, y: 780, amount: 1100, maxAmount: 1100 },
  { id: 'food-2', type: 'food', x: 1810, y: 350, amount: 1800, maxAmount: 1800 },
  { id: 'wood-2', type: 'wood', x: 1510, y: 240, amount: 1600, maxAmount: 1600 },
  { id: 'stone-2', type: 'stone', x: 1880, y: 820, amount: 1400, maxAmount: 1400 },
  { id: 'gold-2', type: 'gold', x: 1120, y: 980, amount: 1100, maxAmount: 1100 },
]

function footprintOf(type: BuildingType, origin: GridPoint): GridPoint[] {
  const footprint = BUILDING_STATS[type].footprint
  return Array.from({ length: footprint.width * footprint.height }, (_, index) => ({ col: origin.col + index % footprint.width, row: origin.row + Math.floor(index / footprint.width) }))
}
function originOf(type: BuildingType, x: number, y: number): GridPoint {
  return { col: Math.round(x / GRID_SIZE - BUILDING_STATS[type].footprint.width / 2), row: Math.round(y / GRID_SIZE - BUILDING_STATS[type].footprint.height / 2) }
}
function pathGrid(buildings: Building[], nodes: ResourceNode[], sites: { type: BuildingType; x: number; y: number }[] = []) {
  const blocked = Array.from({ length: MAP_ROWS }, () => Array<boolean>(MAP_COLS).fill(false))
  const paint = (cells: GridPoint[]) => cells.forEach((c) => { if (blocked[c.row]?.[c.col] !== undefined) blocked[c.row][c.col] = true })
  buildings.filter((b) => b.health > 0).forEach((b) => paint(footprintOf(b.type, originOf(b.type, b.x, b.y))))
  sites.forEach((site) => paint(footprintOf(site.type, originOf(site.type, site.x, site.y))))
  nodes.filter((n) => n.amount > 0).forEach((n) => paint([toGrid(n)]))
  return { width: MAP_COLS, height: MAP_ROWS, blocked }
}
function routeTo(buildings: Building[], nodes: ResourceNode[], from: Point, destination: Point, sites: { type: BuildingType; x: number; y: number }[] = []): Point[] {
  return buildPath(pathGrid(buildings, nodes, sites), toGrid(from), toGrid(destination)).slice(1).map(fromGrid)
}
const nearestDropoff = (buildings: Building[], unit: Unit) =>
  buildings.filter((b) => b.faction === unit.faction && (b.type === 'headquarters' || b.type === 'storage') && b.progress >= 1 && b.health > 0)
    .sort((a, b) => Math.hypot(a.x - unit.x, a.y - unit.y) - Math.hypot(b.x - unit.x, b.y - unit.y))[0]

function moveAlong(unit: Unit, dt: number, kingdom: Kingdom): Unit {
  const next = unit.path?.[0]
  if (!next) return unit
  const speed = UNIT_STATS[unit.type].speed * (kingdom === 'rivers' && unit.type === 'worker' && unit.faction === 'player' ? 1.15 : 1)
  const distance = Math.hypot(next.x - unit.x, next.y - unit.y)
  const step = speed * dt
  if (distance <= step) return { ...unit, x: next.x, y: next.y, path: unit.path?.slice(1) }
  return { ...unit, x: unit.x + ((next.x - unit.x) / distance) * step, y: unit.y + ((next.y - unit.y) / distance) * step }
}

function canTrain(building: Building, type: UnitType): boolean {
  if (building.progress < 1 || building.health <= 0) return false
  if (building.type === 'headquarters') return type === 'worker' || type === 'commander'
  if (building.type === 'barracks') return type === 'swordsman' || type === 'archer'
  return building.type === 'stable' && type === 'cavalry'
}
const acquireTarget = (unit: Unit, units: Unit[], buildings: Building[]): Unit | Building | undefined => {
  const enemies: Array<Unit | Building> = [
    ...units.filter((u) => u.faction !== unit.faction && u.state !== 'dead' && Math.hypot(u.x - unit.x, u.y - unit.y) < 340),
    ...buildings.filter((b) => b.faction !== unit.faction && b.health > 0 && Math.hypot(b.x - unit.x, b.y - unit.y) < 340),
  ]
  enemies.sort((a, b) => {
    const priority = (value: Unit | Building) => ('state' in value ? 0 : value.type === 'watchtower' ? 1 : 2)
    return priority(a) - priority(b) || Math.hypot(a.x - unit.x, a.y - unit.y) - Math.hypot(b.x - unit.x, b.y - unit.y)
  })
  return enemies[0]
}
function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>) } } catch { return { ...DEFAULT_SETTINGS } }
}
function strike(attacker: Unit | { type: 'watchtower'; faction: Building['faction'] }, target: Unit | Building, units: Unit[], kingdom: Kingdom, researchedUpgrades: import('./game').UpgradeId[] = []): Unit | Building {
  const kingdomBonus = attacker.type !== 'watchtower' && attacker.faction === 'player' && kingdom === 'flame' && attacker.type !== 'worker' ? 1.1 : 1
  const armorReduction = 'state' in target ? 1 : 1
  const durability = 'state' in target && target.faction === attacker.faction && researchedUpgrades.includes('armor1') && target.type !== 'worker' ? 1 / 1.1 : 1
  const damage = attackDamage(attacker, target, [], units, researchedUpgrades) * kingdomBonus * durability * armorReduction
  const armor = 'state' in target ? 0 : BUILDING_STATS[target.type].armor
  const health = Math.max(0, target.health - Math.max(1, damage - ('state' in target ? 0 : armor)))
  return 'state' in target
    ? { ...target, health, ...(health === 0 ? { state: 'dead' as const } : {}) }
    : { ...target, health }
}

export const useGameStore = create<GameState>((set, get) => ({
  kingdom: 'rivers', difficulty: 'medium',
  resources: { ...INITIAL_RESOURCES }, enemyResources: { ...INITIAL_RESOURCES },
  units: [], buildings: [], nodes: [], projectiles: [],
  elapsed: 0, camera: { x: 640, y: 440 }, explored: [], visible: [], fogMarkers: [],
  phase: 'menu', selectedIds: [], message: '',
  placement: undefined, preview: undefined, demolishArmedId: undefined, aiIdCounter: 1, lastIdleAlert: -60,
  controlGroups: {}, rallyPointBuildingId: undefined, lastGroupKeyPressTime: {}, researchedUpgrades: [], researchProgress: 0,
  settings: loadSettings(), showSettings: false,

  setSetup: (kingdom, difficulty) => set({ kingdom, difficulty }),

  start: () => {
    localStorage.removeItem(SAVE_KEY)
    set({
      phase: 'playing', resources: { ...INITIAL_RESOURCES }, enemyResources: { ...INITIAL_RESOURCES },
      units: [...initialUnits(), ...initialEnemyUnits()], buildings: initialBuildings(), nodes: initialNodes(), projectiles: [],
      elapsed: 0, camera: { x: 640, y: 440 }, explored: [], visible: [], fogMarkers: [],
      selectedIds: [], placement: undefined, preview: undefined, demolishArmedId: undefined, aiIdCounter: 1, message: '',
      controlGroups: {}, rallyPointBuildingId: undefined, lastGroupKeyPressTime: {}, researchedUpgrades: [], researchProgress: 0,
    })
    startMusic()
  },

  select: (ids, additive = false) => {
    if (ids.length) playCue('select')
    set({ selectedIds: additive ? [...new Set([...get().selectedIds, ...ids])] : ids })
  },
  setCamera: (camera) => set({ camera }),
  clearMessage: () => set({ message: '' }),

  beginPlacement: (type) => { playCue('click'); set({ placement: type, preview: undefined }) },
  updatePreview: (x, y) => set({ preview: { x, y } }),
  cancelPlacement: () => { if (get().placement) playCue('click'); set({ placement: undefined, preview: undefined }) },
  placeBuilding: (type, x, y) => { set({ placement: type, preview: { x, y } }); return get().confirmPlacement() },

  confirmPlacement: () => {
    const state = get()
    const type = state.placement
    const preview = state.preview
    if (!type || !preview) return false
    if (!canAfford(state.resources, BUILDING_STATS[type].cost)) { set({ message: MSG.insufficientResources }); playCue('error'); return false }
    const origin = originOf(type, preview.x, preview.y)
    const cells = footprintOf(type, origin)
    if (cells.some((c) => c.col < 0 || c.row < 0 || c.col >= MAP_COLS || c.row >= MAP_ROWS)) { set({ message: MSG.invalidPlacement }); playCue('error'); return false }
    const blocked = pathGrid(state.buildings.filter((b) => b.health > 0), state.nodes.filter((n) => n.amount > 0)).blocked
    if (cells.some((c) => blocked[c.row][c.col])) { set({ message: MSG.invalidPlacement }); playCue('error'); return false }
    const worker = state.units.find((u) => state.selectedIds.includes(u.id) && u.type === 'worker' && u.faction === 'player' && u.state !== 'dead')
      ?? state.units.filter((u) => u.type === 'worker' && u.faction === 'player' && u.state !== 'dead')
        .sort((a, b) => Math.hypot(a.x - preview.x, a.y - preview.y) - Math.hypot(b.x - preview.x, b.y - preview.y))[0]
    const id = nextId(type)
    const building: Building = { id, type, faction: 'player', x: preview.x, y: preview.y, health: 1, progress: 0, queue: [], builderId: worker?.id }
    set({
      resources: deductCost(state.resources, BUILDING_STATS[type].cost),
      buildings: [...state.buildings, building],
      placement: undefined, preview: undefined, message: MSG.constructionStarted,
      units: worker
        ? state.units.map((u) => u.id === worker.id
          ? { ...u, targetId: id, carryingAmount: 0, path: routeTo(state.buildings.filter((b) => b.health > 0), state.nodes.filter((n) => n.amount > 0), u, preview, [{ type, x: preview.x, y: preview.y }]), state: 'building' as const }
          : u)
        : state.units,
    })
    playCue('place')
    return true
  },

  moveSelected: (x, y) => {
    const state = get()
    const movers = state.units.filter((u) => state.selectedIds.includes(u.id) && u.faction === 'player' && u.state !== 'dead')
    if (!movers.length) return
    const clamped = { x: clamp(x, 20, MAP_WIDTH - 20), y: clamp(y, 20, MAP_HEIGHT - 20) }
    const slots = groupSlots(clamped, movers.length)
    const ordered = [...movers].sort((a, b) => Math.hypot(a.x - clamped.x, a.y - clamped.y) - Math.hypot(b.x - clamped.x, b.y - clamped.y))
    const assignment = new Map<string, Point>(ordered.map((unit, index) => [unit.id, slots[index]]))
    const blockers = state.buildings.filter((b) => b.health > 0)
    const blockNodes = state.nodes.filter((n) => n.amount > 0)
    playCue('move')
    set({
      units: state.units.map((u) => {
        const slot = assignment.get(u.id)
        if (!slot) return u
        return { ...u, targetId: undefined, state: 'moving' as const, path: routeTo(blockers, blockNodes, u, slot) }
      }),
    })
  },

  gatherSelected: (nodeId) => {
    const state = get()
    const node = state.nodes.find((n) => n.id === nodeId && n.amount > 0)
    if (!node) return
    playCue('move')
    set({
      units: state.units.map((u) => state.selectedIds.includes(u.id) && u.type === 'worker' && u.faction === 'player' && u.state !== 'dead'
        ? { ...u, targetId: nodeId, carrying: undefined, carryingAmount: 0, path: routeTo(state.buildings.filter((b) => b.health > 0), state.nodes.filter((n) => n.amount > 0), u, node), state: 'gathering' as const }
        : u),
    })
  },

  train: (buildingId, type) => {
    const state = get()
    const building = state.buildings.find((b) => b.id === buildingId)
    if (!building || building.faction !== 'player') return false
    if (type === 'cavalry' && !state.buildings.some((b) => b.faction === 'player' && b.type === 'stable' && b.progress >= 1 && b.health > 0)) { set({ message: MSG.needStable }); playCue('error'); return false }
    if (!canTrain(building, type)) { set({ message: MSG.wrongBuilding }); playCue('error'); return false }
    const stats = UNIT_STATS[type]
    const used = population(state.units, 'player') + reservedPopulation(state.buildings, 'player')
    if (used + stats.population > capacity(state.buildings, 'player')) { set({ message: MSG.popCap }); playCue('error'); return false }
    if (!canAfford(state.resources, stats.cost)) { set({ message: MSG.insufficientResources }); playCue('error'); return false }
    set({
      resources: deductCost(state.resources, stats.cost),
      buildings: state.buildings.map((b) => b.id === buildingId ? { ...b, queue: [...b.queue, type], queueProgress: b.queueProgress ?? 0 } : b),
    })
    playCue('click')
    return true
  },

  attack: (targetId) => {
    const state = get()
    playCue('move')
    set({ units: state.units.map((u) => state.selectedIds.includes(u.id) && u.faction === 'player' && u.state !== 'dead' ? { ...u, targetId, path: [], state: 'attacking' as const } : u) })
  },

  orderRepair: (buildingId) => {
    const state = get()
    const building = state.buildings.find((b) => b.id === buildingId && b.faction === 'player' && b.health > 0 && b.progress >= 1)
    const max = building ? BUILDING_STATS[building.type].maxHealth * (state.kingdom === 'mountains' ? 1.2 : 1) : 0
    if (!building || building.health >= max) return
    const worker = state.units.filter((u) => state.selectedIds.includes(u.id) && u.type === 'worker' && u.faction === 'player' && u.state !== 'dead')[0]
      ?? state.units.filter((u) => u.type === 'worker' && u.faction === 'player' && u.state !== 'dead')
        .sort((a, b) => Math.hypot(a.x - building.x, a.y - building.y) - Math.hypot(b.x - building.x, b.y - building.y))[0]
    if (!worker) return
    playCue('click')
    set({
      units: state.units.map((u) => u.id === worker.id
        ? { ...u, targetId: buildingId, carryingAmount: 0, state: 'repairing' as const, path: routeTo(state.buildings.filter((b) => b.health > 0), state.nodes.filter((n) => n.amount > 0), u, building) }
        : u),
    })
  },

  cancelConstruction: (buildingId) => {
    const state = get()
    const building = state.buildings.find((b) => b.id === buildingId)
    if (!building || building.faction !== 'player' || building.progress >= 1) return
    set({
      buildings: state.buildings.filter((b) => b.id !== buildingId),
      resources: addCost(state.resources, scaleCost(BUILDING_STATS[building.type].cost, 0.75)),
      units: state.units.map((u) => u.targetId === buildingId && u.state === 'building' ? { ...u, state: 'idle' as const, targetId: undefined, path: [] } : u),
      selectedIds: state.selectedIds.filter((id) => id !== buildingId),
      demolishArmedId: undefined,
      message: MSG.buildingCancelled,
    })
    playCue('click')
  },

  demolish: (buildingId) => {
    const state = get()
    const building = state.buildings.find((b) => b.id === buildingId)
    if (!building || building.faction !== 'player' || building.type === 'headquarters') return
    if (building.progress < 1) { get().cancelConstruction(buildingId); return }
    if (state.demolishArmedId !== buildingId) { set({ demolishArmedId: buildingId, message: MSG.demolishConfirm }); playCue('error'); return }
    set({
      buildings: state.buildings.filter((b) => b.id !== buildingId),
      resources: addCost(state.resources, scaleCost(BUILDING_STATS[building.type].cost, 0.25)),
      selectedIds: [], demolishArmedId: undefined, message: MSG.demolishing,
    })
    playCue('destroy')
  },

  updateSettings: (partial) => {
    const settings = { ...get().settings, ...partial }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    configureAudio(settings)
    set({ settings })
  },
  toggleSettings: () => set({ showSettings: !get().showSettings }),

  save: () => {
    const state = get()
    try {
      localStorage.setItem(SAVE_KEY, serializeSave({
        kingdom: state.kingdom, difficulty: state.difficulty, resources: state.resources,
        enemyResources: state.enemyResources, units: state.units, buildings: state.buildings,
        nodes: state.nodes, elapsed: state.elapsed, camera: state.camera, explored: state.explored,
        controlGroups: state.controlGroups, researchedUpgrades: state.researchedUpgrades, activeResearch: state.activeResearch, researchProgress: state.researchProgress,
      }))
      set({ message: MSG.saved })
      playCue('click')
    } catch { set({ message: MSG.saveFailed }); playCue('error') }
  },

  load: () => {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    const data = restoreSave(raw)
    if (!data) { set({ message: MSG.saveCorrupt }); return false }
    // Sanitize control groups: remove dead units, validate group keys
    const sanitizedGroups: Record<number, ControlGroup> = {}
    if (data.controlGroups) {
      Object.entries(data.controlGroups).forEach(([keyStr, group]) => {
        const key = parseInt(keyStr, 10)
        if (key >= 1 && key <= 5) {
          sanitizedGroups[key] = purgeControlGroup(group, data.units)
        }
      })
    }
    set({
      kingdom: data.kingdom, difficulty: data.difficulty, resources: data.resources,
      enemyResources: data.enemyResources ?? { ...INITIAL_RESOURCES },
      units: data.units, buildings: data.buildings, nodes: data.nodes, explored: data.explored,
      elapsed: data.elapsed, camera: data.camera,
      projectiles: [], visible: [], fogMarkers: [], selectedIds: [],
      placement: undefined, preview: undefined, demolishArmedId: undefined,
      phase: 'playing', message: MSG.loaded,
      controlGroups: sanitizedGroups, rallyPointBuildingId: undefined, lastGroupKeyPressTime: {}, researchedUpgrades: data.researchedUpgrades ?? [], activeResearch: data.activeResearch, researchProgress: data.researchProgress ?? 0,
    })
    startMusic()
    return true
  },

  assignToControlGroup: (groupNum) => {
    if (groupNum < 1 || groupNum > 5) return
    const state = get()
    const group: ControlGroup = { unitIds: [...new Set(state.selectedIds.filter((id) => state.units.some((u) => u.id === id && u.faction === 'player' && u.state !== 'dead')))] }
    set({ controlGroups: { ...state.controlGroups, [groupNum]: group }, message: MSG.groupAssigned })
  },

  selectFromControlGroup: (groupNum) => {
    if (groupNum < 1 || groupNum > 5) return
    const state = get()
    const group = state.controlGroups[groupNum]
    if (!group) return
    const purged = purgeControlGroup(group, state.units)
    const liveIds = purged.unitIds
    if (!liveIds.length) { set({ controlGroups: { ...state.controlGroups, [groupNum]: purged } }); return }
    set({ selectedIds: liveIds, controlGroups: { ...state.controlGroups, [groupNum]: purged }, message: MSG.groupSelected })
  },

  setRallyPointMode: (buildingId) => set({ rallyPointBuildingId: buildingId }),

  applyRallyPoint: (x, y) => {
    const state = get()
    if (!state.rallyPointBuildingId) return
    const building = state.buildings.find((b) => b.id === state.rallyPointBuildingId)
    if (!building) return
    const updated = setRallyPoint(building, x, y)
    if (!updated.rallyPoint) return
    set({
      buildings: state.buildings.map((b) => b.id === building.id ? updated : b),
      rallyPointBuildingId: undefined,
      message: MSG.rallySet,
    })
  },

  research: (id) => {
    const state = get()
    const upgrade = UPGRADES[id]
    if (!upgrade || state.activeResearch || state.researchedUpgrades.includes(id)) return false
    const hq = state.buildings.find((b) => b.id === 'player-hq' && b.progress >= 1 && b.health > 0)
    if (!hq || !canAfford(state.resources, upgrade.cost)) return false
    set({ resources: deductCost(state.resources, upgrade.cost), activeResearch: id, researchProgress: 0 })
    return true
  },

  stopSelected: () => {
    const state = get()
    const updated = state.units.map((u) =>
      state.selectedIds.includes(u.id) ? { ...u, state: 'idle' as const, path: [], targetId: undefined, carryingAmount: 0 } : u,
    )
    set({ units: updated })
  },

  holdSelected: () => {
    const state = get()
    const updated = state.units.map((u) =>
      state.selectedIds.includes(u.id) && canHold(u) ? holdPositionAt(u) : u,
    )
    set({ units: updated })
  },

  attackMoveSelected: (x, y) => {
    const state = get()
    const destination = { x, y }
    const updated = state.units.map((u) =>
      state.selectedIds.includes(u.id) && canAttackMove(u)
        ? { ...u, state: 'attackMoving' as const, commandDestination: destination, path: routeTo(state.buildings, state.nodes, u, destination) }
        : u,
    )
    set({ units: updated })
  },

  tick: (dt) => {
    const state = get()
    if (state.phase !== 'playing') return
    const events: string[] = []
    const elapsed = state.elapsed + dt
    let resources = { ...state.resources }
    const researchedUpgrades = [...state.researchedUpgrades]
    let activeResearch = state.activeResearch
    let researchProgress = state.researchProgress
    if (activeResearch) { researchProgress += dt; if (researchProgress >= UPGRADES[activeResearch].time) { researchedUpgrades.push(activeResearch); activeResearch = undefined; researchProgress = 0 } }
    let enemyResources = { ...state.enemyResources }
    const freshProjectiles: Projectile[] = []
    let underAttack = false
    let buildings: Building[] = state.buildings.map((b) => ({ ...b, queue: [...b.queue] }))
    const nodes: ResourceNode[] = state.nodes.map((n) => ({ ...n }))
    let units: Unit[] = state.units
      .filter((u) => u.state !== 'dead')
      .map((u) => ({ ...u, attackCooldown: Math.max(0, (u.attackCooldown ?? 0) - dt) }))

    units = units.map((u) => (u.path?.length ? moveAlong(u, dt, state.kingdom) : u))

    buildings = buildings.map((b) => {
      if (b.progress >= 1) return b
      const builder = units.find((u) => u.id === b.builderId && u.state === 'building')
      if (!builder || Math.hypot(builder.x - b.x, builder.y - b.y) > 80) return b
      const next = Math.min(1, b.progress + dt / BUILDING_STATS[b.type].buildTime)
      if (next >= 1 && b.faction === 'player') { events.push(MSG.constructionDone); playCue('construct') }
      return {
        ...b, progress: next,
        health: next >= 1
          ? Math.max(b.health, Math.floor(BUILDING_STATS[b.type].maxHealth * 0.5))
          : Math.max(b.health, Math.floor(BUILDING_STATS[b.type].maxHealth * 0.4 * next)),
      }
    })

    buildings = buildings.map((b) => {
      if (b.progress < 1 || b.queue.length === 0) return b
      const progress = (b.queueProgress ?? 0) + dt
      if (progress < trainingTime(b.queue[0])) return { ...b, queueProgress: progress }
      const type = b.queue[0]
      const offset = BUILDING_STATS[b.type].footprint.width * GRID_SIZE * 0.5 + 26
      units = [...units, { id: nextId(type), type, faction: b.faction, x: b.x + offset, y: b.y + 12, health: UNIT_STATS[type].maxHealth, state: 'idle' as const }]
      if (b.faction === 'player') { events.push(MSG.trainingDone); playCue('construct') }
      return { ...b, queue: b.queue.slice(1), queueProgress: 0 }
    })

    const gatherRate = (u: Unit) => {
      const base = u.faction === 'player' ? (state.kingdom === 'rivers' ? 12 : 10) : 0
      return researchedUpgrades.includes('gathering1') && u.type === 'worker' ? base * 1.15 : base
    }
    units = units.map((u) => {
      if (u.state === 'dead') return u
      if (u.state === 'building' && u.targetId) {
        const target = buildings.find((b) => b.id === u.targetId)
        if (!target || target.progress >= 1) return { ...u, state: 'idle' as const, targetId: undefined, path: [] }
        if (Math.hypot(target.x - u.x, target.y - u.y) > 68 && !u.path?.length) return { ...u, path: routeTo(buildings, nodes, u, target) }
        return u
      }
      if (u.state === 'repairing' && u.targetId) {
        const target = buildings.find((b) => b.id === u.targetId && b.health > 0)
        const max = target ? BUILDING_STATS[target.type].maxHealth * (state.kingdom === 'mountains' ? 1.2 : 1) : 0
        if (!target || target.health >= max) return { ...u, state: 'idle' as const, targetId: undefined, path: [] }
        if (Math.hypot(target.x - u.x, target.y - u.y) > 68) {
          return u.path?.length ? u : { ...u, path: routeTo(buildings, nodes, u, target) }
        }
        const want = Math.min(REPAIR_HP_PER_SECOND * dt, max - target.health)
        const affordable = Math.min(want, resources.wood * 10)
        if (affordable > 0) {
          resources = { ...resources, wood: resources.wood - affordable / 10 }
          buildings = buildings.map((b) => (b.id === target.id ? { ...b, health: Math.min(max, b.health + affordable) } : b))
        }
        return u
      }
      if (u.state === 'gathering' && u.targetId) {
        const node = nodes.find((n) => n.id === u.targetId)
        if (!node || node.amount <= 0) return { ...u, state: 'idle' as const, targetId: undefined, path: [] }
        if (Math.hypot(node.x - u.x, node.y - u.y) > 46) {
          return u.path?.length ? u : { ...u, path: routeTo(buildings, nodes, u, node) }
        }
        const gathered = Math.min(node.amount, gatherRate(u) * dt)
        node.amount -= gathered
        const carried = (u.carryingAmount ?? 0) + gathered
        if (carried >= 25 || node.amount <= 0) {
          const dropoff = nearestDropoff(buildings, u)
          if (!dropoff) return u
          return { ...u, carrying: node.type, carryingAmount: Math.round(carried), targetId: dropoff.id, state: 'returning' as const, path: routeTo(buildings, nodes, u, dropoff) }
        }
        return { ...u, carrying: node.type, carryingAmount: carried }
      }
      if (u.state === 'returning' && u.targetId) {
        const dropoff = buildings.find((b) => b.id === u.targetId)
        if (!dropoff) return { ...u, state: 'idle' as const, targetId: undefined, path: [] }
        if (Math.hypot(dropoff.x - u.x, dropoff.y - u.y) > 56) {
          return u.path?.length ? u : { ...u, path: routeTo(buildings, nodes, u, dropoff) }
        }
        const amount = Math.round(u.carryingAmount ?? 0)
        if (amount > 0 && u.carrying) {
          const delta: Cost = { food: 0, wood: 0, stone: 0, gold: 0 }
          delta[u.carrying] = amount
          resources = addCost(resources, delta)
        }
        const again = u.carrying ? nodes.filter((n) => n.type === u.carrying && n.amount > 0).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0] : undefined
        if (again) return { ...u, targetId: again.id, carryingAmount: 0, carrying: undefined, state: 'gathering' as const, path: routeTo(buildings, nodes, u, again) }
        return { ...u, carrying: undefined, carryingAmount: 0, targetId: undefined, state: 'idle' as const, path: [] }
      }
      if (u.state === 'moving' && (!u.path || u.path.length === 0)) return { ...u, state: 'idle' as const }
      return u
    })

    const active = units.filter((u) => u.state !== 'dead' && (u.state === 'moving' || u.state === 'idle'))
    const forces = new Map<string, Point>()
    active.forEach((u, i) => {
      const peers = active.filter((v, j) => j !== i && Math.abs(v.x - u.x) < 44 && Math.abs(v.y - u.y) < 44)
      if (peers.length >= 2) forces.set(u.id, separationForce(u, peers))
    })
    units = units.map((u) => {
      const f = forces.get(u.id)
      if (!f) return u
      return { ...u, x: clamp(u.x + f.x * 26 * dt, 8, MAP_WIDTH - 8), y: clamp(u.y + f.y * 26 * dt, 8, MAP_HEIGHT - 8) }
    })


    const goalFar = (unit: Unit, target: Point) => {
      const last = unit.path?.[unit.path.length - 1]
      return !last || Math.hypot(last.x - target.x, last.y - target.y) > 90
    }
    units = units.map((u) => {
      if (u.state === 'dead' || u.type === 'worker') return u
      let target: Unit | Building | undefined
      if (u.state === 'attacking' && u.targetId) {
        target = units.find((v) => v.id === u.targetId && v.state !== 'dead' && v.faction !== u.faction)
          ?? buildings.find((b) => b.id === u.targetId && b.health > 0 && b.faction !== u.faction)
      }
      if (!target) target = acquireTarget(u, units, buildings)
      if (!target) return u.state === 'attacking' ? { ...u, state: 'idle' as const, targetId: undefined, path: [] } : u
      const distance = Math.hypot(target.x - u.x, target.y - u.y)
      if (distance > UNIT_STATS[u.type].range) {
        if (!u.path?.length || goalFar(u, target)) return { ...u, state: 'attacking' as const, targetId: target.id, path: routeTo(buildings, nodes, u, target) }
        return { ...u, state: 'attacking' as const, targetId: target.id }
      }
      const withState = { ...u, state: 'attacking' as const, targetId: target.id, path: [] }
      if ((u.attackCooldown ?? 0) > 0) return withState
      if (UNIT_STATS[u.type].range > 100) {
        freshProjectiles.push(createProjectile(u.id, u.type, u.faction, target, u.x, u.y, nextId('shot')))
        if (u.faction === 'player') playCue('ranged')
      } else {
        const hit = strike(u, target, units, state.kingdom, researchedUpgrades)
        if ('state' in hit) units = units.map((v) => (v.id === hit.id ? (hit as Unit) : v))
        else buildings = buildings.map((b) => (b.id === hit.id ? (hit as Building) : b))
        if (!('state' in hit) && hit.faction === 'player') underAttack = true
        if (u.faction === 'player' && Math.random() < 0.35) playCue('melee')
      }
      return { ...withState, attackCooldown: UNIT_STATS[u.type].cooldown }
    })

    buildings.forEach((b) => {
      if (b.type !== 'watchtower' || b.progress < 1 || b.health <= 0) return
      const readyAt = b.queueProgress ?? 0
      if (elapsed < readyAt) return
      const target = units.filter((u) => u.faction !== b.faction && u.state !== 'dead' && Math.hypot(u.x - b.x, u.y - b.y) < 240)[0]
      if (!target) return
      freshProjectiles.push(createProjectile(b.id, 'watchtower', b.faction, target, b.x, b.y, nextId('bolt')))
      buildings = buildings.map((tower) => (tower.id === b.id ? { ...tower, queueProgress: elapsed + 1.5 } : tower))
    })

    let flying: Projectile[] = [...state.projectiles, ...freshProjectiles]
    const survivors: Projectile[] = []
    flying.forEach((shot) => {
      const target = units.find((u) => u.id === shot.targetId && u.state !== 'dead')
        ?? buildings.find((b) => b.id === shot.targetId && b.health > 0)
      if (!target) return
      const advanced = advanceProjectile(shot, target, 4 * dt)
      if (!projectileReached(advanced, target)) { survivors.push(advanced); return }
      const proxy: Unit = units.find((u) => u.id === shot.attackerId)
        ?? { id: shot.attackerId, type: shot.attackerType === 'watchtower' ? 'archer' : shot.attackerType, faction: shot.faction, x: shot.x, y: shot.y, health: 1, state: 'attacking' as const }
      const hit = strikeUnitOf(shot.attackerType, proxy, target, units, state.kingdom, researchedUpgrades)
      if ('state' in hit) units = units.map((v) => (v.id === hit.id ? (hit as Unit) : v))
      else { buildings = buildings.map((b) => (b.id === hit.id ? (hit as Building) : b)); if (hit.faction === 'player') underAttack = true }
      if (hit.health <= 0) playCue('destroy')
    })
    flying = survivors

    const playerHq = buildings.find((b) => b.id === 'player-hq')
    if (!underAttack && playerHq) underAttack = units.some((u) => u.faction === 'enemy' && u.state === 'attacking' && Math.hypot(u.x - playerHq.x, u.y - playerHq.y) < 430)
    if (underAttack) events.push(MSG.baseUnderAttack)

    const profile = aiProfile(state.difficulty)
    const ticked = Math.floor(elapsed / profile.thinkInterval) !== Math.floor(state.elapsed / profile.thinkInterval)
    let aiIdCounter = state.aiIdCounter
    if (ticked) {
      const ai = runAi({
        resources: enemyResources, units, buildings, nodes,
        elapsed, difficulty: state.difficulty, playerBaseSeen: { x: 520, y: 690 }, underAttack, idCounter: aiIdCounter,
      })
      enemyResources = ai.resources
      units = ai.units
      buildings = ai.buildings
      aiIdCounter = ai.idCounter
    }

    const visibleSet = computeVisibleCells(units, buildings, 'player')
    const visible = [...visibleSet]
    const explored = mergeExplored(state.explored, visible)
    const enemyViz = units.some((u) => u.faction === 'enemy' && u.state !== 'dead' && visibleSet.has(cellKey(toGrid(u).col, toGrid(u).row)))
    const enemyWas = units.some((u) => u.faction === 'enemy' && u.state !== 'dead' && state.visible.includes(cellKey(toGrid(u).col, toGrid(u).row)))
    if (enemyViz && !enemyWas && Math.floor(elapsed) !== Math.floor(state.elapsed)) events.push(MSG.enemySighted)
    const spotted = buildings
      .filter((b) => b.faction === 'enemy' && b.health > 0)
      .filter((b) => visibleSet.has(cellKeyOf(toGrid(b))))
      .map((b): FogMarker => ({ id: b.id, type: b.type, x: b.x, y: b.y, seenAt: elapsed }))
    let fogMarkers = [...state.fogMarkers, ...spotted]
      .filter((marker, index, list) => list.findIndex((m) => m.id === marker.id) === index)
      .filter((marker) => elapsed - marker.seenAt < OUTDATED_MARKER_SECONDS)
      .filter((marker) => buildings.some((b) => b.id === marker.id && b.health > 0))
    if (fogMarkers.length === state.fogMarkers.length) fogMarkers = state.fogMarkers

    let lastIdleAlert = state.lastIdleAlert
    if (elapsed - lastIdleAlert > 25 && units.some((u) => u.faction === 'player' && u.type === 'worker' && u.state === 'idle')) {
      events.push(MSG.idleWorker)
      lastIdleAlert = elapsed
    }

    const phase = isVictory(buildings) ? 'victory' as const : isDefeat(buildings) ? 'defeat' as const : 'playing' as const
    if (phase === 'victory' && state.phase === 'playing') playCue('victory')
    if (phase === 'defeat' && state.phase === 'playing') playCue('defeat')

    set({
      resources, enemyResources, researchedUpgrades, activeResearch, researchProgress, units, buildings, nodes, projectiles: flying,
      elapsed, visible, explored, fogMarkers, phase, aiIdCounter, lastIdleAlert,
      message: events.length ? events[events.length - 1] : state.message,
    })
  },
}))

function cellKeyOf(cell: GridPoint): string { return cellKey(cell.col, cell.row) }
function strikeUnitOf(attackerType: UnitType | 'watchtower', attacker: Unit, target: Unit | Building, units: Unit[], kingdom: Kingdom, researchedUpgrades: import('./game').UpgradeId[] = []): Unit | Building {
  void attackerType
  return strike(attacker, target, units, kingdom, researchedUpgrades)
}
export const factionOf = (id: string, units: Unit[], buildings: Building[]) =>
  units.find((u) => u.id === id)?.faction ?? buildings.find((b) => b.id === id)?.faction
