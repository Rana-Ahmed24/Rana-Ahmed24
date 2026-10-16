import { NextRequest, NextResponse } from "next/server";
import { expensesCsv, validMonth } from "@/lib/expenses";
import { listExpenses } from "@/lib/server/database";
import { fail, invalid } from "@/lib/server/http";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month");
    if (month !== null && !validMonth(month)) invalid("Choose a valid month.");
    return new NextResponse(expensesCsv(await listExpenses(month ?? undefined)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="family-expenses-${month ?? "all-months"}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
