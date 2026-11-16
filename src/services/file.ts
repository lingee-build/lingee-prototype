import { procurementFile, procurementPaths } from "@/mock/procurement-artifacts"
import { fileContent, projectFilePaths, sessionDiffs } from "@/mock/fixtures/files"
import { latency } from "@/mock/latency"

export const fileService = {
  /** 项目下全部文件的相对路径 */
  list: (projectId: string) => latency([...(projectFilePaths[projectId] ?? []), ...procurementPaths(projectId)], 200),
  read: (_projectId: string, path: string) => latency(procurementFile(path, _projectId) ?? fileContent(path), 150),
  /** 会话产生的文件变更 */
  diff: (sessionId: string) => latency(sessionDiffs[sessionId] ?? [], 200),
}
