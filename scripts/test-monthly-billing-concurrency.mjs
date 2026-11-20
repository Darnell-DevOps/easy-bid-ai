// Deliberately restricted to CI's disposable local database.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const connection = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
function sql(query) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [connection, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query]);
    let out = "", error = "";
    child.stdout.on("data", (data) => { out += data; });
    child.stderr.on("data", (data) => { error += data; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(out.trim()) : reject(new Error(error)));
  });
}

const owner = randomUUID(), first = randomUUID(), second = randomUUID();
const runAsOwner = (statement) => sql(`BEGIN; SET LOCAL statement_timeout = '15s'; SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claim.sub','${owner}',true); ${statement}; COMMIT;`);
try {
  await sql(`INSERT INTO public.retainers
    (id,user_id,client_name,title,amount_cents,currency,billing_interval,status,start_date)
    VALUES ('${first}','${owner}','Concurrency QA','First fee',10000,'GBP','monthly','active','2026-01-31'),
      ('${second}','${owner}','Concurrency QA','Second fee',20000,'USD','monthly','active','2026-01-31');`);
  await Promise.all(Array.from({ length: 8 }, (_, index) => runAsOwner(index % 2 === 0
    ? "SELECT public.prepare_retainer_billing_month('2026-02-01')"
    : `SELECT public.prepare_retainer_billing_item('${randomUUID()}','${index % 4 === 1 ? first : second}','2026-02-01','base')`)));
  assert.equal(await sql(`SELECT count(*) FROM public.retainer_billing_items WHERE retainer_id IN ('${first}','${second}')`), "2");
  assert.equal(await sql(`SELECT count(*) FROM public.retainer_billing_items WHERE retainer_id IN ('${first}','${second}')
    AND kind = 'base' AND status = 'approved' AND billing_due_date = '2026-02-28'`), "2");
  assert.equal(await sql(`SELECT count(*) FROM public.retainer_invoices WHERE retainer_id IN ('${first}','${second}')`), "0");
  assert.equal(await sql(`SELECT sum(total_billed_cents) FROM public.retainers WHERE user_id = '${owner}'`), "0");
  console.log("Monthly preparation passed eight concurrent batch/single-fee sessions without duplicate fees or payment effects.");
} finally {
  await sql(`DELETE FROM public.retainers WHERE id IN ('${first}','${second}') AND user_id = '${owner}';`);
}
