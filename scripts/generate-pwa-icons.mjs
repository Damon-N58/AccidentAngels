import sharp from 'sharp'
import { writeFileSync } from 'fs'

const SIZES = [192, 512]
const APPS = [
  {
    name: 'driver',
    bg: '#1A3F7A',
    text: 'AA',
    fg: '#FFFFFF',
  },
  {
    name: 'parent',
    bg: '#0F6E56',
    text: 'AA',
    fg: '#FFFFFF',
  },
]

async function createIcon(bg, text, fg, size) {
  // Create an SVG with centered text
  const fontSize = Math.round(size * 0.5)
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="${bg}"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
          font-family="system-ui, -apple-system, sans-serif" font-weight="bold"
          font-size="${fontSize}" fill="${fg}">${text}</text>
  </svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function main() {
  for (const app of APPS) {
    for (const size of SIZES) {
      const buf = await createIcon(app.bg, app.text, app.fg, size)
      const path = `public/${app.name}/icons/icon-${size}.png`
      writeFileSync(path, buf)
      console.log(`Created ${path} (${size}x${size})`)
    }
  }
}

main().catch(console.error)
