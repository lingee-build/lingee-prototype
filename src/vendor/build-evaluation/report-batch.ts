type ReportIdentity = { id: string; batchId?: string }
type ModelReport = ReportIdentity & { executionModel?: { configId: string } }

/** Reports are ordered newest first. Use the stable model configuration ID, not its display name. */
export function latestReportForExecutionModel<T extends ModelReport>(report: ModelReport, reports: readonly T[]) {
  return reports.find((candidate) => candidate.executionModel?.configId === report.executionModel?.configId)
}

/** The newest report identifies the latest batch. A single-model run is its own batch. */
export function isInLatestReportBatch(report: ReportIdentity, latest: ReportIdentity | undefined) {
  return !!latest && (report.id === latest.id || (!!latest.batchId && report.batchId === latest.batchId))
}
