export type Kingdom = 'flame' | 'rivers' | 'mountains'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type ResourceType = 'food' | 'wood' | 'stone' | 'gold'
export type UnitType = 'worker' | 'swordsman' | 'archer' | 'cavalry' | 'commander'
export type BuildingType = 'headquarters' | 'barracks' | 'stable' | 'farm' | 'storage' | 'watchtower' | 'wall'
export type Faction = 'player' | 'enemy'

export interface Point { x: number; y: number }
export interface GridPoint { col: number; row: number }
export interface Cost { food: number; wood: number; stone: number; gold: number }
export interface BuildingFootprint { width: number; height: number }
export interface PathGrid { width: number; height: number; blocked: boolean[][] }
export interface UnitStats { maxHealth: number; speed: number; damage: number; range: number; cooldown: number; cost: Cost; population: number }
export interface BuildingStats { maxHealth: number; armor: number; cost: Cost; population: number; buildTime: number }
export interface Unit { id: string; type: UnitType; faction: Faction; x: number; y: number; health: number; targetId?: string; carrying?: ResourceType; state: 'idle' | 'moving' | 'gathering' | 'returning' | 'attacking' | 'dead' }
export interface Building { id: string; type: BuildingType; faction: Faction; x: number; y: number; health: number; progress: number; queue: UnitType[] }
export interface ResourceNode { id: string; type: ResourceType; x: number; y: number; amount: number; maxAmount: number }
export interface SaveData { version: 1; kingdom: Kingdom; difficulty: Difficulty; resources: Cost; units: Unit[]; buildings: Building[]; nodes: ResourceNode[]; elapsed: number; camera: Point }

