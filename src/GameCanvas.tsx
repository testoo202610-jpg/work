import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { BUILDING_STATS, DEFAULT_FOG_COLOR, fromGrid, GRID_SIZE, isPlacementValid, MAP_COLS, MAP_HEIGHT, MAP_ROWS, MAP_WIDTH, toGrid, UNIT_STATS } from './game'
import type { Building, ResourceNode } from './game'
import { useGameStore } from './store'

const colors: Record<string, number> = { food: 0x76b852, wood: 0x9b673d, stone: 0xa7b1b8, gold: 0xf0c44c }
const UNIT_COLORS: Record<string, number> = { worker: 0x8ad0b0, swordsman: 0x58d0a8, archer: 0x6fc1ff, cavalry: 0xf3a35c, commander: 0xe9bb66 }

let sceneRef: RTSScene | null = null
export function centerCameraAt(x: number, y: number): void { sceneRef?.centerOn(x, y) }
export const sceneRegistry = { set(scene: RTSScene) { sceneRef = scene }, clear(scene: RTSScene) { if (sceneRef === scene) sceneRef = null }, get() { return sceneRef } }

class RTSScene extends Phaser.Scene {
  private last = 0
  private dragStart?: Phaser.Math.Vector2
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private terrainLayer!: Phaser.GameObjects.Graphics
  private entityLayer!: Phaser.GameObjects.Graphics
  private fogLayer!: Phaser.GameObjects.Graphics
  private overlayLayer!: Phaser.GameObjects.Graphics
  constructor() { super('rts') }

