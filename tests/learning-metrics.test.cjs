const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Compile in memory. Firebase is always mocked; no production reads or writes.
function load(file, mocks = {}, DateClass = Date, cache = new Map()) {
  file = path.resolve(__dirname, '..', file);
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) return { default: JSON.parse(fs.readFileSync(file, 'utf8')) };
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Date: DateClass, console: { error() {} },
    require(id) {
      if (id in mocks) return mocks[id];
      if (id.startsWith('.')) {
        const base = path.resolve(path.dirname(file), id);
        const target = [base, base + '.ts', base + '.tsx'].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
        if (!target) throw Error(id);
        return load(target, mocks, DateClass, cache);
      }
      if (id.startsWith('firebase')) throw Error('Unmocked Firebase: ' + id);
      return require(id);
    },
  });
  return exports;
}
const { calculateLearningMetrics: calc, readAnswerInstant } = load('src/lib/learningMetrics.ts');
const { calculateCategoryLearningMetrics: byCategory, categoryInitialResultLabel: initialLabel, SMALL_INITIAL_SAMPLE_DISPLAY_COUNT } = load('src/lib/learningMetrics.ts');
const now = new Date('2026-10-04T12:00:00Z');
const at = (seconds, nanoseconds = 0) => ({ seconds, nanoseconds });
const attempt = (questionId, isCorrect, answeredAt) => ({ questionId, isCorrect, answeredAt });
const plain = x => JSON.parse(JSON.stringify(x));

test('empty history and empty public catalogue are not 0% initial ability', () => {
  const empty = calc(['a', 'b'], [], now);
  assert.equal(empty.publicTotal, 2);
  assert.equal(empty.attemptedUnique, 0);
  assert.equal(empty.coverageRate, 0);
  assert.equal(empty.firstRate, null);
  assert.equal(calc([], [], now).coverageRate, null);
});

test('repetition increases neither coverage nor initial correctness; relapse removes change', () => {
  const history = [attempt('a', false, at(1)), attempt('a', true, at(2)), attempt('a', true, at(3))];
  const m = calc(['a', 'a', 'b'], history, now);
  assert.equal(m.publicTotal, 2);
  assert.equal(m.attemptedUnique, 1);
  assert.equal(m.coverageRate, 50);
  assert.equal(m.firstRate, 0);
  assert.equal(m.changedToCorrect, 1);
  assert.equal(calc(['a'], [...history, attempt('a', false, at(4))], now).changedToCorrect, 0);
  assert.equal(calc(['a'], [attempt('a', true, at(1)), attempt('a', true, at(2))], now).changedToCorrect, 0);
});

test('all permutations agree and inputs are not mutated', () => {
  const history = Object.freeze([
    Object.freeze(attempt('a', true, Object.freeze(at(4)))),
    Object.freeze(attempt('b', true, Object.freeze(at(2)))),
    Object.freeze(attempt('a', false, Object.freeze(at(1)))),
    Object.freeze(attempt('b', false, Object.freeze(at(3)))),
  ]);
  function permutations(a) { return a.length ? a.flatMap((x, i) => permutations(a.filter((_, j) => i !== j)).map(p => [x, ...p])) : [[]]; }
  const expected = plain(calc(['a', 'b'], history, now));
  for (const p of permutations(history)) assert.deepEqual(plain(calc(['a', 'b'], p, now)), expected);
  assert.equal(expected.firstRate, 50);
  assert.equal(expected.changedToCorrect, 1);
});

test('orphan/deleted/nonpublic and missing IDs are excluded only from learning metrics', () => {
  const m = calc(['a', 'unanswered'], [attempt('a', true, at(1)), attempt('deleted', false, at(2)), attempt('unpublished', true, at(3)), attempt(null, true, at(4))], now);
  assert.equal(m.publicTotal, 2);
  assert.equal(m.attemptedUnique, 1);
  assert.equal(m.excludedAttempts, 3);
  assert.equal(m.firstRate, 100);
});

test('missing/invalid/future timestamp excludes the whole question from chronology, not coverage', () => {
  for (const date of [undefined, null, '2026-01-01', 1000, new Date(NaN), at(0, -1), at(0, 1e9), at(0.5), at(253402300800), at(-62135596801), at(now.getTime() / 1000, 1), { toDate() { throw Error(); } }]) {
    const m = calc(['a'], [attempt('a', false, date), attempt('a', true, at(1))], now);
    assert.equal(m.attemptedUnique, 1);
    assert.equal(m.invalidDateQuestions, 1);
    assert.equal(m.firstAnswered, 0);
    assert.equal(m.firstRate, null);
    assert.equal(m.changedToCorrect, 0);
  }
});

