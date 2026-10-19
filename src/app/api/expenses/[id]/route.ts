import { NextRequest } from "next/server";
import { UUID, validateExpense } from "@/lib/expenses";
import { deleteExpense, getExpense, updateExpense } from "@/lib/server/database";
import { deleteReceipt, uploadReceipt } from "@/lib/server/receipts";
import {
  fail,
  HttpError,
  invalid,
  json,
  readExpenseSubmission,
  readJson,
  requireSameOrigin,
} from "@/lib/server/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) invalid("Invalid expense ID.");
    const expense = await getExpense(id);
    if (!expense) throw new HttpError(404, "This expense has been deleted.");
    return json({ expense });
  } catch (error) {
    return fail(error);
  }
}
async function mutation(req: NextRequest, context: Context, remove: boolean) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) invalid("Invalid expense ID.");
    requireSameOrigin(
      req,
      remove ? ["application/json"] : ["application/json", "multipart/form-data"],
    );

    let body: Record<string, unknown>;
    let receipt: File | null = null;
    if (remove) {
      body = (await readJson(req)) as Record<string, unknown>;
    } else {
      const submission = await readExpenseSubmission(req);
      body = submission.value as Record<string, unknown>;
      receipt = submission.receipt;
    }
    if (!body || !Number.isSafeInteger(body.version) || Number(body.version) < 1)
      invalid("Reload this expense before making changes.");
    if (remove) {
      const current = await getExpense(id);
      if (!current) throw new HttpError(404, "This expense has been deleted.");
      await deleteExpense(id, Number(body.version));
      if (current.receipt_key) await deleteReceipt(id, current.receipt_key);
      return json({ deleted: true });
    }

    const current = await getExpense(id);
    if (!current) throw new HttpError(404, "This expense has been deleted.");
    const removeReceipt = body.remove_receipt;
    if (removeReceipt !== undefined && typeof removeReceipt !== "boolean")
      invalid("Choose whether to keep or remove this receipt.");
    if (removeReceipt && receipt)
      invalid("Remove the current receipt or choose a new photo.");

    let input;
    try {
      input = validateExpense({ ...body, id });
    } catch (e) {
      invalid((e as Error).message);
    }

    const uploadedKey = receipt ? await uploadReceipt(receipt, id) : null;
    const nextReceiptKey = uploadedKey ?? (removeReceipt ? null : (current.receipt_key ?? null));
    try {
      const expense = await updateExpense(
        { ...input, receipt_key: nextReceiptKey },
        Number(body.version),
      );
      if (current.receipt_key && current.receipt_key !== nextReceiptKey)
        await deleteReceipt(id, current.receipt_key);
      return json({ expense });
    } catch (error) {
      if (uploadedKey) await deleteReceipt(id, uploadedKey);
      throw error;
    }
  } catch (error) {
    return fail(error);
  }
}
export async function PATCH(req: NextRequest, context: Context) {
  return mutation(req, context, false);
}
export async function DELETE(req: NextRequest, context: Context) {
  return mutation(req, context, true);
}
