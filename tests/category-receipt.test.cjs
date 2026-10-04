const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const helper = import('../scripts/category-receipt.mjs');

function fixture() {
  const changes = ['2025a-1', '2025a-2'].map(id => ({id, category:'CE関連', original:{category:'未分類', stem:'本文', answer:'a', choices:{a:'選択肢'}}}));
  const context = {planPath:'/review/plan.json', snapshotPath:'/review/before.json', digest:'reviewed-plan-hash', changes,
    current:changes.map(q => ({id:q.id, exists:true, data:{...q.original, category:q.category}}))};
  const record = {project:'periop-quiz', planPath:context.planPath, snapshotPath:context.snapshotPath, sha256:context.digest,
    changes:changes.map(q => ({id:q.id, from:q.original.category, to:q.category})), status:'prepared'};
  return {record, context};
}

test('recovery validates prepared and verified without mutating inputs', async () => {
  const {verifyAppliedReceipt} = await helper;
  for (const status of ['prepared', 'verified']) {
    const {record, context} = fixture(); record.status = status;
    const original = structuredClone({record, context});
    const result = verifyAppliedReceipt(record, context);
    assert.equal(result.status, 'verified');
    assert.equal(result.recoveredByReadOnlyVerification, true);
    assert.deepEqual({record, context}, original);
  }
});

const invalidCases = {
  unapplied: c => c.current.forEach((q,i) => q.data = structuredClone(c.changes[i].original)),
  partial: c => c.current[1].data.category = '未分類',
  stem: c => c.current[0].data.stem = '変更',
  answer: c => c.current[0].data.answer = 'b',
  choices: c => c.current[0].data.choices = {a:'変更'},
  extraField: c => c.current[0].data.extra = true,
  missing: c => c.current[0].exists = false,
  count: c => c.current.pop(),
  wrongId: c => c.current[0].id = '2025a-3',
  reordered: c => c.current.reverse(),
  noop: c => c.changes[0].original.category = 'CE関連',
  empty: c => {c.changes = []; c.current = [];}
};
for (const [name, mutate] of Object.entries(invalidCases)) test(`recovery rejects ${name}`, async () => {
  const {verifyAppliedReceipt} = await helper;
  const {record, context} = fixture(); mutate(context);
  const original = structuredClone(record);
  assert.throws(() => verifyAppliedReceipt(record, context));
  assert.deepEqual(record, original);
});
for (const field of ['project','planPath','snapshotPath','sha256','changes','status']) test(`recovery rejects receipt ${field} mismatch`, async () => {
  const {verifyAppliedReceipt} = await helper;
  const {record, context} = fixture(); record[field] = field === 'changes' ? [] : 'wrong';
  assert.throws(() => verifyAppliedReceipt(record, context), /Receipt/);
});

function tempReceipt(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'category-receipt-test-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  return {dir, file:path.join(dir, 'receipt.json')};
}
test('atomic create and replace preserve complete JSON and private permissions', async t => {
  const {saveReceiptAtomic} = await helper;
  const {dir, file} = tempReceipt(t);
  saveReceiptAtomic(file, {status:'prepared'}, {exclusive:true});
  assert.throws(() => saveReceiptAtomic(file, {status:'wrong'}, {exclusive:true}), {code:'EEXIST'});
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), {status:'prepared'});
  saveReceiptAtomic(file, {status:'verified'});
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), {status:'verified'});
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(dir), ['receipt.json']);
});
for (const failure of ['writeFileSync','fsyncSync','renameSync']) test(`failure at ${failure} keeps old receipt and allows retry`, async t => {
  const {saveReceiptAtomic} = await helper;
  const {dir, file} = tempReceipt(t);
  saveReceiptAtomic(file, {status:'prepared'}, {exclusive:true});
  const io = {...fs, [failure]:(...args) => {
    if (failure === 'writeFileSync') fs.writeFileSync(args[0], '{');
    throw new Error('injected failure');
  }};
  assert.throws(() => saveReceiptAtomic(file, {status:'verified'}, {io}), /injected/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), {status:'prepared'});
  assert.deepEqual(fs.readdirSync(dir), ['receipt.json']);
  saveReceiptAtomic(file, {status:'verified'});
  assert.equal(JSON.parse(fs.readFileSync(file)).status, 'verified');
});
test('directory flush failure after publication leaves a complete retryable receipt', async t => {
  const {saveReceiptAtomic} = await helper;
  const {file} = tempReceipt(t);
  saveReceiptAtomic(file, {status:'prepared'}, {exclusive:true});
  let calls = 0;
  const io = {...fs, fsyncSync:fd => {if (++calls === 2) throw new Error('directory flush'); fs.fsyncSync(fd);}};
  assert.throws(() => saveReceiptAtomic(file, {status:'verified'}, {io}), /directory flush/);
  assert.equal(JSON.parse(fs.readFileSync(file)).status, 'verified');
  saveReceiptAtomic(file, {status:'verified'});
});
