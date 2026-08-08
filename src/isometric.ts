export interface ScreenPoint { x: number; y: number }

/** Logical world coordinates are kept unchanged; this module only projects them for rendering/input. */
export interface IsoConfig { tileWidth: number; tileHeight: number; originX: number; originY: number }

export const ISO: IsoConfig = { tileWidth: 64, tileHeight: 32, originX: 1024, originY: 96 }

export function worldToIso(world: ScreenPoint, config: IsoConfig = ISO): ScreenPoint {
  return {
    x: config.originX + (world.x - world.y) * config.tileWidth / 80,
    y: config.originY + (world.x + world.y) * config.tileHeight / 80,
  }
}

export function isoToWorld(screen: ScreenPoint, config: IsoConfig = ISO): ScreenPoint {
  const sx = (screen.x - config.originX) / (config.tileWidth / 80)
  const sy = (screen.y - config.originY) / (config.tileHeight / 80)
  return { x: (sx + sy) / 2, y: (sy - sx) / 2 }
}

export function isoDepth(world: ScreenPoint): number { return world.x + world.y }

export function isoDiamond(center: ScreenPoint, width = ISO.tileWidth, height = ISO.tileHeight): ScreenPoint[] {
  return [
    { x: center.x, y: center.y - height / 2 },
    { x: center.x + width / 2, y: center.y },
    { x: center.x, y: center.y + height / 2 },
    { x: center.x - width / 2, y: center.y },
  ]
}
