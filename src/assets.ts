export const ART_ASSETS = {
  units: {
    worker: '/work/assets/rts-hd/units/worker.png',
    swordsman: '/work/assets/rts-hd/units/swordsman.png',
    archer: '/work/assets/rts-hd/units/archer.png',
    commander: '/work/assets/rts-hd/units/commander.png',
    cavalry: '/work/assets/rts-hd/units/cavalry.png',
  },
  buildings: {
    headquarters: '/work/assets/rts-hd/buildings/headquarters.png',
    barracks: '/work/assets/rts-hd/buildings/barracks.png',
    stable: '/work/assets/rts-hd/buildings/stable.png',
    farm: '/work/assets/rts-hd/buildings/farm.png',
    storage: '/work/assets/rts-hd/buildings/storage.png',
    watchtower: '/work/assets/rts-hd/buildings/watchtower.png',
  },
  resources: {
    wood: '/work/assets/rts-hd/resources/trees.png',
    woodVariant: '/work/assets/rts-hd/resources/trees2.png',
    stone: '/work/assets/rts-hd/resources/stone.png',
    stoneVariant: '/work/assets/rts-hd/resources/stone2.png',
    gold: '/work/assets/rts-hd/resources/gold.png',
  },
} as const

export const ART_FRAME = {
  units: { frameWidth: 224, frameHeight: 288 },
  buildings: { frameWidth: 448, frameHeight: 352 },
  resources: { frameWidth: 288, frameHeight: 288 },
} as const

export const artKey = (type: string): string => `rts-hd-${type}`