  create() {
    sceneRegistry.set(this)
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT)
    this.cameras.main.setZoom(0.82)
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
        const snapped = fromGrid(toGrid({ x: pointer.worldX, y: pointer.worldY }))
        state.updatePreview(snapped.x, snapped.y)
      }
      if (this.dragStart) this.children.list.filter((c) => c.name === 'dragbox').forEach((c) => c.destroy())
    })
    this.input.mouse?.disableContextMenu()
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) return
      const state = useGameStore.getState()
      if (pointer.leftButtonDown() && state.placement) { state.confirmPlacement(); return }
      if (pointer.leftButtonDown()) this.dragStart = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const store = useGameStore.getState()
      if (pointer.button === 2) {
        if (store.placement) { store.cancelPlacement(); return }
        if (store.rallyPointBuildingId) { store.applyRallyPoint(pointer.worldX, pointer.worldY); return }
        const hit = this.hit(pointer.worldX, pointer.worldY)
        if (hit?.kind === 'node') store.gatherSelected(hit.id)
        else if (hit) store.attack(hit.id)
        else if (store.selectedIds.length > 0 && this.keys?.shift?.isDown) store.attackMoveSelected(pointer.worldX, pointer.worldY)
        else store.moveSelected(pointer.worldX, pointer.worldY)
        return
      }
      if (pointer.button === 0 && this.dragStart) {
        const distance = Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, pointer.worldX, pointer.worldY)
        if (distance > 14) {
          const x1 = Math.min(this.dragStart.x, pointer.worldX)
          const x2 = Math.max(this.dragStart.x, pointer.worldX)
          const y1 = Math.min(this.dragStart.y, pointer.worldY)
          const y2 = Math.max(this.dragStart.y, pointer.worldY)
          store.select(store.units.filter((u) => u.faction === 'player' && u.state !== 'dead' && u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2).map((u) => u.id))
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
    const unit = state.units.find((u) => u.state !== 'dead' && Math.hypot(u.x - x, u.y - y) < 26)
    if (unit) return { id: unit.id, kind: 'unit' }
    const building = state.buildings.find((b) => Math.abs(b.x - x) < BUILDING_STATS[b.type].footprint.width * GRID_SIZE * 0.55 && Math.abs(b.y - y) < BUILDING_STATS[b.type].footprint.height * GRID_SIZE * 0.55)
    if (building) return { id: building.id, kind: 'building' }
    const node = state.nodes.find((n) => n.amount > 0 && Math.hypot(n.x - x, n.y - y) < 34)
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
    g.fillStyle(0x254e43)
    for (let x = 0; x < MAP_WIDTH; x += 80) for (let y = 0; y < MAP_HEIGHT; y += 80) g.fillRect(x + 2, y + 2, 76, 76)

    const visible = new Set(state.visible)
    const explored = new Set(state.explored)
    const isVisible = (x: number, y: number) => visible.has(gridKey(x, y))
    const isExplored = (x: number, y: number) => explored.has(gridKey(x, y))

    state.nodes.forEach((n) => {
      if (n.amount <= 0 || !isExplored(n.x, n.y)) return
      g.fillStyle(colors[n.type], isVisible(n.x, n.y) ? 1 : 0.5)
      g.fillCircle(n.x, n.y, 22)
      g.lineStyle(2, 0xdde5ce)
      g.strokeCircle(n.x, n.y, 23)
    })

    this.entityLayer.clear()
    const e = this.entityLayer

    state.fogMarkers
      .filter((m) => !state.buildings.some((b) => b.id === m.id && isVisible(m.x, m.y)))
      .forEach((m) => {
        e.fillStyle(0x6d5450, 0.45)
        const fp = BUILDING_STATS[m.type].footprint
        e.fillRect(m.x - fp.width * GRID_SIZE / 2, m.y - fp.height * GRID_SIZE / 2, fp.width * GRID_SIZE, fp.height * GRID_SIZE)
        e.lineStyle(2, 0x8a6472, 0.55)
        e.strokeRect(m.x - fp.width * GRID_SIZE / 2, m.y - fp.height * GRID_SIZE / 2, fp.width * GRID_SIZE, fp.height * GRID_SIZE)
      })

    state.buildings.forEach((b) => {
      if (b.faction === 'enemy' && !isVisible(b.x, b.y)) return
      this.drawBuilding(e, b, state.selectedIds.includes(b.id))
    })

    state.units.filter((u) => u.state !== 'dead').forEach((u) => {
      if (u.faction === 'enemy' && !isVisible(u.x, u.y)) return
      const color = u.faction === 'player' ? (UNIT_COLORS[u.type] ?? 0x58d0a8) : 0xd75a5a
      e.fillStyle(color)
      e.fillCircle(u.x, u.y, UNIT_STATS[u.type].radius + 1)
      if (state.selectedIds.includes(u.id)) { e.lineStyle(3, 0xffe27a); e.strokeCircle(u.x, u.y, UNIT_STATS[u.type].radius + 7) }
      if (u.carryingAmount && u.carryingAmount > 0.5) { e.fillStyle(colors[u.carrying ?? 'food']); e.fillCircle(u.x, u.y - 16, 4) }
      const max = UNIT_STATS[u.type].maxHealth
      if (u.health < max || state.selectedIds.includes(u.id)) {
        e.fillStyle(0x311a1a)
        e.fillRect(u.x - 14, u.y - 20, 28, 4)
        e.fillStyle(u.faction === 'player' ? 0x76d68a : 0xe8734d)
        e.fillRect(u.x - 14, u.y - 20, 28 * Math.max(0, u.health / max), 4)
      }
    })

    state.projectiles.forEach((p) => {
      if (!isExplored(p.x, p.y)) return
      e.fillStyle(p.faction === 'player' ? 0xffd166 : 0xff8f66)
      e.fillCircle(p.x, p.y, 5)
      e.lineStyle(1, 0xfff1b8)
      e.strokeCircle(p.x, p.y, 7)
    })

    this.overlayLayer.clear()
    const o = this.overlayLayer
    if (state.placement && state.preview) this.drawPreview(o)
    if (this.dragStart) {
      const p = this.input.activePointer
      const box = this.add.rectangle((this.dragStart.x + p.worldX) / 2, (this.dragStart.y + p.worldY) / 2,
        Math.abs(p.worldX - this.dragStart.x), Math.abs(p.worldY - this.dragStart.y), 0x9be7cf, 0.18)
      box.setStrokeStyle(2, 0x9be7cf)
      box.name = 'dragbox'
    }

    // fog overlay last (covers everything)
    const fog = this.fogLayer
    fog.fillStyle(DEFAULT_FOG_COLOR, 1)
    for (let row = 0; row < 30; row++) for (let col = 0; col < 53; col++) {
      const key = `${col},${row}`
      if (visible.has(key)) continue
      fog.fillStyle(DEFAULT_FOG_COLOR, explored.has(key) ? 0.45 : 0.92)
      fog.fillRect(col * GRID_SIZE, row * GRID_SIZE, GRID_SIZE, GRID_SIZE)
    }
  }

  private drawBuilding(g: Phaser.GameObjects.Graphics, b: Building, selected: boolean) {
    const fp = BUILDING_STATS[b.type].footprint
    const w = fp.width * GRID_SIZE
    const h = fp.height * GRID_SIZE
    const base = b.faction === 'player' ? 0x3b8fc2 : 0xb54252
    g.fillStyle(base, b.progress < 1 ? 0.45 : 1)
    g.fillRoundedRect(b.x - w / 2, b.y - h / 2, w, h, 8)
    g.lineStyle(selected ? 4 : 2, selected ? 0xffe27a : 0xdde5ce)
    g.strokeRoundedRect(b.x - w / 2, b.y - h / 2, w, h, 8)
    if (b.type === 'watchtower' && b.progress >= 1) { g.fillStyle(0xd8c47f); g.fillTriangle(b.x - 10, b.y - h / 2, b.x + 10, b.y - h / 2, b.x, b.y - h / 2 - 16) }
    const max = BUILDING_STATS[b.type].maxHealth
    if (b.progress < 1) {
      g.fillStyle(0x1b2522); g.fillRect(b.x - w / 2, b.y - h / 2 - 12, w, 6)
      g.fillStyle(0xe9bb66); g.fillRect(b.x - w / 2, b.y - h / 2 - 12, w * b.progress, 6)
    } else if (b.health < max || selected) {
      g.fillStyle(0x311a1a); g.fillRect(b.x - w / 2, b.y - h / 2 - 10, w, 5)
      g.fillStyle(0x76d68a); g.fillRect(b.x - w / 2, b.y - h / 2 - 10, w * Math.max(0, b.health / max), 5)
    }
    if (b.queue.length > 0) {
      g.fillStyle(0x1b2522); g.fillRect(b.x - w / 2, b.y + h / 2 + 6, w, 4)
      g.fillStyle(0x6fc1ff); g.fillRect(b.x - w / 2, b.y + h / 2 + 6, w * Math.min(1, (b.queueProgress ?? 0) / 8), 4)
    }
  }

  private drawPreview(g: Phaser.GameObjects.Graphics) {
    const state = useGameStore.getState()
    if (!state.placement || !state.preview) return
    const type = state.placement
    const fp = BUILDING_STATS[type].footprint
    const x = state.preview.x
    const y = state.preview.y
    const origin = toGrid({ x: x - fp.width * GRID_SIZE / 2, y: y - fp.height * GRID_SIZE / 2 })
    const valid = canPlaceHere(type, origin.col, origin.row, state.buildings, state.nodes) && hasResources(state.resources, type)
    g.fillStyle(valid ? 0x76d68a : 0xe05b5b, 0.35)
    g.fillRect(x - fp.width * GRID_SIZE / 2, y - fp.height * GRID_SIZE / 2, fp.width * GRID_SIZE, fp.height * GRID_SIZE)
    g.lineStyle(3, valid ? 0x76d68a : 0xe05b5b)
    g.strokeRect(x - fp.width * GRID_SIZE / 2, y - fp.height * GRID_SIZE / 2, fp.width * GRID_SIZE, fp.height * GRID_SIZE)
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
