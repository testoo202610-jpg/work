import Phaser from 'phaser'
import { ART_ASSETS, artKey } from './assets'
import type { Building, Unit } from './game'

export function preloadArt(scene: Phaser.Scene): void {
  Object.entries(ART_ASSETS.units).forEach(([type, url]) => scene.load.svg(artKey(type), url, { width: 112, height: 144, scale: 1 }))
  Object.entries(ART_ASSETS.buildings).forEach(([type, url]) => scene.load.svg(artKey(type), url, { width: 224, height: 176, scale: 1 }))
  Object.entries(ART_ASSETS.resources).forEach(([type, url]) => scene.load.svg(artKey(type), url, { width: 144, height: 144, scale: 1 }))
}

export function textureForUnit(unit: Unit): string { return artKey(unit.type) }
export function textureForBuilding(building: Building): string | undefined {
  return building.type in ART_ASSETS.buildings ? artKey(building.type) : undefined
}
export function textureForResource(type: string): string | undefined { return type in ART_ASSETS.resources ? artKey(type) : undefined }
