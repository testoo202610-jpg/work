import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { BUILDING_STATS, DEFAULT_FOG_COLOR, fromGrid, GRID_SIZE, isPlacementValid, MAP_COLS, MAP_HEIGHT, MAP_ROWS, MAP_WIDTH, toGrid, UNIT_STATS } from './game'
import type { Building, ResourceNode } from './game'
import { useGameStore } from './store'
import { ISO, isoDepth, isoToWorld, worldToIso } from './isometric'
import { diamondPath, drawIsoShadow } from './isoRender'

const colors: Record<string, number> = { food: 0x79b957, wood: 0x9b673d, stone: 0xa7b1b8, gold: 0xf0c44c }
const UNIT_COLORS: Record<string, number> = { worker: 0x79c7a8, swordsman: 0x65b7e8, archer: 0x80c8ff, cavalry: 0xf2a55b, commander: 0xf1ce70 }
const PLAYER_ACCENT = 0x4db6ac
const ENEMY_ACCENT = 0xd45a5a

let sceneRef: RTSScene | null = null
export function centerCameraAt(x: number, y: number): void { sceneRef?.centerOn(worldToIso({ x, y }).x, worldToIso({ x, y }).y) }
export const sceneRegistry = { set(scene: RTSScene) { sceneRef = scene }, clear(scene: RTSScene) { if (sceneRef === scene) sceneRef = null }, get() { return sceneRef } }

class RTSScene extends Phaser.Scene {
  private last = 0
  private dragStart?: Phaser.Math.Vector2
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private terrainLayer!: Phaser.GameObjects.Graphics
  private entityLayer!: Phaser.GameObjects.Graphics
  private fogLayer!: Phaser.GameObjects.Graphics
  private overlayLayer!: Phaser.GameObjects.Graphics
  private dragBox?: Phaser.GameObjects.Rectangle
  constructor() { super('rts') }

