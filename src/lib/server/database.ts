import "server-only";
import { createClient } from "@supabase/supabase-js";
import { type Expense, type ExpenseInput, type ExpenseSaveInput } from "../expenses";
import { HttpError } from "./http";

const FIELDS =
  "id,expense_date,amount_piastres,description,category,notes,receipt_key,created_at,updated_at,version";
export function databaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}
function db() {
  if (!databaseConfigured())
    throw new HttpError(503, "Connect the dedicated Supabase database to start tracking expenses.");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (url, options) =>
        fetch(url, { ...options, cache: "no-store", signal: AbortSignal.timeout(15000) }),
    },
  });
}
export async function listExpenses(month?: string): Promise<Expense[]> {
  // A single SQL snapshot, returned as one JSON value: no PostgREST row cap or
  // offset-pagination races when the other phone inserts or deletes an expense.
  const { data, error } = await db().rpc("list_expenses", { p_month: month ?? null });
  if (error) throw new Error("Database read failed");
  return data as Expense[];
}
export async function listExpenseDescriptions(): Promise<string[]> {
  const expenses = await listExpenses();
  const names = new Map<string, { name: string; createdAt: string }>();
  for (const expense of expenses) {
    const name = expense.description.trim();
    const key = name.normalize("NFKC").toLowerCase();
    const previous = names.get(key);
    if (name && (!previous || expense.created_at > previous.createdAt))
      names.set(key, { name, createdAt: expense.created_at });
  }
  return [...names.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ name }) => name);
}
export async function addExpense(input: ExpenseSaveInput): Promise<Expense> {
  const client = db();
  const { data, error } = await client.from("expenses").insert(input).select(FIELDS).single();
  if (!error) return data as Expense;
  if (error.code === "23505") {
    // A retry of the same client-generated ID must never insert twice.
    const existing = await client.from("expenses").select(FIELDS).eq("id", input.id).single();
    if (
      !existing.error &&
      (Object.keys(input) as (keyof ExpenseInput)[]).every(
        (key) => existing.data[key] === input[key],
      )
    )
      return existing.data as Expense;
    throw new HttpError(
      409,
      "This expense was already saved or changed. Refresh the day before trying again.",
    );
  }
  throw new Error("Database insert failed");
}
export async function getExpense(id: string): Promise<Expense | undefined> {
  const { data, error } = await db().from("expenses").select(FIELDS).eq("id", id).maybeSingle();
  if (error) throw new Error("Database read failed");
  return data as Expense | undefined;
}
export async function updateExpense(input: ExpenseSaveInput, version: number): Promise<Expense> {
  const { id, ...changes } = input;
  const { data, error } = await db()
    .from("expenses")
    .update(changes)
    .eq("id", id)
    .eq("version", version)
    .select(FIELDS)
    .maybeSingle();
  if (error) throw new Error("Database update failed");
  if (!data)
    throw new HttpError(
      409,
      "This expense was changed or deleted on another device. Reload the latest version before saving.",
    );
  return data as Expense;
}
export async function deleteExpense(id: string, version: number): Promise<void> {
  const { data, error } = await db()
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("version", version)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Database delete failed");
  if (!data)
    throw new HttpError(
      409,
      "This expense was changed or deleted on another device. Refresh the day before deleting.",
    );
}
