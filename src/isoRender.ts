import Phaser from 'phaser'
import { ISO, isoDiamond, worldToIso } from './isometric'

export function diamondPath(g: Phaser.GameObjects.Graphics, center: { x: number; y: number }, width = ISO.tileWidth, height = ISO.tileHeight): void {
  const points = isoDiamond(center, width, height)
  g.beginPath()
  g.moveTo(points[0].x, points[0].y)
  points.slice(1).forEach((p) => g.lineTo(p.x, p.y))
  g.closePath()
}

export function drawIsoTile(g: Phaser.GameObjects.Graphics, world: { x: number; y: number }, color: number, alpha = 1): void {
  diamondPath(g, worldToIso(world))
  g.fillStyle(color, alpha)
  g.fillPath()
}

export function drawIsoShadow(g: Phaser.GameObjects.Graphics, world: { x: number; y: number }, width: number, alpha = 0.22): void {
  const p = worldToIso(world)
  g.fillStyle(0x07120f, alpha)
  g.fillEllipse(p.x, p.y + 8, width, Math.max(5, width * 0.3))
}
