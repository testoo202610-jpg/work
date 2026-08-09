export const ART_ASSETS = {
  units: {
    worker: '/work/assets/rts/units/worker.svg',
    swordsman: '/work/assets/rts/units/swordsman.svg',
    archer: '/work/assets/rts/units/archer.svg',
    commander: '/work/assets/rts/units/commander.svg',
    cavalry: '/work/assets/rts/units/cavalry.svg',
  },
  buildings: {
    headquarters: '/work/assets/rts/buildings/headquarters.svg',
    barracks: '/work/assets/rts/buildings/barracks.svg',
    stable: '/work/assets/rts/buildings/stable.svg',
    farm: '/work/assets/rts/buildings/farm.svg',
    storage: '/work/assets/rts/buildings/storage.svg',
    watchtower: '/work/assets/rts/buildings/watchtower.svg',
  },
  resources: {
    wood: '/work/assets/rts/resources/trees.svg',
    stone: '/work/assets/rts/resources/stone.svg',
    gold: '/work/assets/rts/resources/gold.svg',
  },
} as const

export type ArtKey = keyof typeof ART_ASSETS.units
export const artKey = (type: string): string => `rts-${type}`
