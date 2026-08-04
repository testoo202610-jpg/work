import { create } from 'zustand'
import { addCost, BUILDING_STATS, canAfford, capacity, deductCost, INITIAL_RESOURCES, population, serializeSave, UNIT_STATS } from './game'
import type { Difficulty, Faction, Kingdom, ResourceNode, SaveData, Unit, UnitType, Building, BuildingType, Point } from './game'

interface GameState {
  kingdom: Kingdom
  difficulty: Difficulty
  resources: typeof INITIAL_RESOURCES
  units: Unit[]
  buildings: Building[]
  nodes: ResourceNode[]
  elapsed: number
  camera: Point
  phase: 'menu' | 'playing' | 'victory' | 'defeat'
  selectedIds: string[]
  message: string
  setSetup: (kingdom: Kingdom, difficulty: Difficulty) => void
  start: () => void
  select: (ids: string[], additive?: boolean) => void
  tick: (dt: number) => void
  moveSelected: (x: number, y: number) => void
  gatherSelected: (nodeId: string) => void
  placeBuilding: (type: BuildingType, x: number, y: number) => boolean
  train: (buildingId: string, type: UnitType) => boolean
  attack: (targetId: string) => void
  save: () => void
  load: () => boolean
  setCamera: (camera: Point) => void
  clearMessage: () => void
}

const initialUnits = (): Unit[] => [1, 2, 3, 4].map((id) => ({ id: `worker-${id}`, type: 'worker', faction: 'player', x: 430 + id * 34, y: 760, health: UNIT_STATS.worker.maxHealth, state: 'idle' }))
const initialBuildings = (): Building[] => [
  { id: 'player-hq', type: 'headquarters', faction: 'player', x: 520, y: 690, health: 1200, progress: 1, queue: [] },
  { id: 'enemy-hq', type: 'headquarters', faction: 'enemy', x: 1660, y: 520, health: 1200, progress: 1, queue: [] },
]
const initialNodes = (): ResourceNode[] => [
  { id: 'food-1', type: 'food', x: 300, y: 560, amount: 1800, maxAmount: 1800 }, { id: 'wood-1', type: 'wood', x: 720, y: 850, amount: 1600, maxAmount: 1600 },
  { id: 'stone-1', type: 'stone', x: 920, y: 420, amount: 1400, maxAmount: 1400 }, { id: 'gold-1', type: 'gold', x: 1320, y: 780, amount: 1100, maxAmount: 1100 },
  { id: 'food-2', type: 'food', x: 1810, y: 350, amount: 1800, maxAmount: 1800 }, { id: 'wood-2', type: 'wood', x: 1510, y: 240, amount: 1600, maxAmount: 1600 },
  { id: 'stone-2', type: 'stone', x: 1880, y: 820, amount: 1400, maxAmount: 1400 }, { id: 'gold-2', type: 'gold', x: 1120, y: 980, amount: 1100, maxAmount: 1100 },
]

