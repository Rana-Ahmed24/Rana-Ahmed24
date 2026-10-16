import { NextRequest } from "next/server";
import { summarize, validMonth, validateExpense } from "@/lib/expenses";
import { addExpense, listExpenses } from "@/lib/server/database";
import { fail, invalid, json, readJson, requireSameOrigin } from "@/lib/server/http";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month") ?? "";
    if (!validMonth(month)) invalid("Choose a valid month.");
    return json(summarize(await listExpenses(month), month));
  } catch (error) {
    return fail(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const body = await readJson(req);
    let input;
    try {
      input = validateExpense(body);
    } catch (e) {
      invalid((e as Error).message);
    }
    return json({ expense: await addExpense(input) }, 201);
  } catch (error) {
    return fail(error);
  }
}
