export const CATEGORIES = [
  "Groceries",
  "Food & Drinks",
  "Transport",
  "Bills",
  "Health",
  "Shopping",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type Expense = {
  id: string;
  expense_date: string;
  amount_piastres: number;
  description: string;
  category: Category;
  notes: string;
  receipt_key?: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};
export type ExpenseInput = Pick<
  Expense,
  "id" | "expense_date" | "amount_piastres" | "description" | "category" | "notes"
>;
export type ExpenseSaveInput = ExpenseInput & { receipt_key: string | null };
export type MonthData = {
  expenses: Expense[];
  total: number;
  daily: Record<string, number>;
  today: string;
  month: string;
};

export function cairoToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"].map((key) => parts.find((p) => p.type === key)!.value).join("-");
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function validMonth(value: string): boolean {
  return (
    /^\d{4}-\d{2}$/.test(value) &&
    validDate(`${value}-01`) &&
    value >= "2000-01" &&
    value <= "9999-12"
  );
}
export function monthBounds(month: string): [string, string] {
  if (!validMonth(month)) throw new Error("Choose a valid month.");
  const [year, m] = month.split("-").map(Number);
  return [`${month}-01`, `${month}-${new Date(Date.UTC(year, m, 0)).getUTCDate()}`];
}
export function moveMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
}
export function dayLabel(date: string, short = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: short ? "short" : "long",
    day: "numeric",
    month: short ? "short" : "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function money(piastres: number, decimals = true): string {
  return new Intl.NumberFormat("en-EG", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(piastres / 100);
}
// Parse decimal text directly, never multiply a floating-point currency value.
export function normalizeAmountInput(text: string): string {
  return Array.from(text, (character) => {
    const code = character.codePointAt(0)!;
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    if (character === "\u066b") return ".";
    if (character === "\u066c") return "";
    return character;
  }).join("");
}

export function parseAmount(text: string): number | null {
  const value = normalizeAmountInput(text).trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return amount > 0 && amount <= 999_999_999 ? amount : null;
}
export function amountText(piastres: number): string {
  return `${Math.floor(piastres / 100)}.${String(piastres % 100).padStart(2, "0")}`;
}
export function summarize(expenses: Expense[], month: string, today = cairoToday()): MonthData {
  const daily: Record<string, number> = {};
  for (const expense of expenses)
    daily[expense.expense_date] = (daily[expense.expense_date] ?? 0) + expense.amount_piastres;
  return {
    expenses,
    total: expenses.reduce((sum, e) => sum + e.amount_piastres, 0),
    daily,
    today,
    month,
  };
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateExpense(value: unknown, today = cairoToday()): ExpenseInput {
  if (!value || typeof value !== "object") throw new Error("Enter the expense details.");
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !UUID.test(v.id))
    throw new Error("Invalid expense ID. Please reopen the form.");
  if (!validDate(v.expense_date) || v.expense_date < "2000-01-01" || v.expense_date > today)
    throw new Error("Choose a date between 1 January 2000 and today in Cairo.");
  if (
    !Number.isSafeInteger(v.amount_piastres) ||
    Number(v.amount_piastres) < 1 ||
    Number(v.amount_piastres) > 999_999_999
  )
    throw new Error("Enter an amount from EGP 0.01 to EGP 9,999,999.99.");
  if (
    typeof v.description !== "string" ||
    !v.description.trim() ||
    v.description.trim().length > 160
  )
    throw new Error("Enter a name of 1 to 160 characters.");
  if (!CATEGORIES.includes(v.category as Category)) throw new Error("Choose an expense category.");
  if (v.notes !== undefined && (typeof v.notes !== "string" || v.notes.length > 1000))
    throw new Error("Notes must be 1,000 characters or fewer.");
  return {
    id: v.id,
    expense_date: v.expense_date,
    amount_piastres: Number(v.amount_piastres),
    description: v.description.trim(),
    category: v.category as Category,
    notes: (v.notes as string | undefined)?.trim() ?? "",
  };
}
function csvCell(value: string): string {
  // Neutralize spreadsheet formula injection in user-entered names.
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function expensesCsv(expenses: Expense[]): string {
  return (
    "\uFEFF" +
    [
      ["Date", "Name", "Amount (EGP)"].map(csvCell).join(","),
      ...expenses.map((e) =>
        [e.expense_date, e.description, amountText(e.amount_piastres)].map(csvCell).join(","),
      ),
    ].join("\r\n")
  );
}
