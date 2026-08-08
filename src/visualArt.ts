import Phaser from 'phaser'
import { ISO, worldToIso } from './isometric'
import type { Unit, Faction, Building } from './game'

export type VisualState = 'idle' | 'walk' | 'attack' | 'work' | 'hurt' | 'dead'

export interface ArtContext {
  graphics: Phaser.GameObjects.Graphics
  time: number
  selected: boolean
  faction: Faction
  state: VisualState
  facing: number
}

const palette = {
  skin: 0xe8bd96, leather: 0x75462e, cloth: 0x4a8674, clothEnemy: 0x9a4a4c,
  steel: 0xc4d0d0, steelDark: 0x52666a, wood: 0x7f542f, gold: 0xe1b85e,
  horse: 0x7a4d35, horseLight: 0xb98155, horseDark: 0x4d3025,
}

export function visualState(unit: Unit, time: number): VisualState {
  if (unit.state === 'dead') return 'dead'
  if (unit.state === 'gathering' || unit.state === 'building') return 'work'
  if (unit.state === 'attacking') return 'attack'
  if (unit.path?.length) return 'walk'
  if ((unit.attackCooldown ?? 0) > 0) return 'attack'
  return time % 4 < 0.25 ? 'idle' : 'idle'
}

export function unitFacing(unit: Unit): number {
  const next = unit.path?.[0]
  if (!next) return 0
  return Math.atan2(next.y - unit.y, next.x - unit.x)
}

function shadow(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number): void {
  g.fillStyle(0x08130f, 0.28); g.fillEllipse(x, y + 8, width, width * 0.28)
}

function banner(g: Phaser.GameObjects.Graphics, x: number, y: number, faction: Faction): void {
  const color = faction === 'player' ? 0x49b6aa : 0xd35a5a
  g.fillStyle(color); g.fillRect(x, y, 3, 22); g.fillTriangle(x + 3, y, x + 15, y + 5, x + 3, y + 10)
}

export function drawUnit(g: Phaser.GameObjects.Graphics, unit: Unit, context: Omit<ArtContext, 'graphics'>): void {
  const p = worldToIso(unit)
  const state = context.state
  const bob = state === 'walk' ? Math.sin(context.time * 0.018 + unit.x) * 2 : state === 'idle' ? Math.sin(context.time * 0.003 + unit.x) : 0
  const lean = state === 'attack' ? 4 : 0
  const accent = context.faction === 'player' ? palette.cloth : palette.clothEnemy
  const radius = unit.type === 'cavalry' ? 20 : 13
  shadow(g, p.x, p.y, unit.type === 'cavalry' ? 42 : 27)
  if (context.selected) { g.lineStyle(2, palette.gold, 0.95); g.strokeEllipse(p.x, p.y + 8, unit.type === 'cavalry' ? 48 : 34, 12) }

  if (unit.type === 'cavalry') {
    drawHorse(g, p.x, p.y + bob, context, accent)
  } else {
    // legs and tunic
    g.fillStyle(palette.leather); g.fillRect(p.x - 8 + lean, p.y - 5 + bob, 5, 14); g.fillRect(p.x + 3 + lean, p.y - 5 + bob, 5, 14)
    g.fillStyle(accent); g.fillEllipse(p.x + lean, p.y - 15 + bob, radius * 1.5, 26)
    // head / helmet
    g.fillStyle(palette.skin); g.fillCircle(p.x + lean, p.y - 31 + bob, 7)
    if (unit.type === 'swordsman' || unit.type === 'commander') {
      g.fillStyle(palette.steel); g.fillRect(p.x - 8 + lean, p.y - 39 + bob, 16, 5)
      g.fillStyle(palette.steelDark); g.fillRect(p.x - 9 + lean, p.y - 35 + bob, 3, 8)
      g.fillStyle(palette.leather); g.fillCircle(p.x - 11 + lean, p.y - 16 + bob, 8)
      g.lineStyle(3, palette.steel); g.lineBetween(p.x + 7 + lean, p.y - 16 + bob, p.x + 17 + lean + (state === 'attack' ? 7 : 0), p.y - 37 + bob)
    } else if (unit.type === 'archer') {
      g.lineStyle(2, palette.gold); g.strokeCircle(p.x + 10 + lean, p.y - 20 + bob, 10)
      g.lineStyle(2, palette.wood); g.lineBetween(p.x + 10 + lean, p.y - 30 + bob, p.x + 10 + lean, p.y - 10 + bob)
      g.lineStyle(2, palette.wood); g.lineBetween(p.x - 8 + lean, p.y - 17 + bob, p.x - 14 + lean, p.y - 32 + bob)
    } else {
      g.lineStyle(3, palette.wood); g.lineBetween(p.x + 6 + lean, p.y - 15 + bob, p.x + 17 + lean, p.y - 31 + bob)
    }
    if (unit.type === 'commander') banner(g, p.x + 14, p.y - 48 + bob, context.faction)
  }
  if (state === 'work') { g.lineStyle(3, palette.gold); g.lineBetween(p.x + 8, p.y - 14 + bob, p.x + 19, p.y - 26 + bob); g.fillStyle(palette.gold); g.fillCircle(p.x + 20, p.y - 27 + bob, 3) }
  if (state === 'hurt') { g.fillStyle(0xe05d4f, 0.6); g.fillCircle(p.x, p.y - 22 + bob, 4) }
}