test('Firestore nanoseconds, negative epoch and exact as-of boundary are preserved', () => {
  const m = calc(['a'], [attempt('a', true, at(1, 2)), attempt('a', false, at(1, 1))], now);
  assert.equal(m.changedToCorrect, 1);
  assert.deepEqual(plain(readAnswerInstant(new Date(-1))), at(-1, 999000000));
  assert.deepEqual(plain(readAnswerInstant(at(-62135596800))), at(-62135596800));
  assert.deepEqual(plain(readAnswerInstant(at(253402300799, 999999999))), at(253402300799, 999999999));
  assert.equal(calc(['a'], [attempt('a', true, at(now.getTime() / 1000))], now).firstRate, 100);
  assert.equal(calc(['a'], [attempt('a', true, { toDate: () => new Date(1000) })], now).firstRate, 100);
  assert.equal(readAnswerInstant({ seconds: NaN, nanoseconds: 0, toDate: () => new Date(1000) }), null);
  assert.throws(() => calc([], [], new Date(NaN)), /reference date/);
});

test('same-time unanimous results are usable; conflicts do not use ID/input tie breakers', () => {
  const tied = [attempt('a', false, at(1)), attempt('a', true, at(1)), attempt('a', true, at(2))];
  const m = calc(['a'], tied, now);
  assert.equal(m.firstRate, null);
  assert.equal(m.ambiguousFirstQuestions, 1);
  assert.equal(m.changedToCorrect, 0);
  assert.deepEqual(plain(calc(['a'], tied.slice().reverse(), now)), plain(m));
  const late = calc(['a'], [attempt('a', false, at(1)), attempt('a', false, at(2)), attempt('a', true, at(2))], now);
  assert.equal(late.firstRate, 0);
  assert.equal(late.ambiguousLatestQuestions, 1);
  assert.equal(late.changedToCorrect, 0);
  assert.equal(calc(['a'], [attempt('a', false, at(1)), attempt('a', false, at(1)), attempt('a', true, at(2))], now).changedToCorrect, 1);
});

test('missing/nonboolean boundary correctness is unknown, not coerced', () => {
  for (const result of [undefined, null, 'false', 0, 1]) {
    const m = calc(['a'], [attempt('a', result, at(1)), attempt('a', true, at(2))], now);
    assert.equal(m.firstRate, null);
    assert.equal(m.ambiguousFirstQuestions, 1);
  }
  const m = calc(['a'], [attempt('a', false, at(1)), attempt('a', null, at(2)), attempt('a', true, at(3))], now);
  assert.equal(m.changedToCorrect, 1); // Only the two boundaries define this metric.
});

async function statsFixture(attempts, questions, fail = false) {
  const calls = [];
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now.getTime()])); }
    static now() { return now.getTime(); }
  }
  const mocks = {
    './firebase': { default: {}, auth: {}, db: {} }, './srs': {},
    'firebase/auth': {}, 'firebase/functions': {},
    'firebase/firestore': {
      collection(_db, ...parts) { return parts.join('/'); },
      async getDocs(ref) {
        calls.push(ref);
        if (fail) throw Error('offline');
        const rows = ref === 'questions' ? questions : attempts;
        return { docs: rows.map((data, i) => ({ id: data.id ?? String(i), data: () => data })) };
      },
    },
  };
  const { getStats } = load('src/lib/firebaseHelpers.ts', mocks, FixedDate);
  return { stats: await getStats('fake-user'), calls };
}

test('getStats uses actual published-year docs, preserves repeated/category/recent aggregates, no writes', async () => {
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7);
  const t = cutoff.getTime() / 1000;
  const history = [attempt('a', false, at(t - 1)), attempt('a', true, at(t)), attempt('gone', true, at(t + 1)), attempt('hidden', false, at(t + 2)), attempt('b', false, undefined)];
  const { stats: s, calls } = await statsFixture(history, [{ id: 'a', year: '2018a', category: 'CE関連' }, { id: 'b', year: '2018a', category: '気道管理' }, { id: 'hidden', year: '2099a', category: '感染対策' }]);
  assert.deepEqual(calls.sort(), ['questions', 'users/fake-user/attempts']);
  assert.equal(s.total, 5); assert.equal(s.correct, 2); assert.equal(s.rate, 40);
  assert.equal(s.recentTotal, 3); assert.equal(s.recentCorrect, 2);
  assert.equal(s.categories.find(c => c.name === 'CE関連').total, 2);
  assert.equal(s.categories.find(c => c.name === '未分類').total, 1);
  assert.equal(s.learning.publicTotal, 2);
  assert.equal(s.learning.attemptedUnique, 2);
  assert.equal(s.learning.firstRate, 0);
  assert.equal(s.learning.changedToCorrect, 1);
  assert.equal(s.learning.excludedAttempts, 2);
  assert.equal(s.learning.invalidDateQuestions, 1);
});

