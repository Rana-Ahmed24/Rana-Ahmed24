import { NextRequest } from "next/server";
import { UUID, validateExpense } from "@/lib/expenses";
import { deleteExpense, getExpense, updateExpense } from "@/lib/server/database";
import { fail, HttpError, invalid, json, readJson, requireSameOrigin } from "@/lib/server/http";

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
    requireSameOrigin(req);
    const { id } = await context.params;
    if (!UUID.test(id)) invalid("Invalid expense ID.");
    const body = (await readJson(req)) as Record<string, unknown>;
    if (!body || !Number.isSafeInteger(body.version) || Number(body.version) < 1)
      invalid("Reload this expense before making changes.");
    if (remove) {
      await deleteExpense(id, Number(body.version));
      return json({ deleted: true });
    }
    let input;
    try {
      input = validateExpense({ ...body, id });
    } catch (e) {
      invalid((e as Error).message);
    }
    return json({ expense: await updateExpense(input, Number(body.version)) });
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
