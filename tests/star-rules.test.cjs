const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('star preferences are isolated and typed (loopback demo emulator only)', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async t => {
  const endpoint = process.env.FIRESTORE_EMULATOR_HOST;
  assert.match(endpoint, /^(127\.0\.0\.1|localhost):\d{2,5}$/);
  const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
  const { doc, collection, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp, Timestamp } = require('firebase/firestore');
  const [host, port] = endpoint.split(':');
  const env = await initializeTestEnvironment({ projectId: 'demo-periop-stars', firestore: { host, port: Number(port), rules: fs.readFileSync('firestore.rules', 'utf8') } });
  t.after(() => env.cleanup());
  await env.clearFirestore();
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  const admin = env.authenticatedContext('kuredXmbTWhCfx4dVtvdUyiZsUq1').firestore();
  const anonymous = env.unauthenticatedContext().firestore();
  const ref = (db, uid = 'alice') => doc(db, 'users', uid, 'questionStars', 'q1');
  const data = starred => ({ questionId: 'q1', starred, updatedAt: serverTimestamp() });
  await t.test('owner can star, read/list and unstar; no deletion', async () => {
    await assertSucceeds(setDoc(ref(alice), data(true)));
    assert.equal((await getDoc(ref(alice))).data().starred, true);
    await assertSucceeds(getDocs(collection(alice, 'users', 'alice', 'questionStars')));
    await assertSucceeds(setDoc(ref(alice), data(false)));
    assert.equal((await getDoc(ref(alice))).data().starred, false);
    await assertFails(deleteDoc(ref(alice)));
  });
  await t.test('other users, admin and anonymous cannot access owner stars', async () => {
    for (const db of [bob, admin, anonymous]) {
      await assertFails(getDoc(ref(db)));
      await assertFails(getDocs(collection(db, 'users', 'alice', 'questionStars')));
      await assertFails(setDoc(ref(db), data(true)));
    }
    await assertSucceeds(setDoc(ref(bob, 'bob'), data(true)));
    await assertSucceeds(getDoc(ref(bob, 'bob')));
  });
  await t.test('invalid data, timestamps, fields and changed IDs denied', async () => {
    for (const change of [
      d => { d.starred = 'true'; }, d => { d.starred = 1; }, d => { delete d.starred; },
      d => { d.questionId = 'q2'; }, d => { d.role = 'admin'; }, d => { d.selected = 'a'; },
      d => { d.updatedAt = 'today'; }, d => { d.updatedAt = Timestamp.fromDate(new Date('2000-01-01')); },
    ]) { const invalid = data(true); change(invalid); await assertFails(setDoc(ref(alice), invalid)); }
  });
  await t.test('profile escalation, other attempts and unrelated collections remain denied', async () => {
    await assertFails(setDoc(doc(alice, 'users', 'alice'), { role: 'admin' }));
    await assertFails(setDoc(doc(alice, 'users', 'bob', 'attempts', 'a1'), { value: true }));
    await assertFails(setDoc(doc(alice, 'users', 'alice', 'permissions', 'a1'), { value: true }));
    await assertFails(setDoc(doc(alice, 'questions', 'q1'), { answer: 'b' }));
  });
});
