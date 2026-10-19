import { NextRequest } from "next/server";
import { UUID } from "@/lib/expenses";
import { getExpense } from "@/lib/server/database";
import { getReceipt } from "@/lib/server/receipts";
import { fail, HttpError } from "@/lib/server/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) throw new HttpError(400, "Invalid expense ID.");
    const expense = await getExpense(id);
    if (!expense) throw new HttpError(404, "This expense has been deleted.");
    if (!expense.receipt_key) throw new HttpError(404, "This expense has no receipt photo.");

    const image = await getReceipt(id, expense.receipt_key);
    return new Response(image.body, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'inline; filename="receipt.jpg"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const response = fail(error);
    return response;
  }
}
