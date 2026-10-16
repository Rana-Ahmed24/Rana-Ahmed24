import { NextRequest } from "next/server";
import { databaseConfigured } from "@/lib/server/database";
import { fail, json, requireSameOrigin } from "@/lib/server/http";

// Compatibility for already-open tabs from the earlier key-gated release.
// No account, shared key, or session cookie is required anymore.
export const runtime = "nodejs";
export async function GET() {
  return json({ configured: databaseConfigured(), authorized: true });
}
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    return GET();
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(req: NextRequest) {
  try {
    requireSameOrigin(req);
    return GET();
  } catch (error) {
    return fail(error);
  }
}
