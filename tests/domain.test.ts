import { describe, expect, it } from "vitest";
import {
  amountText,
  cairoToday,
  expensesCsv,
  monthBounds,
  moveMonth,
  parseAmount,
  summarize,
  validDate,
  validMonth,
  validateExpense,
  type Expense,
} from "../src/lib/expenses";

const input = {
  id: "12345678-1234-4234-9234-123456789012",
  expense_date: "2026-10-16",
  amount_piastres: 12345,
  description: "Weekly shop",
  category: "Groceries",
  notes: "",
};
const row = {
  ...input,
  category: "Groceries",
  version: 1,
  created_at: "2026-10-16T12:00:00Z",
  updated_at: "2026-10-16T12:00:00Z",
} as Expense;
describe("currency and input", () => {
  it("parses EGP exactly to integer piastres", () => {
    expect(parseAmount("0.29")).toBe(29);
    expect(parseAmount("1.01")).toBe(101);
    expect(parseAmount(" 99.9 ")).toBe(9990);
    expect(parseAmount("9999999.99")).toBe(999999999);
    expect(amountText(29)).toBe("0.29");
  });
  it.each(["0", "-1", "1.001", "1e3", "NaN", "Infinity", "", "12,50", "10000000", ".25"])(
    "rejects invalid amount %s",
    (value) => expect(parseAmount(value)).toBeNull(),
  );
  it("validates at the server boundary and trims text", () => {
    expect(validateExpense({ ...input, description: "  shop  " }, "2026-10-16").description).toBe(
      "shop",
    );
    for (const change of [
      { amount_piastres: 1.2 },
      { amount_piastres: 0 },
      { category: "Unknown" },
      { expense_date: "2026-10-17" },
      { expense_date: "2026-02-30" },
      { description: "  " },
      { notes: "a".repeat(1001) },
      { id: "anything" },
    ])
      expect(() => validateExpense({ ...input, ...change }, "2026-10-16")).toThrow();
  });
});
describe("Cairo dates and monthly history", () => {
  it("uses Cairo's day even when the device is abroad", () => {
    expect(cairoToday(new Date("2026-10-16T22:30:00Z"))).toBe("2026-10-17");
    expect(cairoToday(new Date("2026-01-01T22:30:00Z"))).toBe("2026-01-02");
  });
  it("handles leap years, invalid days and year boundaries", () => {
    expect(validDate("2024-02-29")).toBe(true);
    expect(validDate("2025-02-29")).toBe(false);
    expect(validMonth("2026-13")).toBe(false);
    expect(validMonth("1999-12")).toBe(false);
    expect(monthBounds("2024-02")).toEqual(["2024-02-01", "2024-02-29"]);
    expect(moveMonth("2026-12", 1)).toBe("2027-01");
    expect(moveMonth("2026-01", -1)).toBe("2025-12");
  });
  it("totals saved integer amounts, including days with multiple expenses", () => {
    const result = summarize(
      [
        row,
        { ...row, id: "other", amount_piastres: 29 },
        { ...row, id: "third", expense_date: "2026-10-01", amount_piastres: 101 },
      ],
      "2026-10",
      "2026-10-16",
    );
    expect(result.total).toBe(12475);
    expect(result.daily["2026-10-16"]).toBe(12374);
    expect(summarize([], "2026-09").total).toBe(0);
  });
});
describe("CSV backup", () => {
  it("quotes commas, quotes, multiline notes and neutralizes spreadsheet formulas", () => {
    const csv = expensesCsv([
      { ...row, description: '=HYPERLINK("evil")', notes: 'milk, bread\n"two"' },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""evil"")"');
    expect(csv).toContain('"milk, bread\n""two"""');
    expect(csv).toContain('"123.45"');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});
