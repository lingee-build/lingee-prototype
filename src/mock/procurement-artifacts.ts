import type { Rules } from '@/services/procurement'

/** Generated demo artifacts, kept separate from UI and isolated per created skill. */
export const procurementArtifacts = new Map<string, { projectId: string; rules: Rules; files: Record<string, string>; report: string }>()
export function procurementFile(path: string, projectId?: string) {
  for (const [name, artifact] of procurementArtifacts) {
    if (projectId && artifact.projectId !== projectId) continue
    const relative = path.replace(/^skills\//, '')
    if (relative.startsWith(`${name}/`)) return artifact.files[relative.slice(name.length + 1)]
  }
}
export function procurementPaths(projectId: string) {
  return [...procurementArtifacts].filter(([, a]) => a.projectId === projectId).flatMap(([name, a]) => Object.keys(a.files).map(file => `skills/${name}/${file}`))
}
