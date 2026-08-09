import { chromium } from '@playwright/test'
import { readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const groups = {
  units: ['worker', 'swordsman', 'archer', 'commander', 'cavalry'],
  buildings: ['headquarters', 'barracks', 'stable', 'farm', 'storage', 'watchtower'],
  resources: ['trees', 'stone', 'gold'],
}
const source = (group, name) => join(root, 'public/assets/rts', group, `${name}.svg`)
const target = (group, name) => join(root, 'public/assets/rts-hd', group, `${name}.png`)
const sizes = { units: { w: 224, h: 288 }, buildings: { w: 448, h: 352 }, resources: { w: 288, h: 288 } }
const browser = await chromium.launch({ headless: true })
for (const [group, names] of Object.entries(groups)) {
  await mkdir(join(root, 'public/assets/rts-hd', group), { recursive: true })
  for (const name of names) {
    const svg = await readFile(source(group, name), 'utf8')
    const { w, h } = sizes[group]
    const page = await browser.newPage({ viewport: { width: w * 4, height: h * 4 }, deviceScaleFactor: 1 })
    await page.setContent(`<style>html,body{margin:0;background:transparent} .atlas{display:grid;grid-template-columns:repeat(4,${w}px);grid-template-rows:repeat(4,${h}px);width:${w * 4}px;height:${h * 4}px}.cell{width:${w}px;height:${h}px;display:grid;place-items:center}.cell:nth-child(2){transform:scaleX(-1)}.cell:nth-child(3){filter:brightness(1.08);transform:translateY(-3px)}.cell:nth-child(4){filter:brightness(.9);transform:translateY(2px)}.cell:nth-child(5){transform:scaleX(-1) translateY(-2px)}.cell:nth-child(6){filter:saturate(1.15)}.cell:nth-child(7){filter:brightness(1.12)}.cell:nth-child(8){filter:brightness(.86)}.cell:nth-child(9){transform:scaleX(-1)}.cell:nth-child(10){filter:contrast(1.08)}.cell:nth-child(11){filter:brightness(1.04)}.cell:nth-child(12){filter:brightness(.88)}.cell:nth-child(13){transform:scaleX(-1)}.cell:nth-child(14){filter:saturate(1.2)}.cell:nth-child(15){filter:brightness(1.1)}.cell:nth-child(16){filter:brightness(.8)}</style><div class="atlas">${Array.from({ length: 16 }, (_, i) => `<div class="cell" data-frame="${i}">${svg}</div>`).join('')}</div>`)
    await page.screenshot({ path: target(group, name), omitBackground: true })
    await page.close()
  }
}
await browser.close()
