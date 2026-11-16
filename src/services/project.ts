import { db } from "@/mock/db"
import { latency, uid } from "@/mock/latency"
import type { Project } from "@/mock/types"

export const projectService = {
  list: () => latency(db.projects),
  create(name: string) {
    const project: Project = { id: uid("prj"), name, worktree: `/Users/liangpx/code/${name}`, git: false }
    db.projects.push(project)
    return latency(project)
  },
  rename(id: string, name: string) {
    const project = db.projects.find((x) => x.id === id)
    if (project) project.name = name
    return latency(project)
  },
  remove(id: string) {
    db.projects = db.projects.filter((x) => x.id !== id)
    db.sessions = db.sessions.filter((x) => x.projectId !== id)
    return latency(true)
  },
}
