import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

// A portable, offline demo. The deployable app remains the regular Vite build.
// Force demo mode so no configured project URL or credentials enter this file.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = await build({
  configFile: false,
  root,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '""',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
  },
  build: {
    write: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(root, 'src/main.tsx'),
      output: { format: 'iife', inlineDynamicImports: true },
    },
  },
})
const outputs = (Array.isArray(result) ? result : [result]).flatMap(
  (r) => r.output,
)
const script = outputs
  .filter((o) => o.type === 'chunk')
  .map((o) => o.code)
  .join('\n')
const css = outputs
  .filter((o) => o.type === 'asset' && o.fileName.endsWith('.css'))
  .map((o) => o.source)
  .join('\n')
if (!script || !css)
  throw new Error('The portable demo is missing its script or styles.')
const icon = (await readFile(resolve(root, 'public/icon-192.png'))).toString(
  'base64',
)
const template = await readFile(resolve(root, 'index.html'), 'utf8')
const html = template
  .replace(/<link\b[^>]*\brel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g, '')
  .replace(
    '</head>',
    () =>
      `<link rel="icon" href="data:image/png;base64,${icon}"><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head>`,
  )
  .replace(
    /<script\s+type="module"\s+src="\/src\/main\.tsx"><\/script>/,
    () => `<script>${script.replace(/<\/script/gi, '<\\/script')}</script>`,
  )
  .replace(
    '<title>Scalipus — Todos em campo.</title>',
    '<title>Scalipus — Demonstração</title>',
  )
if (html.includes('src="/src/main.tsx"'))
  throw new Error('The source entrypoint was not replaced.')
const target = resolve(root, 'scalitpus-demo.html')
await writeFile(target, html)
console.log(
  `Portable demo saved: ${target} (${Math.round(Buffer.byteLength(html) / 1024)} KiB)`,
)