export const useGameStore = create<GameState>((set, get) => ({
  kingdom: 'rivers', difficulty: 'medium', resources: INITIAL_RESOURCES, units: [], buildings: [], nodes: [], elapsed: 0, camera: { x: 640, y: 440 }, phase: 'menu', selectedIds: [], message: '',
  setSetup: (kingdom, difficulty) => set({ kingdom, difficulty }),
  start: () => set({ phase: 'playing', resources: { ...INITIAL_RESOURCES }, units: initialUnits(), buildings: initialBuildings(), nodes: initialNodes(), elapsed: 0, selectedIds: [] }),
  select: (ids, additive = false) => set({ selectedIds: additive ? [...new Set([...get().selectedIds, ...ids])] : ids }),
  setCamera: (camera) => set({ camera }),
  clearMessage: () => set({ message: '' }),
  moveSelected: (x, y) => set((state) => ({ units: state.units.map((u, i) => state.selectedIds.includes(u.id) ? { ...u, x: x + (i % 3) * 34 - 34, y: y + Math.floor(i / 3) * 34 - 17, state: 'moving', targetId: undefined } : u) })),
  gatherSelected: (nodeId) => set((state) => ({ units: state.units.map((u) => state.selectedIds.includes(u.id) && u.type === 'worker' ? { ...u, targetId: nodeId, state: 'gathering' } : u) })),
  attack: (targetId) => set((state) => ({ units: state.units.map((u) => state.selectedIds.includes(u.id) ? { ...u, targetId, state: 'attacking' } : u) })),
  placeBuilding: (type, x, y) => { const state = get(); const cost = BUILDING_STATS[type].cost; if (!canAfford(state.resources, cost) || state.buildings.some((b) => Math.abs(b.x - x) < 70 && Math.abs(b.y - y) < 55)) { set({ message: 'لا توجد موارد كافية أو المكان مشغول' }); return false } const id = `${type}-${Date.now()}`; set({ resources: deductCost(state.resources, cost), buildings: [...state.buildings, { id, type, faction: 'player', x, y, health: 1, progress: 0, queue: [] }], message: 'بدأ البناء' }); return true },
  train: (buildingId, type) => { const state = get(); const building = state.buildings.find((b) => b.id === buildingId); const stats = UNIT_STATS[type]; if (!building || building.faction !== 'player' || !canAfford(state.resources, stats.cost) || population(state.units, 'player') + stats.population > capacity(state.buildings, 'player')) { set({ message: population(state.units, 'player') >= capacity(state.buildings, 'player') ? 'وصلت إلى حد السكان' : 'لا توجد موارد كافية' }); return false } set({ resources: deductCost(state.resources, stats.cost), buildings: state.buildings.map((b) => b.id === buildingId ? { ...b, queue: [...b.queue, type] } : b) }); return true },
  tick: (dt) => { const state = get(); if (state.phase !== 'playing') return; let resources = state.resources; let units = state.units; let buildings = state.buildings.map((b) => ({ ...b })); const kingdomBonus = state.kingdom === 'rivers' ? 1.2 : 1; buildings = buildings.map((b) => b.progress < 1 ? { ...b, progress: Math.min(1, b.progress + dt / BUILDING_STATS[b.type].buildTime), health: Math.min(BUILDING_STATS[b.type].maxHealth, Math.max(1, b.health + dt * 40)) } : b); units = units.map((u) => { if (u.state === 'dead') return u; if (u.state === 'gathering' && u.targetId) { const node = state.nodes.find((n) => n.id === u.targetId); if (node && node.amount > 0) { const amount = Math.min(node.amount, dt * 7 * kingdomBonus); resources = addCost(resources, { food: node.type === 'food' ? amount : 0, wood: node.type === 'wood' ? amount : 0, stone: node.type === 'stone' ? amount : 0, gold: node.type === 'gold' ? amount : 0 }); } } return u }); const aiUnits = units.filter((u) => u.faction === 'enemy' && u.state !== 'dead'); if (state.elapsed > 22 && aiUnits.length < 5) { units = [...units, { id: `enemy-scout-${Math.floor(state.elapsed)}`, type: 'swordsman', faction: 'enemy', x: 1520, y: 560, health: UNIT_STATS.swordsman.maxHealth, state: 'attacking', targetId: 'player-hq' }] } if (state.elapsed > 8) { units = units.map((u) => { if (u.faction !== 'enemy' || !u.targetId) return u; const target = [...units, ...buildings].find((item) => item.id === u.targetId); if (!target) return { ...u, targetId: 'player-hq' }; const dx = target.x - u.x; const dy = target.y - u.y; const dist = Math.hypot(dx, dy); if (dist > 40) return { ...u, x: u.x + (dx / dist) * UNIT_STATS[u.type].speed * dt, y: u.y + (dy / dist) * UNIT_STATS[u.type].speed * dt }; const targetBuilding = buildings.find((b) => b.id === target.id); if (targetBuilding) buildings = buildings.map((b) => b.id === target.id ? { ...b, health: Math.max(0, b.health - UNIT_STATS[u.type].damage * dt) } : b); return u }) } const phase = buildings.some((b) => b.faction === 'enemy' && b.type === 'headquarters' && b.health > 0) ? (buildings.some((b) => b.faction === 'player' && b.type === 'headquarters' && b.health > 0) ? 'playing' : 'defeat') : 'victory'; set({ resources, units, buildings, elapsed: state.elapsed + dt, phase }); },
  save: () => { const state = get(); const data: Omit<SaveData, 'version'> = { kingdom: state.kingdom, difficulty: state.difficulty, resources: state.resources, units: state.units, buildings: state.buildings, nodes: state.nodes, elapsed: state.elapsed, camera: state.camera }; localStorage.setItem('dragon-kingdoms-save', serializeSave(data)); set({ message: 'تم حفظ اللعبة' }) },
  load: () => { const raw = localStorage.getItem('dragon-kingdoms-save'); if (!raw) return false; try { const data = JSON.parse(raw) as SaveData; if (data.version !== 1) return false; set({ ...data, phase: 'playing', selectedIds: [], message: 'تم تحميل اللعبة' }); return true } catch { set({ message: 'ملف الحفظ تالف' }); return false } },
}))

export const factionOf = (id: string, units: Unit[], buildings: Building[]): Faction | undefined => units.find((u) => u.id === id)?.faction ?? buildings.find((b) => b.id === id)?.faction