test('getStats still loads public denominator with no attempts and distinguishes read error', async () => {
  const { stats: s } = await statsFixture([], [{ id: 'a', year: '2018a' }]);
  assert.equal(s.learning.publicTotal, 1); assert.equal(s.learning.firstRate, null);
  assert.equal(s.total, 0); assert.equal(s.statsError, false);
  const { stats: failed } = await statsFixture([], [], true);
  assert.equal(failed.statsError, true); assert.equal(failed.learning, null);
});

test('recent window includes exact cutoff, excludes one nanosecond before it', async () => {
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7);
  const seconds = cutoff.getTime() / 1000;
  const { stats } = await statsFixture([
    attempt('a', true, at(seconds - 1, 999999999)),
    attempt('a', false, at(seconds)),
  ], [{ id: 'a', year: '2018a' }]);
  assert.equal(stats.recentTotal, 1);
  assert.equal(stats.recentCorrect, 0);
});

test('screen separates learning/initial/history; zero and error are not ability scores', () => {
  const { StatsScreen } = load('src/features/quiz/screens/StatsScreen.tsx');
  const render = stats => renderToStaticMarkup(React.createElement(StatsScreen, { phase: 'stats', saving: false, setPhase() {}, stats }));
  const base = { total: 0, rate: 0, recentTotal: 0, categories: [], learning: calc(['a'], [], now) };
  const empty = render(base);
  assert.match(empty, /学習範囲と初回成績/);
  assert.match(empty, /未実施/); assert.doesNotMatch(empty, />0%</);
  assert.match(empty, /繰り返しを含む延べ集計/);
  assert.match(empty, /初回誤答 → 直近正答/);
  assert.match(empty, /同時刻/);
  const active = render({ ...base, total: 2, rate: 50, learning: calc(['a', 'b'], [attempt('a', false, at(1)), attempt('a', true, at(2))], now) });
  assert.match(active, /1 \/ 2問（50%）/);
  assert.match(active, /0%（0 \/ 1問）/);
  assert.match(active, /1問/);
  const error = render({ ...base, statsError: true });
  assert.match(error, /読み込めませんでした/); assert.doesNotMatch(error, /未実施/);
  assert.match(render({ ...base, learning: undefined }), /未取得/);
});

test('category coverage uses current public documents, includes untouched groups, excludes zero-question groups', () => {
  const questions = Object.freeze([
    Object.freeze({ id: 'a', category: 'CE関連' }), Object.freeze({ id: 'a', category: 'CE関連' }),
    Object.freeze({ id: 'b', category: 'CE関連' }), Object.freeze({ id: 'c', category: '気道管理' }),
    Object.freeze({ id: 'd' }),
  ]);
  const history = Object.freeze([
    Object.freeze({ ...attempt('a', false, at(1)), category: '旧分類' }),
    Object.freeze(attempt('a', true, at(2))), Object.freeze(attempt('gone', true, at(1))),
  ]);
  const categories = byCategory(questions, history, now);
  const ce = categories.find(c => c.name === 'CE関連');
  assert.equal(ce.publicTotal, 2); assert.equal(ce.attemptedUnique, 1);
  assert.equal(ce.coverageRate, 50); assert.equal(ce.firstCorrect, 0); assert.equal(ce.firstAnswered, 1);
  assert.equal(categories.find(c => c.name === '気道管理').attemptedUnique, 0);
  assert.equal(initialLabel(categories.find(c => c.name === '気道管理')), '未着手');
  assert.ok(categories.some(c => c.name === '未分類'));
  assert.ok(!categories.some(c => c.name === '旧分類'));
  assert.equal(categories.length, 3);
  assert.equal(byCategory([], history, now).length, 0);
  const moved = byCategory([{ id: 'a', category: '気道管理' }, { id: 'b', category: 'CE関連' }], history, now);
  assert.equal(moved.find(c => c.name === 'CE関連').attemptedUnique, 0);
  assert.equal(moved.find(c => c.name === '気道管理').firstCorrect, 0);
  assert.equal(moved.find(c => c.name === '気道管理').firstAnswered, 1);
  assert.deepEqual(plain(byCategory(questions.slice().reverse(), history.slice().reverse(), now)), plain(categories));
  assert.throws(() => byCategory([{ id: 'a', category: 'A' }, { id: 'a', category: 'B' }], [], now), /Conflicting/);
});

