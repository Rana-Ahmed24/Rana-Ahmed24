import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const db = new PGlite();
const schema = readFileSync(
  "supabase/migrations/20261016180835_create_family_expenses.sql",
  "utf8",
);
const id = "12345678-1234-4234-9234-123456789012";
beforeAll(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(schema);
});
afterAll(async () => {
  await db.close();
});
describe("actual PostgreSQL schema and permissions", () => {
  it("blocks direct anonymous/authenticated access and public function execution", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(db.query("select * from public.expenses")).rejects.toThrow(/permission denied/);
      await expect(db.query("select public.list_expenses(null)")).rejects.toThrow(
        /permission denied/,
      );
      await db.exec("reset role");
    }
  });
  it("stores exact amounts, increments revisions, and prevents lost updates", async () => {
    await db.exec("set role service_role");
    await db.query(
      "insert into public.expenses(id,expense_date,amount_piastres,description,category) values($1,'2026-10-16',29,'Milk','Groceries')",
      [id],
    );
    const first = await db.query(
      "update public.expenses set amount_piastres=101 where id=$1 and version=1 returning *",
      [id],
    );
    expect(first.rows[0]).toMatchObject({ amount_piastres: 101, version: 2 });
    const stale = await db.query(
      "update public.expenses set amount_piastres=500 where id=$1 and version=1 returning *",
      [id],
    );
    expect(stale.rows).toHaveLength(0);
    const staleDelete = await db.query(
      "delete from public.expenses where id=$1 and version=1 returning *",
      [id],
    );
    expect(staleDelete.rows).toHaveLength(0);
    await db.exec("reset role");
  });
  it("enforces database constraints independently of form validation", async () => {
    await expect(
      db.query(
        "insert into public.expenses(id,expense_date,amount_piastres,description,category) values(gen_random_uuid(),'2026-10-16',0,'Invalid','Groceries')",
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query(
        "insert into public.expenses(id,expense_date,amount_piastres,description,category) values(gen_random_uuid(),'2026-10-16',5,'Invalid','Unknown')",
      ),
    ).rejects.toThrow(/check constraint/);
  });
  it("returns complete monthly snapshots beyond the API row limit and handles leap days", async () => {
    await db.exec(
      "insert into public.expenses(id,expense_date,amount_piastres,description,category) select gen_random_uuid(),'2024-02-29'::date,1,'Small expense','Other' from generate_series(1,1005)",
    );
    const feb = await db.query<{ list_expenses: unknown[] }>(
      "select public.list_expenses('2024-02')",
    );
    expect(feb.rows[0].list_expenses).toHaveLength(1005);
    const empty = await db.query<{ list_expenses: unknown[] }>(
      "select public.list_expenses('2026-09')",
    );
    expect(empty.rows[0].list_expenses).toEqual([]);
    const all = await db.query<{ list_expenses: unknown[] }>("select public.list_expenses(null)");
    expect(all.rows[0].list_expenses).toHaveLength(1006);
  });
});
