// Local-only PostgREST contract harness backed by real PostgreSQL (PGlite).
// Imported by the preview/test scripts only; never by the deployed application.
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export const LOCAL_DB_KEY = "sb_secret_local_preview_only_not_a_real_supabase_key";

function todayInCairo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"].map((k) => parts.find((p) => p.type === k).value).join("-");
}
export async function startLocalDatabase({
  port = 4310,
  persistent = false,
  test = false,
  seed = true,
} = {}) {
  if (process.env.VERCEL) throw new Error("The local database harness must never run on Vercel.");
  if (persistent) await mkdir(".private/preview-db", { recursive: true });
  const db = new PGlite(persistent ? ".private/preview-db" : undefined);
  const exists = await db.query("select to_regclass('public.expenses') as name");
  if (!exists.rows[0].name) {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
    await db.exec(
      await readFile("supabase/migrations/20261016180835_create_family_expenses.sql", "utf8"),
    );
    if (seed) {
      const date = todayInCairo();
      const first = date.slice(0, 8) + "01";
      const rows = [
        [
          date,
          86550,
          "Weekly groceries",
          "Groceries",
          "Vegetables, fruit, milk, and pantry essentials",
        ],
        [date, 16000, "Lunch with family", "Food & Drinks", ""],
        [date, 4500, "Ride home", "Transport", ""],
        [first, 125000, "Electricity bill", "Bills", "Monthly household bill"],
        [first, 32800, "Pharmacy", "Health", ""],
        [first, 24000, "Household essentials", "Shopping", ""],
      ];
      for (const row of rows)
        await db.query(
          "insert into public.expenses(id,expense_date,amount_piastres,description,category,notes) values($1,$2,$3,$4,$5,$6)",
          [randomUUID(), ...row],
        );
    }
  }
  let failNext = false;
  const server = createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (url.pathname === "/health") return send(200, { ready: true });
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      if (test && url.pathname === "/__test/reset") {
        await db.query("delete from public.expenses");
        failNext = false;
        return send(200, {});
      }
      if (test && url.pathname === "/__test/fail-next") {
        failNext = true;
        return send(200, {});
      }
      if (req.headers.apikey !== LOCAL_DB_KEY)
        return send(401, { code: "42501", message: "Invalid local key" });
      if (failNext) {
        failNext = false;
        return send(503, { code: "LOCAL_TEST_FAILURE", message: "Simulated connection failure" });
      }
      if (url.pathname === "/rest/v1/rpc/list_expenses" && req.method === "POST") {
        const result = await db.query("select public.list_expenses($1) as data", [body.p_month]);
        return send(200, result.rows[0].data);
      }
      if (url.pathname !== "/rest/v1/expenses")
        return send(404, { message: "Unknown local endpoint" });
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      const version = Number(url.searchParams.get("version")?.replace(/^eq\./, ""));
      let result;
      if (req.method === "POST")
        result = await db.query(
          "with x as (insert into public.expenses(id,expense_date,amount_piastres,description,category,notes) values($1,$2,$3,$4,$5,$6) returning *) select row_to_json(x) as data from x",
          [
            body.id,
            body.expense_date,
            body.amount_piastres,
            body.description,
            body.category,
            body.notes,
          ],
        );
      else if (req.method === "PATCH")
        result = await db.query(
          "with x as (update public.expenses set expense_date=$1,amount_piastres=$2,description=$3,category=$4,notes=$5 where id=$6 and version=$7 returning *) select row_to_json(x) as data from x",
          [
            body.expense_date,
            body.amount_piastres,
            body.description,
            body.category,
            body.notes,
            id,
            version,
          ],
        );
      else if (req.method === "DELETE")
        result = await db.query(
          "with x as (delete from public.expenses where id=$1 and version=$2 returning id) select row_to_json(x) as data from x",
          [id, version],
        );
      else if (req.method === "GET")
        result = await db.query(
          "select row_to_json(e) as data from public.expenses e where id=$1",
          [id],
        );
      else return send(405, { message: "Unsupported method" });
      const single = req.headers.accept?.includes("application/vnd.pgrst.object+json");
      const rows = result.rows.map((r) => r.data);
      if (single && !rows.length)
        return send(406, {
          code: "PGRST116",
          details: "The result contains 0 rows",
          message: "JSON object requested, multiple (or no) rows returned",
        });
      return send(req.method === "POST" ? 201 : 200, single ? rows[0] : rows);
    } catch (error) {
      return send(error.code === "23505" ? 409 : 400, {
        code: error.code ?? "LOCAL_ERROR",
        message: "Local database request failed",
      });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}
