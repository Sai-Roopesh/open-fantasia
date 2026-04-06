import { castRecord, castRow, castRows } from "@/lib/data/shared";

describe("shared data casts", () => {
  it("guards record casts in non-production environments", () => {
    expect(() => castRecord(null)).toThrow("must be a plain object");
    expect(() => castRow([])).toThrow("must be a plain object");
  });

  it("guards row arrays in non-production environments", () => {
    expect(() => castRows({})).toThrow("must be an array");
    expect(castRows(null)).toEqual([]);
  });
});
