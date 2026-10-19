import { NextRequest } from "next/server";
import { summarize, validMonth, validateExpense } from "@/lib/expenses";
import { addExpense, listExpenses } from "@/lib/server/database";
import { deleteReceipt, uploadReceipt } from "@/lib/server/receipts";
import {
  fail,
  invalid,
  json,
  readExpenseSubmission,
  requireSameOrigin,
} from "@/lib/server/http";

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
    requireSameOrigin(req, ["application/json", "multipart/form-data"]);
    const { value, receipt } = await readExpenseSubmission(req);
    let input;
    try {
      input = validateExpense(value);
    } catch (e) {
      invalid((e as Error).message);
    }

    const receiptKey = receipt ? await uploadReceipt(receipt, input.id) : null;
    try {
      const expense = await addExpense({ ...input, receipt_key: receiptKey });
      return json({ expense }, 201);
    } catch (error) {
      if (receiptKey) await deleteReceipt(input.id, receiptKey);
      throw error;
    }
  } catch (error) {
    return fail(error);
  }
}