test('category missing dates and tied first outcomes use the same conservative rules', () => {
  const m = byCategory([{ id: 'a', category: 'A' }, { id: 'b', category: 'A' }], [
    attempt('a', true, null), attempt('b', false, at(1)), attempt('b', true, at(1)),
  ], now)[0];
  assert.equal(m.attemptedUnique, 2); assert.equal(m.coverageRate, 100);
  assert.equal(m.firstAnswered, 0); assert.equal(m.unscoredInitialQuestions, 2);
  assert.equal(initialLabel(m), '初回の正解：判定できる履歴なし');
});

test('under-five rule is UI guidance only, with exact 0/1/3/4/5 and 7-of-12 presentation', () => {
  assert.equal(SMALL_INITIAL_SAMPLE_DISPLAY_COUNT, 5);
  const base = { name: 'A', publicTotal: 60, attemptedUnique: 12, coverageRate: 20, unscoredInitialQuestions: 0 };
  for (const n of [1, 3, 4]) {
    const label = initialLabel({ ...base, firstAnswered: n, firstCorrect: 1, firstRate: Math.round(100 / n) });
    assert.match(label, /まだ回答が少ない/); assert.doesNotMatch(label, /%/);
  }
  assert.equal(initialLabel({ ...base, firstAnswered: 3, firstCorrect: 2, firstRate: 67 }), '初回の正解 2/3問　まだ回答が少ない');
  assert.equal(initialLabel({ ...base, firstAnswered: 5, firstCorrect: 2, firstRate: 40 }), '初回の正解 2/5問（40%）');
  assert.equal(initialLabel({ ...base, firstAnswered: 12, firstCorrect: 7, firstRate: 58 }), '初回の正解 7/12問（58%）');
  assert.equal(initialLabel({ ...base, attemptedUnique: 0, firstAnswered: 0, firstCorrect: 0, firstRate: null }), '未着手');
});

test('getStats exposes new category metrics while preserving legacy category aggregates', async () => {
  const { stats } = await statsFixture([attempt('a', false, at(1)), attempt('a', true, at(2))], [
    { id: 'a', year: '2018a', category: 'CE関連' }, { id: 'b', year: '2018a', category: '気道管理' },
    { id: 'hidden', year: '2099a', category: '非公開' },
  ]);
  assert.equal(stats.categories.find(c => c.name === 'CE関連').total, 2);
  assert.equal(stats.categories.find(c => c.name === 'CE関連').rate, 50);
  assert.equal(stats.categoryLearning.find(c => c.name === 'CE関連').firstRate, 0);
  assert.equal(stats.categoryLearning.find(c => c.name === '気道管理').publicTotal, 1);
  assert.equal(stats.categoryLearning.length, 2);
});

test('category UI bars show coverage and fixed category color, not correctness or ranking', () => {
  const { StatsScreen } = load('src/features/quiz/screens/StatsScreen.tsx');
  const { catStyle } = load('src/features/quiz/theme.ts');
  const category = { name: 'CE関連', publicTotal: 60, attemptedUnique: 12, coverageRate: 20, firstAnswered: 12, firstCorrect: 7, firstRate: 58, unscoredInitialQuestions: 0 };
  const render = categoryLearning => renderToStaticMarkup(React.createElement(StatsScreen, {
    phase: 'stats', saving: false, setPhase() {},
    stats: { total: 100, rate: 90, recentTotal: 10, categories: [], categoryLearning, learning: calc([], [], now) },
  }));
  const html = render([category]);
  assert.match(html, /分野ごとの進み具合と初回成績/);
  assert.match(html, /取り組んだ問題 12\/60問/); assert.match(html, /初回の正解 7\/12問（58%）/);
  assert.match(html, /width:20%/); assert.doesNotMatch(html, /width:58%/);
  assert.ok(html.includes('background:' + catStyle('CE関連').color));
  assert.match(html, /aria-valuemax="60" aria-valuenow="12"/);
  assert.doesNotMatch(html, /苦手|得意|習得済み|低い順/);
  assert.match(html, /表示上の目安/);
  const small = render([{ ...category, attemptedUnique: 3, firstAnswered: 3, firstCorrect: 2, firstRate: 67 }]);
  assert.match(small, /初回の正解 2\/3問　まだ回答が少ない/); assert.doesNotMatch(small, /67%/);
  assert.match(render([{ ...category, attemptedUnique: 0, firstAnswered: 0, firstCorrect: 0, firstRate: null }]), /未着手/);
  assert.match(render([]), /公開問題なし/);
});
