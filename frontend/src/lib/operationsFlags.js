export const ALL_PODS = "__all_pods__";

export const WORKFLOW_COLUMNS = [
  ["assigned_target", "Assigned"],
  ["tasks_created_after_forge", "Trinity staged"],
  ["tasks_approved_after_crucible", "Trinity completed"],
  ["input_bundles_created", "Manual staged"],
  ["input_bundles_approved", "Bundles approved"],
  ["trajectory_generated", "Trajectories"],
  ["tasks_qced", "Tasks QCed"],
];

const CSV_COLUMNS = [
  ["name", "Name"],
  ["email", "Email"],
  ["pod", "POD Lead"],
  ["tpm", "TPM"],
  ["role", "Role"],
  ["status", "Tasking Status"],
  ["reason", "Flag Reason"],
  ...WORKFLOW_COLUMNS,
  ["remarks", "Remarks"],
];

function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildFlagCsv(rows) {
  return [
    CSV_COLUMNS.map(([, label]) => csvCell(label)).join(","),
    ...rows.map((row) => CSV_COLUMNS.map(([field]) => csvCell(row[field])).join(",")),
  ].join("\n");
}

export function filterFlagRows(rows, pod) {
  return pod === ALL_PODS ? rows : rows.filter((row) => row.pod === pod);
}