  create() {
    sceneRegistry.set(this)
    this.cameras.main.setBounds(0, 0, 2048, 1400)
    this.cameras.main.setZoom(0.82)
    this.cameras.main.centerOn(ISO.originX, 500)
    // persistent layers — never removed, only redrawn
    this.terrainLayer = this.add.graphics()
    this.entityLayer = this.add.graphics()
    this.fogLayer = this.add.graphics()
    this.overlayLayer = this.add.graphics()
    this.events.on(Phaser.Scenes.Events.DESTROY, () => {
      this.input.removeAllListeners()
      this.input.keyboard?.removeAllListeners()
      sceneRegistry.clear(this)
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const state = useGameStore.getState()
      if (state.placement) {
        const world = isoToWorld({ x: pointer.worldX, y: pointer.worldY })
        const snapped = fromGrid(toGrid(world))
        state.updatePreview(snapped.x, snapped.y)
      }
      if (this.dragStart) this.children.list.filter((c) => c.name === 'dragbox').forEach((c) => c.destroy())
    })
    this.input.mouse?.disableContextMenu()
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) return
      const state = useGameStore.getState()
      if (state.placement) { state.confirmPlacement(); return }
      if (pointer.leftButtonDown()) this.dragStart = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const store = useGameStore.getState()
      if (pointer.button === 2) {
        if (store.placement) { store.cancelPlacement(); return }
        if (store.rallyPointBuildingId) { const world = isoToWorld({ x: pointer.worldX, y: pointer.worldY }); store.applyRallyPoint(world.x, world.y); return }
        const hit = this.hit(pointer.worldX, pointer.worldY)
        const world = isoToWorld({ x: pointer.worldX, y: pointer.worldY })
        if (hit?.kind === 'node') store.gatherSelected(hit.id)
        else if (hit) store.attack(hit.id)
        else if (store.selectedIds.length > 0 && this.keys?.shift?.isDown) store.attackMoveSelected(world.x, world.y)
        else store.moveSelected(world.x, world.y)
        return
      }
      if (pointer.button === 0 && this.dragStart) {
        const distance = Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, pointer.worldX, pointer.worldY)
        if (distance > 14) {
          const x1 = Math.min(this.dragStart.x, pointer.worldX)
          const x2 = Math.max(this.dragStart.x, pointer.worldX)
          const y1 = Math.min(this.dragStart.y, pointer.worldY)
          const y2 = Math.max(this.dragStart.y, pointer.worldY)
          const a = isoToWorld({ x: x1, y: y1 })
          const b = isoToWorld({ x: x2, y: y2 })
          store.select(store.units.filter((u) => u.faction === 'player' && u.state !== 'dead' && u.x >= Math.min(a.x, b.x) && u.x <= Math.max(a.x, b.x) && u.y >= Math.min(a.y, b.y) && u.y <= Math.max(a.y, b.y)).map((u) => u.id))
        } else {
          const hit = this.hit(pointer.worldX, pointer.worldY)
          store.select(hit ? [hit.id] : [])
        }
        this.dragStart = undefined
      }
    })
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.0007, 0.55, 1.2))
    })
    const keyboard = this.input.keyboard
    if (keyboard) {
      this.keys = keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as Record<string, Phaser.Input.Keyboard.Key>
      keyboard.on('keydown-ESC', () => useGameStore.getState().cancelPlacement())
      keyboard.on('keydown-DELETE', () => {
        const store = useGameStore.getState()
        const building = store.selectedIds.map((id) => store.buildings.find((b) => b.id === id)).find(Boolean)
        if (building) store.demolish(building.id)
      })
      keyboard.on('keydown-BACKSPACE', () => {
        const store = useGameStore.getState()
        const building = store.selectedIds.map((id) => store.buildings.find((b) => b.id === id)).find(Boolean)
        if (building) store.demolish(building.id)
      })
      // Control groups (1-5): assign on first press, select on double press;
      // Shift adds the current selection instead of replacing the group.
      for (let i = 1; i <= 5; i++) {
        keyboard.on(`keydown-${i}`, () => {
          const store = useGameStore.getState()
          const now = Date.now()
          const lastPress = store.lastGroupKeyPressTime[i] ?? 0
          if (now - lastPress < 300) {
            store.selectFromControlGroup(i)
          } else if (this.keys?.shift?.isDown) {
            const existing = store.controlGroups[i]?.unitIds ?? []
            const additions = store.selectedIds.filter((id) => store.units.some((u) => u.id === id && u.faction === 'player' && u.state !== 'dead'))
            useGameStore.setState({ controlGroups: { ...store.controlGroups, [i]: { unitIds: [...new Set([...existing, ...additions])] } }, message: 'تم تحديث المجموعة' })
          } else {
            store.assignToControlGroup(i)
          }
          store.lastGroupKeyPressTime[i] = now
        })
      }
      // RTS commands: Stop (S), Hold (H), Attack Move (A with right-click)
      // Stop uses S only when units are selected to avoid camera conflict
      keyboard.on('keydown-S', () => {
        const store = useGameStore.getState()
        if (store.selectedIds.length > 0) {
          store.stopSelected()
        }
        // Otherwise S is used for camera movement (down)
      })
      keyboard.on('keydown-H', () => useGameStore.getState().holdSelected())
      keyboard.on('keydown-R', () => {
        const store = useGameStore.getState()
        const building = store.selectedIds.map((id) => store.buildings.find((b) => b.id === id)).find(Boolean)
        if (building) store.setRallyPointMode(building.id)
      })
    }
  }

  centerOn(x: number, y: number) { this.cameras.main.centerOn(x, y) }
  hit(x: number, y: number): { id: string; kind: 'node' | 'unit' | 'building' } | undefined {
    const state = useGameStore.getState()
    const world = isoToWorld({ x, y })
    const unit = state.units.find((u) => u.state !== 'dead' && Math.hypot(u.x - world.x, u.y - world.y) < 44)
    if (unit) return { id: unit.id, kind: 'unit' }
    const building = state.buildings.find((b) => Math.abs(b.x - world.x) < BUILDING_STATS[b.type].footprint.width * GRID_SIZE * 0.6 && Math.abs(b.y - world.y) < BUILDING_STATS[b.type].footprint.height * GRID_SIZE * 0.6)
    if (building) return { id: building.id, kind: 'building' }
    const node = state.nodes.find((n) => n.amount > 0 && Math.hypot(n.x - world.x, n.y - world.y) < 56)
    return node ? { id: node.id, kind: 'node' } : undefined
  }

  update(time: number) {
    const dt = Math.min((time - this.last) / 1000, 0.05)
    this.last = time
    const store = useGameStore.getState()
    const speed = store.settings.cameraSpeed * dt * (this.keys?.shift?.isDown ? 1.8 : 1)
    const cam = this.cameras.main
    if (this.keys) {
      if (this.keys.left.isDown) cam.scrollX -= speed
      if (this.keys.right.isDown) cam.scrollX += speed
      if (this.keys.up.isDown) cam.scrollY -= speed
      if (this.keys.down.isDown) cam.scrollY += speed
    }
    store.tick(dt)
    this.draw()
  }

  private draw() {
    this.terrainLayer.clear()
    const state = useGameStore.getState()
    const g = this.terrainLayer
    g.fillStyle(0x1a302c)
    g.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)
    for (let col = 0; col < MAP_COLS; col++) for (let row = 0; row < MAP_ROWS; row++) {
      const tile = worldToIso({ x: col * GRID_SIZE + GRID_SIZE / 2, y: row * GRID_SIZE + GRID_SIZE / 2 })
      const shade = ((col * 13 + row * 7) % 9 === 0) ? 0x315e4c : ((col + row) % 5 === 0 ? 0x2b5747 : 0x285141)
      diamondPath(g, tile, ISO.tileWidth, ISO.tileHeight)
      g.fillStyle(shade, 1); g.fillPath()
      if ((col * 3 + row * 5) % 37 === 0) {
        g.fillStyle(0x4d8060, 0.35)
        g.fillEllipse(tile.x - 8, tile.y - 2, 7, 3)
      }
    }

    const visible = new Set(state.visible)
    const explored = new Set(state.explored)
    const isVisible = (x: number, y: number) => visible.has(gridKey(x, y))
    const isExplored = (x: number, y: number) => explored.has(gridKey(x, y))
    const project = (point: { x: number; y: number }) => worldToIso(point)

    state.nodes.filter((n) => n.amount > 0 && isExplored(n.x, n.y)).sort((a, b) => isoDepth(a) - isoDepth(b)).forEach((n) => {
      if (!isVisible(n.x, n.y) && n.type !== 'wood' && n.type !== 'stone' && n.type !== 'gold' && n.type !== 'food') return
      const p = project(n)
      drawIsoShadow(g, n, n.type === 'wood' ? 56 : 44)
      g.fillStyle(colors[n.type], isVisible(n.x, n.y) ? 1 : 0.5)
      if (n.type === 'wood') {
        g.fillTriangle(p.x - 20, p.y + 8, p.x - 3, p.y - 30, p.x + 8, p.y + 8)
        g.fillTriangle(p.x + 2, p.y + 7, p.x + 20, p.y - 25, p.x + 28, p.y + 8)
        g.fillStyle(0x6f4b2e); g.fillRect(p.x - 5, p.y - 2, 6, 18)
      } else if (n.type === 'gold') {
        g.fillCircle(p.x, p.y - 7, 18); g.fillStyle(0xffe27a); g.fillCircle(p.x - 6, p.y - 13, 5); g.fillCircle(p.x + 7, p.y - 2, 4)
      } else {
        g.fillTriangle(p.x - 25, p.y + 10, p.x - 10, p.y - 18, p.x + 17, p.y + 8)
        g.fillTriangle(p.x - 5, p.y + 10, p.x + 16, p.y - 24, p.x + 29, p.y + 9)
      }
      g.lineStyle(2, 0x21362e, 0.8)
      g.strokeEllipse(p.x, p.y + 10, 54, 18)
    })

    this.entityLayer.clear()
    const e = this.entityLayer

    state.fogMarkers
      .filter((m) => !state.buildings.some((b) => b.id === m.id && isVisible(m.x, m.y)))
      .forEach((m) => {
        const p = project(m)
        e.fillStyle(0x6d5450, 0.45)
        const fp = BUILDING_STATS[m.type].footprint
        diamondPath(e, p, fp.width * ISO.tileWidth, fp.height * ISO.tileHeight)
        e.fillPath()
      })

    state.buildings
      .filter((b) => b.faction !== 'enemy' || isVisible(b.x, b.y))
      .sort((a, b) => isoDepth(a) - isoDepth(b))
      .forEach((b) => this.drawBuilding(e, b, state.selectedIds.includes(b.id)))

    state.units.filter((u) => u.state !== 'dead' && (u.faction !== 'enemy' || isVisible(u.x, u.y))).sort((a, b) => isoDepth(a) - isoDepth(b)).forEach((u) => {
      const p = project(u)
      const color = u.faction === 'player' ? (UNIT_COLORS[u.type] ?? PLAYER_ACCENT) : ENEMY_ACCENT
      const radius = UNIT_STATS[u.type].radius
      drawIsoShadow(e, u, u.type === 'cavalry' ? 34 : 24)
      e.fillStyle(color)
      if (u.type === 'cavalry') {
        e.fillEllipse(p.x, p.y - 10, 34, 18)
        e.fillStyle(0x6f4b2e); e.fillRect(p.x - 13, p.y - 29, 5, 20); e.fillRect(p.x + 8, p.y - 29, 5, 20)
        e.fillStyle(0xead1aa); e.fillEllipse(p.x + 3, p.y - 30, 17, 13)
        e.fillStyle(color); e.fillCircle(p.x, p.y - 44, 8)
      } else {
        e.fillEllipse(p.x, p.y - 9, radius * 1.45, radius * 1.15)
        e.fillStyle(0xe8c6a0); e.fillCircle(p.x, p.y - 25, radius * 0.7)
        e.fillStyle(color); e.fillRect(p.x - radius * 0.65, p.y - 18, radius * 1.3, 5)
        if (u.type === 'worker') { e.lineStyle(3, 0x8e673d); e.lineBetween(p.x + 7, p.y - 14, p.x + 18, p.y - 28) }
        if (u.type === 'swordsman' || u.type === 'commander') { e.lineStyle(3, 0xd9e1e3); e.lineBetween(p.x + 7, p.y - 14, p.x + 20, p.y - 30); e.fillStyle(0x8c5536); e.fillCircle(p.x - 10, p.y - 14, 7) }
        if (u.type === 'archer') { e.lineStyle(2, 0xe0bd75); e.strokeCircle(p.x + 9, p.y - 18, 9) }
      }
      if (state.selectedIds.includes(u.id)) { e.lineStyle(3, 0xffe27a); e.strokeEllipse(p.x, p.y + 7, radius * 3.2, radius * 1.2) }
      if (u.carryingAmount && u.carryingAmount > 0.5) { e.fillStyle(colors[u.carrying ?? 'food']); e.fillCircle(p.x, p.y - 40, 4) }
      const max = UNIT_STATS[u.type].maxHealth
      if (u.health < max || state.selectedIds.includes(u.id)) {
        e.fillStyle(0x311a1a); e.fillRect(p.x - 16, p.y - 53, 32, 4)
        e.fillStyle(u.faction === 'player' ? 0x76d68a : 0xe8734d); e.fillRect(p.x - 16, p.y - 53, 32 * Math.max(0, u.health / max), 4)
      }
    })

    state.projectiles.forEach((shot) => {
      if (!isExplored(shot.x, shot.y)) return
      const p = project(shot)
      e.fillStyle(shot.faction === 'player' ? 0xffd166 : 0xff8f66)
      e.fillCircle(p.x, p.y - 18, 5)
      e.lineStyle(1, 0xfff1b8)
      e.strokeCircle(p.x, p.y - 18, 7)
    })

    this.overlayLayer.clear()
    const o = this.overlayLayer
    if (state.placement && state.preview) this.drawPreview(o)
    if (this.dragStart) {
      const p = this.input.activePointer
      if (this.dragBox) this.dragBox.setVisible(false)
      const start = worldToIso(isoToWorld({ x: this.dragStart.x, y: this.dragStart.y }))
      const current = { x: p.worldX, y: p.worldY }
      if (!this.dragBox) {
        this.dragBox = this.add.rectangle(0, 0, 1, 1, 0x9be7cf, 0.18).setStrokeStyle(2, 0x9be7cf)
        this.dragBox.name = 'dragbox'
      }
      this.dragBox.setPosition((start.x + current.x) / 2, (start.y + current.y) / 2).setSize(Math.abs(current.x - start.x), Math.abs(current.y - start.y)).setVisible(true)
    }

    // Fog follows the diamond tile layout
    const fog = this.fogLayer
    fog.clear()
    for (let row = 0; row < MAP_ROWS; row++) for (let col = 0; col < MAP_COLS; col++) {
      const key = `${col},${row}`
      if (visible.has(key)) continue
      const center = worldToIso({ x: col * GRID_SIZE + GRID_SIZE / 2, y: row * GRID_SIZE + GRID_SIZE / 2 })
      diamondPath(fog, center, ISO.tileWidth, ISO.tileHeight)
      fog.fillStyle(DEFAULT_FOG_COLOR, explored.has(key) ? 0.42 : 0.88)
      fog.fillPath()
    }
  }

  private drawBuilding(g: Phaser.GameObjects.Graphics, b: Building, selected: boolean) {
      const p = worldToIso({ x: b.x, y: b.y })
      const fp = BUILDING_STATS[b.type].footprint
      const w = fp.width * ISO.tileWidth
      const h = fp.height * ISO.tileHeight
      const base = b.faction === 'player' ? 0x3b8fc2 : 0xb54252
      drawIsoShadow(g, b, w * 0.8)
      if (b.progress < 1) {
        g.fillStyle(0x8b6d47, 0.8); diamondPath(g, p, w, h); g.fillPath()
        g.lineStyle(3, 0xc69b62, 0.8); g.strokeRect(p.x - w / 3, p.y - h / 2, w * 0.66, h)
        g.lineBetween(p.x - w / 2, p.y - h / 2, p.x + w / 2, p.y + h / 2)
        g.lineBetween(p.x + w / 2, p.y - h / 2, p.x - w / 2, p.y + h / 2)
      } else {
        g.fillStyle(base, 1); diamondPath(g, p, w, h); g.fillPath()
        g.fillStyle(0x6f4a34, 1); g.fillTriangle(p.x - w / 3, p.y - h / 3, p.x, p.y - h * 0.9, p.x + w / 3, p.y - h / 3)
        g.fillStyle(0xc28b58, 1); g.fillTriangle(p.x, p.y - h * 0.9, p.x + w / 3, p.y - h / 3, p.x + w / 2, p.y - h / 2)
        if (b.type === 'headquarters') { g.fillStyle(0x8e673d); g.fillRect(p.x - 9, p.y - 42, 18, 38); g.fillStyle(b.faction === 'player' ? PLAYER_ACCENT : ENEMY_ACCENT); g.fillRect(p.x + 12, p.y - 58, 3, 27); g.fillTriangle(p.x + 15, p.y - 58, p.x + 30, p.y - 52, p.x + 15, p.y - 46) }
        if (b.type === 'watchtower') { g.fillStyle(0xb88345); g.fillRect(p.x - 7, p.y - 57, 14, 44); g.fillStyle(0x60432e); g.fillTriangle(p.x - 18, p.y - 57, p.x, p.y - 76, p.x + 18, p.y - 57) }
        if (b.type === 'stable') { g.fillStyle(0xdeb36c); g.fillRect(p.x - 16, p.y - 24, 32, 18); g.lineStyle(3, 0x5d3c2a); g.lineBetween(p.x - 16, p.y - 24, p.x + 16, p.y - 6) }
        if (b.type === 'farm') { g.fillStyle(0x6f492f); for (let i = -2; i <= 2; i++) g.fillRect(p.x + i * 9 - 2, p.y - 14, 4, 24) }
        if (b.type === 'storage') { g.fillStyle(0x9d6e3f); g.fillRect(p.x - 20, p.y - 28, 40, 24); g.fillStyle(0xd6a056); g.fillCircle(p.x - 11, p.y - 8, 6); g.fillCircle(p.x + 10, p.y - 8, 6) }
        if (b.type === 'barracks') { g.fillStyle(0xe6d8bb); g.fillRect(p.x - 10, p.y - 31, 20, 25); g.fillStyle(b.faction === 'player' ? PLAYER_ACCENT : ENEMY_ACCENT); g.fillRect(p.x + 15, p.y - 48, 3, 28) }
      }
      const max = BUILDING_STATS[b.type].maxHealth
      if (b.progress < 1) {
        g.fillStyle(0x1b2522); g.fillRect(p.x - w / 2, p.y - h - 14, w, 6)
        g.fillStyle(0xe9bb66); g.fillRect(p.x - w / 2, p.y - h - 14, w * b.progress, 6)
      } else if (b.health < max || selected) {
        g.fillStyle(0x311a1a); g.fillRect(p.x - w / 2, p.y - h - 12, w, 5)
        g.fillStyle(0x76d68a); g.fillRect(p.x - w / 2, p.y - h - 12, w * Math.max(0, b.health / max), 5)
      }
      if (b.queue.length > 0) {
        g.fillStyle(0x1b2522); g.fillRect(p.x - w / 2, p.y + h / 2 + 6, w, 4)
        g.fillStyle(0x6fc1ff); g.fillRect(p.x - w / 2, p.y + h / 2 + 6, w * Math.min(1, (b.queueProgress ?? 0) / 8), 4)
      }
      g.lineStyle(selected ? 4 : 2, selected ? 0xffe27a : (b.faction === 'player' ? PLAYER_ACCENT : ENEMY_ACCENT), selected ? 1 : 0.8)
      diamondPath(g, p, w, h); g.strokePath()
  }

  private drawPreview(g: Phaser.GameObjects.Graphics) {
    const state = useGameStore.getState()
    if (!state.placement || !state.preview) return
    const type = state.placement
    const p = worldToIso({ x: state.preview.x, y: state.preview.y })
    const fp = BUILDING_STATS[type].footprint
    const x = p.x
    const y = p.y
    const origin = toGrid(state.preview)
    const valid = canPlaceHere(type, origin.col, origin.row, state.buildings, state.nodes) && hasResources(state.resources, type)
    const width = fp.width * ISO.tileWidth
    const height = fp.height * ISO.tileHeight
    g.fillStyle(valid ? 0x76d68a : 0xe05b5b, 0.35)
    diamondPath(g, { x, y }, width, height); g.fillPath()
    g.lineStyle(3, valid ? 0x76d68a : 0xe05b5b)
    diamondPath(g, { x, y }, width, height); g.strokePath()
  }
}