function drawHorse(g: Phaser.GameObjects.Graphics, x: number, y: number, context: Omit<ArtContext, 'graphics'>, accent: number): void {
  const stride = context.state === 'walk' ? Math.sin(context.time * 0.02) * 5 : context.state === 'attack' ? 7 : 0
  g.fillStyle(palette.horse); g.fillEllipse(x, y - 17, 44, 24)
  g.fillStyle(palette.horseLight); g.fillEllipse(x + 20, y - 29, 18, 16)
  g.fillStyle(palette.horseDark); g.fillTriangle(x + 24, y - 38, x + 31, y - 46, x + 35, y - 34)
  g.lineStyle(4, palette.horseDark); g.lineBetween(x - 14, y - 9, x - 18 + stride, y + 8); g.lineBetween(x + 12, y - 9, x + 16 - stride, y + 8)
  g.lineStyle(3, palette.horseDark); g.lineBetween(x - 22, y - 24, x - 31, y - 38)
  g.fillStyle(accent); g.fillEllipse(x - 2, y - 40, 18, 22)
  g.fillStyle(palette.skin); g.fillCircle(x - 2, y - 56, 6)
  g.lineStyle(3, palette.steel); g.lineBetween(x + 4, y - 42, x + 18, y - 58)
  banner(g, x - 18, y - 70, context.faction)
}

export function drawBuildingArt(g: Phaser.GameObjects.Graphics, building: Building, selected: boolean): void {
  const p = worldToIso(building)
  const color = building.faction === 'player' ? 0x3f89a8 : 0xa44850
  const accent = building.faction === 'player' ? 0x49b6aa : 0xd35a5a
  const fp = { width: building.type === 'wall' ? 1 : 2, height: building.type === 'wall' ? 1 : 2 }
  const w = fp.width * ISO.tileWidth
  const h = fp.height * ISO.tileHeight
  g.fillStyle(0x08130f, 0.25); g.fillEllipse(p.x, p.y + 8, w * 0.85, h * 0.45)
  g.fillStyle(color, building.progress < 1 ? 0.45 : 1)
  g.fillTriangle(p.x - w / 2, p.y, p.x, p.y + h / 2, p.x + w / 2, p.y)
  g.fillStyle(0x91613e); g.fillTriangle(p.x - w / 2, p.y, p.x, p.y - h / 2, p.x, p.y + h / 2)
  g.fillStyle(0xc38e5e); g.fillTriangle(p.x, p.y - h / 2, p.x + w / 2, p.y, p.x, p.y + h / 2)
  const height = building.type === 'headquarters' ? 70 : building.type === 'watchtower' ? 78 : 40
  g.fillStyle(0x8b5b3e); g.fillRect(p.x - 14, p.y - height, 28, height)
  g.fillStyle(0x5b3a2e); g.fillTriangle(p.x - 22, p.y - height, p.x, p.y - height - 24, p.x + 22, p.y - height)
  if (building.type === 'stable') { g.fillStyle(0xd7b06c); g.fillRect(p.x - 18, p.y - 24, 36, 18); g.lineStyle(3, palette.wood); g.lineBetween(p.x - 18, p.y - 24, p.x + 18, p.y - 6) }
  if (building.type === 'farm') { g.fillStyle(0x70482f); for (let i = -2; i <= 2; i++) g.fillRect(p.x + i * 9 - 2, p.y - 18, 4, 30) }
  if (building.type === 'storage') { g.fillStyle(0xd6a056); g.fillCircle(p.x - 11, p.y - 12, 7); g.fillCircle(p.x + 11, p.y - 12, 7) }
  if (building.type === 'headquarters' || building.type === 'barracks') banner(g, p.x + 16, p.y - height - 18, building.faction)
  g.lineStyle(selected ? 4 : 2, selected ? palette.gold : accent, 0.95); g.strokeEllipse(p.x, p.y, w, h)
}
