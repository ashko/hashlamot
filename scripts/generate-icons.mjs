// Generates the PWA icons with no image tooling — just zlib and a bit of maths.
//
// An iOS home-screen app with no icon does not install properly, and a
// forgettable icon is one they will not find on a crowded home screen. So:
// solid accent blue, one enormous white check, nothing else.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'public')
mkdirSync(publicDir, { recursive: true })

const BG = [0x2b, 0x5c, 0xd9]
const FG = [0xff, 0xff, 0xff]
const SS = 3 // supersampling factor, for smooth edges

// Distance from a point to a line segment — the check mark is two thick
// segments, so "inside the stroke" is just a distance test.
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function sample(x, y, size, maskable) {
  const r = maskable ? size : size * 0.22 // maskable icons fill the whole square
  // rounded-square background
  const inset = 0
  const minX = inset
  const maxX = size - inset
  let inBg
  if (maskable) {
    inBg = true
  } else {
    const cx = Math.min(Math.max(x, minX + r), maxX - r)
    const cy = Math.min(Math.max(y, minX + r), maxX - r)
    inBg = Math.hypot(x - cx, y - cy) <= r
  }
  if (!inBg) return null

  // check mark, scaled to the canvas
  const s = size
  const stroke = s * 0.085
  const pad = maskable ? s * 0.28 : s * 0.24
  const ax = pad,            ay = s * 0.53
  const bx = s * 0.42,       by = s - pad * 1.05
  const cx2 = s - pad,       cy2 = pad * 1.15

  const d = Math.min(
    distToSegment(x, y, ax, ay, bx, by),
    distToSegment(x, y, bx, by, cx2, cy2),
  )
  return d <= stroke ? FG : BG
}

function renderRGBA(size, maskable) {
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          const c = sample(px, py, size, maskable)
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255 }
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      // premultiplied average, so transparent corners do not darken the edge
      buf[i]     = a ? Math.round(r / (a / 255)) : 0
      buf[i + 1] = a ? Math.round(g / (a / 255)) : 0
      buf[i + 2] = a ? Math.round(b / (a / 255)) : 0
      buf[i + 3] = Math.round(a / n)
    }
  }
  return buf
}

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePNG(rgba, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // colour type: RGBA
  // rows are prefixed with a filter byte; 0 = none
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['apple-touch-icon.png', 180, true], // iOS masks its own corners
]

for (const [file, size, maskable] of targets) {
  writeFileSync(join(publicDir, file), encodePNG(renderRGBA(size, maskable), size))
  console.log(`wrote public/${file} (${size}px)`)
}

writeFileSync(
  join(publicDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#2B5CD9"/>
  <path d="M24 53 L42 74 L76 27" fill="none" stroke="#fff"
        stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`,
)
console.log('wrote public/favicon.svg')
