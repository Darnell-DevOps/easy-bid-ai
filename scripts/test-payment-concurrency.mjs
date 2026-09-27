// Only runs against the disposable local Supabase database rebuilt by CI.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const connection = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
function sql(query) {
  return new Promise((resolve,reject) => {
    const child = spawn('psql',[connection,'-X','-A','-t','-v','ON_ERROR_STOP=1','-c',query]);
    let out='', error='';
    child.stdout.on('data',data => out+=data);
    child.stderr.on('data',data => error+=data);
    child.on('error',reject);
    child.on('close',code => code === 0 ? resolve(out.trim()) : reject(new Error(error)));
  });
}
const id=randomUUID(), user=randomUUID(), txn=`txn_test_${id}`, key=`email_test_${id}`, event=`evt_test_${id}`;
const paid = () => sql(`select record_retainer_payment('sandbox','${event}','${id}','${txn}','paid',900,'GBP');`);
const claimEmail = () => sql(`select claim_email_send('${key}',null,'${user}','test','qa@example.invalid','QA','fixedhash');`);
try {
  await sql(`insert into auth.users(id,email,raw_user_meta_data) values('${user}','${user}@example.invalid','{}');`);
  await sql(`insert into retainers(id,user_id,currency,environment) values('${id}','${user}','GBP','sandbox');`);
  const charges=await Promise.all(Array.from({length:8},paid));
  assert.equal(charges.map(JSON.parse).filter(value => !value.duplicate).length,1,'one financial application');
  assert.equal(await sql(`select total_billed_cents||':'||total_payments_count from retainers where id='${id}'`),'900:1');
  assert.equal(await sql(`select count(*) from retainer_invoices where paddle_transaction_id='${txn}'`),'1');
  const lateFailure=JSON.parse(await sql(`select record_retainer_payment('sandbox','late-${event}','${id}','${txn}','failed',900,'GBP','declined');`));
  assert.equal(lateFailure.ignored,true,'late failure cannot reverse paid status');
  const failedTxn=`failed_${txn}`;
  const failures=await Promise.all(Array.from({length:8},() => sql(`select record_retainer_payment('sandbox','failed-${event}','${id}','${failedTxn}','failed',900,'GBP','declined');`)));
  assert.equal(failures.map(JSON.parse).filter(value => !value.duplicate).length,1);
  assert.equal(await sql(`select payment_retry_count from retainers where id='${id}'`),'1');
  await sql(`select record_retainer_payment('sandbox','recovered-${event}','${id}','${failedTxn}','paid',900,'GBP');`);
  assert.equal(await sql(`select total_billed_cents||':'||total_payments_count||':'||payment_retry_count from retainers where id='${id}'`),'1800:2:0');
  // Separate sessions contend for the same email reservation before any send.
  const reservations=(await Promise.all(Array.from({length:8},claimEmail))).map(JSON.parse);
  assert.equal(reservations.filter(value => value.status==='claimed').length,1);
  const claimed=reservations.find(value => value.status==='claimed');
  await sql(`select finish_email_send('${claimed.id}','${claimed.token}','uncertain',null,'connection lost');`);
  assert.equal(JSON.parse(await claimEmail()).status,'uncertain','ambiguous delivery never auto-retries');
  await sql(`update email_send_log set status='failed' where id='${claimed.id}';`);
  const retries=(await Promise.all(Array.from({length:8},claimEmail))).map(JSON.parse);
  assert.equal(retries.filter(value => value.status==='claimed').length,1);
  const retry=retries.find(value => value.status==='claimed');
  await sql(`select finish_email_send('${retry.id}','${retry.token}','sent','provider-test',null);`);
  assert.equal(JSON.parse(await claimEmail()).status,'sent');
  assert.equal(JSON.parse(await sql(`select claim_email_send('${key}',null,'${user}','test','other@example.invalid','QA','changedhash');`)).status,'conflict');
  await sql(`insert into payment_webhook_events(environment,event_id,event_type,occurred_at,payload) values('sandbox','${event}','test',now(),'{}');`);
  const jobs=await Promise.all(Array.from({length:8},() => sql(`select row_to_json(e) from claim_payment_webhook_event() e;`)));
  assert.equal(jobs.filter(Boolean).length,1,'one queue consumer');
  const job=JSON.parse(jobs.find(Boolean));
  await sql(`select finish_payment_webhook_event('sandbox','${event}','${job.claim_token}',null);`);
  assert.equal(await sql(`select count(*) from claim_payment_webhook_event()`),'0');
  // A delayed provider snapshot cannot erase a newer paid entitlement.
  await sql(`select apply_paddle_plan_state('${user}','sub_test','customer_test','price_test','sandbox','pro',now()+interval '1 month',true,'2026-09-27T12:00:00Z');`);
  await sql(`select apply_paddle_plan_state('${user}','sub_test','customer_test',null,'sandbox','free',null,false,'2026-09-26T12:00:00Z');`);
  assert.equal(await sql(`select plan||':'||cancel_at_period_end from subscriptions where user_id='${user}'`),'pro:true');
  await sql(`select apply_paddle_plan_state('${user}','old_subscription','customer_test',null,'sandbox','free',null,false,'2026-09-28T12:00:00Z');`);
  assert.equal(await sql(`select plan from subscriptions where user_id='${user}'`),'pro','cancellation of a former subscription cannot remove current paid access');
  await assert.rejects(sql(`select record_retainer_payment('sandbox','bad-${event}','${id}','bad-${txn}','paid',900,'USD');`));
  assert.equal(await sql(`select count(*) from retainer_payment_effects where transaction_id='bad-${txn}'`),'0','invalid effects roll back');
  // Only service-role code may apply payment effects or claim email sends.
  assert.equal(await sql(`select has_function_privilege('authenticated','public.record_retainer_payment(text,text,uuid,text,text,integer,text,text)','EXECUTE')`),'f');
  assert.equal(await sql(`select has_function_privilege('anon','public.claim_email_send(text,text,uuid,text,text,text,text)','EXECUTE')`),'f');
  console.log('Payment and email concurrency checks passed (8 concurrent sessions per operation).');
} finally {
  await sql(`delete from payment_webhook_events where event_id='${event}'; delete from email_send_log where idempotency_key='${key}'; delete from retainer_payment_effects where retainer_id='${id}'; delete from retainer_reminders where retainer_id='${id}'; delete from retainer_invoices where retainer_id='${id}'; delete from retainers where id='${id}'; delete from subscriptions where user_id='${user}'; delete from auth.users where id='${user}';`);
}