function gridKey(x: number, y: number): string { const c = toGrid({ x, y }); return `${c.col},${c.row}` }
function hasResources(resources: { food: number; wood: number; stone: number; gold: number }, type: keyof typeof BUILDING_STATS): boolean {
  const cost = BUILDING_STATS[type].cost
  return resources.food >= cost.food && resources.wood >= cost.wood && resources.stone >= cost.stone && resources.gold >= cost.gold
}
function canPlaceHere(type: keyof typeof BUILDING_STATS, col: number, row: number, buildings: Building[], nodes: ResourceNode[]): boolean {
  return isPlacementValid(type, { col, row }, MAP_COLS, MAP_ROWS, buildings.filter((b) => b.health > 0), nodes.filter((n) => n.amount > 0))
}

export function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const game = new Phaser.Game({ type: Phaser.AUTO, width: '100%', height: '100%', parent: ref.current, backgroundColor: '#1a302c', scene: [RTSScene], scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH } })
    return () => game.destroy(true)
  }, [])
  return <div className="game-canvas" ref={ref} />
}

export function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const state = useGameStore()
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = 200
    const H = 114
    ctx.fillStyle = '#1b4035'
    ctx.fillRect(0, 0, W, H)
    const explored = new Set(state.explored)
    const cols = Math.ceil(MAP_WIDTH / 80)
    const rows = Math.ceil(MAP_HEIGHT / 80)
    ctx.fillStyle = 'rgba(6, 14, 12, 0.7)'
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const covered = Array.from({ length: 4 }, (_, i) => `${col * 2 + (i % 2)},${row * 2 + Math.floor(i / 2)}`).some((k) => explored.has(k))
      if (!covered) ctx.fillRect((col / cols) * W, (row / rows) * H, W / cols + 1, H / rows + 1)
    }
    state.nodes.forEach((n) => {
      if (n.amount <= 0) return
      const c = toGrid(n)
      if (!explored.has(`${c.col},${c.row}`)) return
      ctx.fillStyle = `#${colors[n.type].toString(16).padStart(6, '0')}`
      ctx.fillRect((n.x / MAP_WIDTH) * W - 1.5, (n.y / MAP_HEIGHT) * H - 1.5, 3, 3)
    })
    state.buildings.forEach((b) => {
      const c = toGrid(b)
      if (b.faction === 'enemy' && !explored.has(`${c.col},${c.row}`)) return
      ctx.fillStyle = b.faction === 'player' ? '#58d0a8' : '#d75a5a'
      const size = b.type === 'headquarters' ? 5 : 3
      ctx.fillRect((b.x / MAP_WIDTH) * W - size / 2, (b.y / MAP_HEIGHT) * H - size / 2, size, size)
    })
    const visible = new Set(state.visible)
    state.units.forEach((u) => {
      if (u.state === 'dead') return
      const key = `${toGrid(u).col},${toGrid(u).row}`
      if (u.faction === 'enemy' && !visible.has(key)) return
      ctx.fillStyle = u.faction === 'player' ? '#9be7cf' : '#e8734d'
      ctx.fillRect((u.x / MAP_WIDTH) * W - 1, (u.y / MAP_HEIGHT) * H - 1, 2, 2)
    })
    // camera viewport
    const cam = sceneRef?.cameras.main
    if (cam) {
      ctx.strokeStyle = '#ffe27a'
      ctx.lineWidth = 1
      const vw = (cam.width / cam.zoom / MAP_WIDTH) * W
      const vh = (cam.height / cam.zoom / MAP_HEIGHT) * H
      ctx.strokeRect((cam.scrollX / MAP_WIDTH) * W, (cam.scrollY / MAP_HEIGHT) * H, vw, vh)
    }
  })
  return (
    <canvas
      ref={canvasRef}
      className="minimap"
      width={200}
      height={114}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        centerCameraAt(((e.clientX - rect.left) / rect.width) * MAP_WIDTH, ((e.clientY - rect.top) / rect.height) * MAP_HEIGHT)
      }}
    />
  )
}
