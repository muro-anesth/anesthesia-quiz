import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

// No credentials, database handles, filesystem access or clock in this validator.
export function verifyAppliedReceipt(record, {planPath, snapshotPath, digest, changes, current}) {
  assert.ok(changes.length > 0 && current.length === changes.length, 'Applied data count mismatch');
  const summary = changes.map(q => ({id:q.id, from:q.original.category ?? null, to:q.category}));
  assert.ok(record.project === 'periop-quiz' && record.planPath === planPath &&
    record.snapshotPath === snapshotPath && record.sha256 === digest &&
    isDeepStrictEqual(record.changes, summary) && ['prepared', 'verified'].includes(record.status),
  'Receipt does not match reviewed plan');
  changes.forEach((change, i) => {
    assert.notEqual(change.original.category, change.category, 'No-op change');
    const q = current[i];
    assert.ok(q && q.id === change.id && q.exists &&
      isDeepStrictEqual(q.data, {...change.original, category:change.category}),
    `${change.id}: applied data mismatch`);
  });
  return {...record, status:'verified', recoveredByReadOnlyVerification:true};
}

// Publish only a complete, flushed file. Failures before publication preserve
// the previous receipt. A crash may leave an orphan temp, never a partial receipt.
// exclusive uses link rather than rename to preserve the original wx guarantee.
export function saveReceiptAtomic(file, record, {exclusive = false, io = fs} = {}) {
  const contents = JSON.stringify(record, null, 2);
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  let fd;
  let owned = false;
  try {
    fd = io.openSync(temp, 'wx', 0o600);
    owned = true;
    io.writeFileSync(fd, contents);
    io.fsyncSync(fd);
    io.closeSync(fd);
    fd = undefined;
    if (exclusive) io.linkSync(temp, file);
    else io.renameSync(temp, file);
    // Persist the directory entry as well as the file contents. A failure here
    // may mean publication succeeded; the complete receipt remains retryable.
    const dir = io.openSync(path.dirname(file), 'r');
    try { io.fsyncSync(dir); } finally { io.closeSync(dir); }
  } finally {
    if (fd !== undefined) { try { io.closeSync(fd); } catch {} }
    if (owned) { try { io.unlinkSync(temp); } catch {} }
  }
}
