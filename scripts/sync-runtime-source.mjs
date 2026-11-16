/** Copy runtime visual assets from the actual Build repository, without editing vendor/.
 * npm run sync:runtime -- /absolute/path/to/lingee-build
 * Solid source snapshots are reference-only; executable React ports live in src/.
 */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(await readFile(path.join(root, 'sync.config.json'), 'utf8'))
const source = path.resolve(process.argv[2] ?? process.env.LINGEE_BUILD_DIR ?? config.lingeeBuildDir)
const output = path.join(root, 'src/source-runtime')
const ui = 'packages/kcode-ui/src/components/'
const web = 'packages/kcode-web/src/'
const css = ['card','tool-error-card','basic-tool','collapsible','session-turn','message-part','shell-submessage','tool-count-label','tool-count-summary','tool-status-title','text-shimmer','dock-surface','render-card','button','icon-button','markdown','segmented-control','progress-circle','icon','dropdown-menu','popover','tooltip'].map(name => `${ui}${name}.css`)
css.push(`${web}components/prompt-input/prompt-input-bar.css`, `${web}components/prompt-input/model-selector.css`, `${web}components/prompt-input/slash-popover.css`, `${web}pages/session/message-timeline.css`)
const references = ['tool-error-card','message-part','session-turn','basic-tool','collapsible','tool-count-summary','tool-status-title','dock-prompt','dock-surface','render-card','text-shimmer'].map(name => `${ui}${name}.tsx`)
references.push(...['session-composer-region','session-todo-dock','session-question-dock','session-permission-dock'].map(name=>`${web}pages/session/composer/${name}.tsx`),`${web}components/prompt-input.tsx`, `${web}components/icon.tsx`, ...['enhance-button','model-selector','image-attachments','slash-popover'].map(name => `${web}components/prompt-input/${name}.tsx`), `${web}components/session-context-usage.tsx`)
const manifest = { source, files: [], reactPorts: ['src/pages/session/timeline/', 'src/pages/session/composer/', 'src/features/prompt-input/', 'src/ui/'] }
await mkdir(path.join(output,'styles'),{recursive:true})
await mkdir(path.join(output,'reference'),{recursive:true})
for (const relative of [...css,...references]) {
  const content = await readFile(path.join(source,relative))
  const name = relative.startsWith(ui) ? path.basename(relative) : 'web-'+path.basename(relative)
  const target = path.join(relative.endsWith('.css')?'styles':'reference',name+(relative.endsWith('.tsx')?'.txt':''))
  await writeFile(path.join(output,target),content)
  manifest.files.push({source:relative,copy:target,sha256:createHash('sha256').update(content).digest('hex')})
}
// Extract complete top-level runtime rules from the web entry, preserving rule text.
const entry = await readFile(path.join(source,web+'index.css'),'utf8')
const chunks = []
let start=0, depth=0, quote='',comment=false
for(let i=0;i<entry.length;i++) {
  const c=entry[i],next=entry[i+1]
  if(comment){ if(c==='*'&&next==='/'){comment=false;i++} continue }
  if(quote){ if(c==='\\'){i++;continue} if(c===quote)quote='';continue }
  if(c==='/'&&next==='*'){comment=true;i++;continue}
  if(c==='"'||c==="'"){quote=c;continue}
  if(c==='{')depth++
  if(c==='}'){
    depth--
    if(depth===0){const chunk=entry.slice(start,i+1);if(/dock-prompt|session-todo|session-prompt-dock|text-shimmer|session-turn-list|prompt-input|prompt-submit|prompt-enhance|enhance-btn|enhance-spin|enhance-spinner/.test(chunk))chunks.push(chunk);start=i+1}
  }
  if(c===';'&&depth===0)start=i+1
}
await writeFile(path.join(output,'styles/web-runtime.css'),chunks.join('\n'))
await writeFile(path.join(output,'reference/web-index.css.txt'),entry)
manifest.files.push({source:web+'index.css',copy:'styles/web-runtime.css',sha256:createHash('sha256').update(entry).digest('hex'),extracted:true})
await writeFile(path.join(output,'runtime.css'),css.map(relative=>`@import "./styles/${relative.startsWith(ui)?'':'web-'}${path.basename(relative)}"${relative.startsWith(ui)?' layer(components)':''};`).join('\n')+'\n@import "./styles/web-runtime.css";\n')
const iconSource = await readFile(path.join(source,web+'components/icon.tsx'),'utf8')
const smartIcon = iconSource.match(/export const SmartIdentifierIcon[^=]*= \(props\) => \(([\s\S]*?)\n\)/)?.[1]
if (!smartIcon) throw new Error('SmartIdentifierIcon source structure changed; update the React adapter.')
await writeFile(path.join(output,'SmartIdentifierIcon.tsx'),`// Generated from Build components/icon.tsx by sync-runtime-source.mjs.\nimport type { SVGProps } from 'react'\nexport function SmartIdentifierIcon(props: SVGProps<SVGSVGElement>) { return (${smartIcon.replaceAll('fill-rule=', 'fillRule=').replaceAll('clip-rule=', 'clipRule=')}) }\n`)
await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
// Generate the icon table through the same extraction as sync-from-lingee.ts.
const glyphs = await readFile(path.join(source,ui+'icon.tsx'),'utf8')
const table = glyphs.slice(glyphs.indexOf('const icons = {'),glyphs.indexOf('\n}\n',glyphs.indexOf('const icons = {'))+2)
const viewBoxes = glyphs.slice(glyphs.indexOf('const viewBox = () => {')+'const viewBox = () => {'.length,glyphs.lastIndexOf('return \"0 0 16 16\"')).replaceAll('local.name','name')
await writeFile(path.join(root,'src/ui/icon/icons.gen.ts'),`// Generated from Build icon.tsx by sync-runtime-source.mjs; do not edit.\n${table.replace('const icons','export const icons')}\nexport type IconName = keyof typeof icons\nexport function iconViewBox(name: string) {${viewBoxes}return \"0 0 16 16\"\n}\n`)
const rollback = iconSource.match(/export const LeftRollbackIcon[^=]*= \(props\) => \(([\s\S]*?)\n\)/)?.[1]
if (!rollback) throw new Error('LeftRollbackIcon structure changed')
await writeFile(path.join(output,'LeftRollbackIcon.tsx'),`// Generated from Build components/icon.tsx.\nimport type { SVGProps } from 'react'\nexport function LeftRollbackIcon(props: SVGProps<SVGSVGElement>) { return (${rollback.replaceAll('fill-rule=', 'fillRule=').replaceAll('clip-rule=', 'clipRule=')}) }\n`)
await mkdir(path.join(output,'model-icons'),{recursive:true})
for (const name of ['qwen','deepseek','gml','kimi','minimax','trae','seed','hy','step']) {
  const relative = `${web}assets/model-icons/model-${name}-16.svg`
  await copyFile(path.join(source,relative),path.join(output,'model-icons',`model-${name}-16.svg`))
}
console.log(`Copied ${css.length} CSS files + ${references.length} original component sources; extracted ${chunks.length} runtime style blocks.`)