export const KINGDOMS: Record<Kingdom, { name: string; color: number; description: string; bonuses: string }> = {
  flame: { name: 'مملكة اللهب', color: 0xef6c4d, description: 'محاربون شرسون يضربون بقوة.', bonuses: '+10٪ ضرر عسكري' },
  rivers: { name: 'مملكة الأنهار', color: 0x55b8c9, description: 'اقتصاد سريع وحركة رشيقة.', bonuses: '+20٪ جمع و +15٪ سرعة عمال' },
  mountains: { name: 'مملكة الجبال', color: 0x9d8bd3, description: 'حصون صلبة ودفاع متين.', bonuses: '+20٪ صحة المباني والأبراج' },
}
export const UNIT_STATS: Record<UnitType, UnitStats> = {
  worker: { maxHealth: 55, speed: 95, damage: 5, range: 28, cooldown: 1.1, cost: { food: 50, wood: 0, stone: 0, gold: 0 }, population: 1 },
  swordsman: { maxHealth: 110, speed: 75, damage: 17, range: 34, cooldown: 0.9, cost: { food: 70, wood: 20, stone: 0, gold: 0 }, population: 1 },
  archer: { maxHealth: 70, speed: 78, damage: 14, range: 190, cooldown: 1.3, cost: { food: 45, wood: 45, stone: 0, gold: 10 }, population: 1 },
  cavalry: { maxHealth: 150, speed: 135, damage: 28, range: 38, cooldown: 1.2, cost: { food: 100, wood: 0, stone: 0, gold: 70 }, population: 2 },
  commander: { maxHealth: 260, speed: 82, damage: 32, range: 42, cooldown: 0.9, cost: { food: 150, wood: 40, stone: 0, gold: 120 }, population: 2 },
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

export function population(units: Unit[], faction: Faction): number { return units.filter((u) => u.faction === faction && u.state !== 'dead').reduce((sum, u) => sum + UNIT_STATS[u.type].population, 0) }
export function capacity(buildings: Building[], faction: Faction): number { return buildings.filter((b) => b.faction === faction && b.health > 0).reduce((sum, b) => sum + BUILDING_STATS[b.type].population, 0) }
export function canAfford(resources: Cost, cost: Cost): boolean { return (Object.keys(cost) as ResourceType[]).every((key) => resources[key] >= cost[key]) }
export function deductCost(resources: Cost, cost: Cost): Cost { return { food: resources.food - cost.food, wood: resources.wood - cost.wood, stone: resources.stone - cost.stone, gold: resources.gold - cost.gold } }
export function addCost(resources: Cost, amount: Cost): Cost { return { food: resources.food + amount.food, wood: resources.wood + amount.wood, stone: resources.stone + amount.stone, gold: resources.gold + amount.gold } }
export function damageAfterArmor(damage: number, armor: number): number { return Math.max(1, damage - armor) }
export function applyDamage(health: number, damage: number, armor = 0): number { return Math.max(0, health - damageAfterArmor(damage, armor)) }
export function isVictory(buildings: Building[]): boolean { return !buildings.some((b) => b.faction === 'enemy' && b.type === 'headquarters' && b.health > 0) }
export function isDefeat(buildings: Building[]): boolean { return !buildings.some((b) => b.faction === 'player' && b.type === 'headquarters' && b.health > 0) }
export function gatherNode(node: ResourceNode, requested: number): { node: ResourceNode; gathered: number } { const gathered = Math.min(requested, node.amount); return { node: { ...node, amount: node.amount - gathered }, gathered } }
export function serializeSave(data: Omit<SaveData, 'version'>): string { return JSON.stringify({ ...data, version: 1 }) }
export function restoreSave(raw: string): SaveData | null { try { const parsed: unknown = JSON.parse(raw); if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) return null; return parsed as SaveData } catch { return null } }
export const GRID_SIZE = 40
export function toGrid(point: Point): GridPoint { return { col: Math.floor(point.x / GRID_SIZE), row: Math.floor(point.y / GRID_SIZE) } }
export function fromGrid(point: GridPoint): Point { return { x: point.col * GRID_SIZE + GRID_SIZE / 2, y: point.row * GRID_SIZE + GRID_SIZE / 2 } }
export function footprintCells(type: BuildingType, origin: GridPoint): GridPoint[] { const footprint = BUILDING_STATS[type].footprint; return Array.from({ length: footprint.width * footprint.height }, (_, index) => ({ col: origin.col + index % footprint.width, row: origin.row + Math.floor(index / footprint.width) })) }
export function isPlacementValid(type: BuildingType, origin: GridPoint, mapWidth: number, mapHeight: number, buildings: Building[], nodes: ResourceNode[]): boolean { const cells = footprintCells(type, origin); if (cells.some((cell) => cell.col < 0 || cell.row < 0 || cell.col >= mapWidth || cell.row >= mapHeight)) return false; if (cells.some((cell) => nodes.some((node) => { const nodeCell = toGrid(node); return nodeCell.col === cell.col && nodeCell.row === cell.row }))) return false; return !cells.some((cell) => buildings.some((building) => footprintCells(building.type, toGrid({ x: building.x - BUILDING_STATS[building.type].footprint.width * GRID_SIZE / 2, y: building.y - BUILDING_STATS[building.type].footprint.height * GRID_SIZE / 2 })).some((occupied) => occupied.col === cell.col && occupied.row === cell.row))) }
export function buildPath(grid: PathGrid, start: GridPoint, goal: GridPoint): GridPoint[] { const key = (point: GridPoint) => `${point.col},${point.row}`; const inside = (point: GridPoint) => point.col >= 0 && point.row >= 0 && point.col < grid.width && point.row < grid.height; const open: GridPoint[] = [start]; const came = new Map<string, GridPoint>(); const cost = new Map<string, number>([[key(start), 0]]); const heuristic = (point: GridPoint) => Math.abs(point.col - goal.col) + Math.abs(point.row - goal.row); while (open.length) { open.sort((a, b) => (cost.get(key(a)) ?? Infinity) + heuristic(a) - ((cost.get(key(b)) ?? Infinity) + heuristic(b))); const current = open.shift()!; if (current.col === goal.col && current.row === goal.row) { const path: GridPoint[] = [current]; let cursor = current; while (came.has(key(cursor))) { cursor = came.get(key(cursor))!; path.unshift(cursor) } return path } for (const delta of [{ col: 1, row: 0 }, { col: -1, row: 0 }, { col: 0, row: 1 }, { col: 0, row: -1 }, { col: 1, row: 1 }, { col: -1, row: -1 }, { col: 1, row: -1 }, { col: -1, row: 1 }]) { const next = { col: current.col + delta.col, row: current.row + delta.row }; if (!inside(next) || grid.blocked[next.row]?.[next.col]) continue; const nextKey = key(next); const nextCost = (cost.get(key(current)) ?? Infinity) + (delta.col !== 0 && delta.row !== 0 ? 1.414 : 1); if (nextCost < (cost.get(nextKey) ?? Infinity)) { came.set(nextKey, current); cost.set(nextKey, nextCost); if (!open.some((point) => point.col === next.col && point.row === next.row)) open.push(next) } } } return [] }
