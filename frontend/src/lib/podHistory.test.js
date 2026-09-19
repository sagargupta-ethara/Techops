import { datedPath, filterDateOptions } from "./podHistory";

describe("POD backup history helpers", () => {
  const options = [
    { date: "2026-09-19", source: "snapshot" },
    { date: "2026-09-18", source: "snapshot+backup" },
    { date: "2026-09-17", source: "backup" },
  ];

  test("filters available reporting days inclusively", () => {
    expect(filterDateOptions(options, "2026-09-18", "2026-09-19")).toEqual(options.slice(0, 2));
  });

  test("preserves the selected day in summary and drill-down paths", () => {
    expect(datedPath("/summary", "2026-09-18")).toBe("/summary?date=2026-09-18");
    expect(datedPath("/pods/Example Lead", "")).toBe("/pods/Example Lead");
  });
});
