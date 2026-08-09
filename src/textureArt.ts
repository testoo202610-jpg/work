import Phaser from 'phaser'
import { ART_ASSETS, ART_FRAME, artKey } from './assets'
import type { Building, ResourceNode, Unit } from './game'

export function preloadArt(scene: Phaser.Scene): void {
  Object.entries(ART_ASSETS.units).forEach(([type, url]) => scene.load.spritesheet(artKey(type), url, { ...ART_FRAME.units }))
  Object.entries(ART_ASSETS.buildings).forEach(([type, url]) => scene.load.spritesheet(artKey(type), url, { ...ART_FRAME.buildings }))
  Object.entries(ART_ASSETS.resources).forEach(([type, url]) => scene.load.spritesheet(artKey(type), url, { ...ART_FRAME.resources }))
}

export function textureForUnit(unit: Unit): string { return artKey(unit.type) }
export function textureForBuilding(building: Building): string | undefined { return building.type in ART_ASSETS.buildings ? artKey(building.type) : undefined }
export function textureForResource(type: ResourceNode['type']): string | undefined { return type in ART_ASSETS.resources ? artKey(type) : undefined }

export function animationFrame(state: 'idle' | 'walk' | 'attack' | 'work' | 'hurt' | 'dead', time: number, direction: number): number {
  const directionIndex = Math.round((((direction + Math.PI) / (Math.PI * 2)) * 4 + 4) % 4)
  const stateOffset = state === 'walk' ? 4 : state === 'attack' ? 8 : state === 'work' ? 12 : state === 'dead' ? 14 : 0
  const phase = state === 'idle' || state === 'dead' ? 0 : Math.floor(time / 120) % 4
  return Math.min(15, stateOffset + (directionIndex + phase) % 4)
}
