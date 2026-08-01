// Bundles the demo into one self-contained HTML file.
//
// Useful before any of the Supabase setup exists: a single file that can be
// opened from anywhere, or hosted somewhere with a strict content policy, and
// still runs the whole app against in-memory data. Demo mode makes no network
// requests at all, so nothing needs to be fetched.
//
//   node scripts/build-demo-page.mjs   →  dist-demo/index.html

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist-demo')
const staging = join(root, '.demo-build')

execFileSync('npx', ['vite', 'build', '--outDir', '.demo-build', '--base', './'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, BASE_PATH: './' },
})

const assets = join(staging, 'assets')
const files = readdirSync(assets)
const js = files.find((f) => f.endsWith('.js'))
const css = files.find((f) => f.endsWith('.css'))

const script = readFileSync(join(assets, js), 'utf8')
const style = readFileSync(join(assets, css), 'utf8')

mkdirSync(out, { recursive: true })
writeFileSync(
  join(out, 'index.html'),
  `<title>השלמות — הדגמה</title>
<style>
${style}
/* The page is the app: it owns the full viewport and does not scroll itself. */
html, body { margin: 0; height: 100%; background: var(--paper); }
#root { height: 100%; }
</style>
<div id="root"></div>
<script type="module">
// Demo mode is normally chosen with ?demo=1. Here the whole file *is* the
// demo, so the flag is set before the bundle reads it.
if (!new URLSearchParams(location.search).has('demo')) {
  const u = new URL(location.href)
  u.searchParams.set('demo', '1')
  history.replaceState(null, '', u)
}
${script}
</script>
`,
  'utf8',
)

console.log(`wrote dist-demo/index.html`)
