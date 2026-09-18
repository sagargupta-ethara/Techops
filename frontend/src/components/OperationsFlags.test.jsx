import { buildFlagCsv, filterFlagRows } from "../lib/operationsFlags";

const ROWS = [
  { name: "A", email: "a@example.com", pod: "Lead A", reason: "No assigned target" },
  { name: "B", email: "b@example.com", pod: "Lead B", reason: "Progress exists", remarks: "=unsafe" },
];

test("filters assignment flags by POD lead", () => {
  expect(filterFlagRows(ROWS, "Lead B")).toEqual([ROWS[1]]);
});

test("exports assignment flags as injection-safe CSV", () => {
  const csv = buildFlagCsv([ROWS[1]]);

  expect(csv).toContain('"POD Lead"');
  expect(csv).toContain('"Lead B"');
  expect(csv).toContain('"\'=unsafe"');
});
