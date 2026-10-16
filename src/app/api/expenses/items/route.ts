import { listExpenseDescriptions } from "@/lib/server/database";
import { fail, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    return json({ items: await listExpenseDescriptions() });
  } catch (error) {
    return fail(error);
  }
}
