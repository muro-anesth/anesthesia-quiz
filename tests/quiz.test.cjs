const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { create, act } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(file, mocks, cache = new Map()) {
  const path = require("node:path");
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const exports = {};
  cache.set(file, exports);
  const resolve = (id) => {
    if (id in mocks) return mocks[id];
    if (id.startsWith(".") || id.startsWith("@/")) {
      const base = id.startsWith("@/")
        ? path.resolve("src", id.slice(2))
        : path.resolve(path.dirname(file), id);
      const target = [
        base,
        base + ".ts",
        base + ".tsx",
        base + "/index.ts",
      ].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      if (target) return load(target, mocks, cache);
    }
    return require(id);
  };
  class TestDate extends Date {
    static now() {
      return 1800000000000;
    }
  }
  class Audio {
    constructor(src) {
      this.src = "http://localhost" + src;
    }
    play() {
      return Promise.resolve();
    }
    pause() {}
  }
  vm.runInNewContext(output, {
    exports,
    require: resolve,
    crypto: require("node:crypto").webcrypto,
    window: { location: { origin: "http://localhost", replace() {} } },
    console,
    Date: TestDate,
    Audio,
    Promise,
    setTimeout,
  });
  return exports;
}
const q = (id) => ({
  id,
  qnum: Number(id.slice(1)),
  year: "2025a",
  category: "気道管理",
  stem: "問題 " + id,
  choices: { a: "選択肢A", b: "選択肢B" },
  answer: "a",
  explanation: "解説",
});
async function setup(options = {}) {
  const calls = [],
    questions = { q1: q("q1"), q2: q("q2") };
  let fail = false;
  const helpers = {
    getUserProfile: async () => ({
      username: "test",
      role: options.admin ? "admin" : "user",
    }),
    getYears: async () => ["2025a"],
    getCategories: async () => ["気道管理"],
    getReviewQueue: async () => ({
      total: 2,
      cards: [{ questionId: "q1" }, { questionId: "q2" }],
    }),
    getNextQuestion: async () => {
      calls.push("random");
      return {
        question: options.empty
          ? null
          : { ...q("q9"), answer: options.multi ? "ab" : "a" },
      };
    },
    saveAttempt: async (...args) => {
      calls.push(args);
      if (fail) throw Error("offline");
    },
  };
  Object.assign(helpers, {
    getStats: async () => ({
      total: 2,
      rate: 50,
      recentTotal: 2,
      categories: [{ name: "気道管理", correct: 1, total: 2, rate: 50 }],
    }),
    getUsers: async () => [{ uid: "test", username: "test", role: "user" }],
    getQuestionsForYear: async (year) => [
      { ...q(year.endsWith("a") ? "q1" : "q2"), year },
    ],
    saveExamResult: async (uid, result) => calls.push(["exam", result]),
    getExamHistory: async () => [
      {
        id: "e1",
        year: "2025",
        score: 50,
        totalQuestions: 2,
        correctAnswers: 1,
        elapsedSeconds: 0,
        date: { toDate: () => new Date("2026-09-13T12:00:00Z") },
      },
    ],
  });
  const Quiz = load("src/app/quiz/page.tsx", {
    "firebase/auth": {
      onAuthStateChanged: (_, cb) => {
        cb({ uid: "test" });
        return () => {};
      },
    },
    "@/lib/firebase": { auth: {}, db: {} },
    "@/lib/firebaseHelpers": helpers,
    "@/lib/srs": {
      SRS_OPTIONS: load("src/lib/srs.ts", {}).SRS_OPTIONS,
    },
    "firebase/firestore": {
      doc: (_, c, id) => id,
      getDoc: async (id) => ({
        id,
        exists: () => true,
        data: () => questions[id],
      }),
    },
  }).default;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Quiz));
  });
  const text = (n) =>
    typeof n === "string" ? n : (n?.children || []).map(text).join("");
  async function click(label) {
    const button = renderer.root
      .findAllByType("button")
      .find((b) => text(b).includes(label));
    assert.ok(button, label);
    await act(async () => {
      await button.props.onClick();
    });
  }
  return {
    calls,
    renderer,
    click,
    fail: (v) => (fail = v),
    text: () => text(renderer.toJSON()),
    close: async () => act(() => renderer.unmount()),
  };
}
test("review follows queue and finishes without random questions", async () => {
  const s = await setup();
  await s.click("復習モード");
  await s.click("復習を開始");
  assert.match(s.text(), /問題 q1/);
  await s.click("選択肢A");
  await s.click("思い出せた");
  assert.match(s.text(), /問題 q2/);
  await s.click("選択肢A");
  await s.click("思い出せた");
  assert.match(s.text(), /お疲れさまでした/);
  assert.equal(s.calls.includes("random"), false);
  assert.deepEqual(
    s.calls.map((c) => c[1]),
    ["q1", "q2"],
  );
  await s.close();
});
test("finish waits for rating and saves last answer before summary", async () => {
  const s = await setup();
  await s.click("クイズ");
  await s.click("選択肢A");
  await s.click("今日はここまで");
  assert.match(s.text(), /この回答を保存して終了/);
  await s.click("思い出せた");
  assert.equal(s.calls.filter(Array.isArray).length, 1);
  assert.match(s.text(), /お疲れさまでした/);
  await s.close();
});
test("failed saving stays on same review question and retries with same attempt ID", async () => {
  const s = await setup();
  await s.click("復習モード");
  await s.click("復習を開始");
  await s.click("選択肢A");
  s.fail(true);
  await s.click("思い出せた");
  assert.match(s.text(), /失敗しました/);
  assert.match(s.text(), /問題 q1/);
  s.fail(false);
  await s.click("思い出せた");
  const saves = s.calls.filter(Array.isArray);
  assert.equal(saves[0][5], saves[1][5]);
  assert.match(s.text(), /問題 q2/);
  await s.close();
});
test("attempt retry only updates SRS once and failed transaction saves nothing", async () => {
  const store = new Map();
  let fail = false;
  const timestamp = (d) => ({ toDate: () => d });
  const api = {
    doc: (...args) => args.filter((x) => typeof x === "string").join("/"),
    collection: (...args) =>
      args.filter((x) => typeof x === "string").join("/"),
    Timestamp: { fromDate: timestamp },
    runTransaction: async (_, fn) => {
      const staged = [];
      const res = await fn({
        get: async (path) => ({
          exists: () => store.has(path),
          data: () => store.get(path),
        }),
        set: (path, data) => staged.push([path, data]),
      });
      if (fail) throw Error("offline");
      for (const [p, d] of staged) store.set(p, d);
      return res;
    },
  };
  let schedules = 0;
  const { saveAttempt } = load("src/lib/firebaseHelpers.ts", {
    "firebase/firestore": api,
    "firebase/auth": {},
    "firebase/functions": {},
    "./firebase": { db: {} },
    "./srs": {
      scheduleCard: () => {
        schedules++;
        return { nextCard: {}, nextDue: new Date() };
      },
    },
  });
  fail = true;
  await assert.rejects(saveAttempt("u", "q1", "a", "a", "good", "a1"));
  assert.equal(store.size, 0);
  fail = false;
  await saveAttempt("u", "q1", "a", "a", "good", "a1");
  const before = schedules;
  await saveAttempt("u", "q1", "a", "a", "good", "a1");
  assert.equal(schedules, before);
  assert.equal(store.size, 2);
});
test("Functions reject forged admins and preserve muro as sole administrator", async () => {
  let created = 0;
  const admin = {
    initializeApp() {},
    firestore: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: true, data: () => ({ role: "admin" }) }),
          set: async () => {},
        }),
      }),
    }),
    auth: () => ({
      createUser: async () => {
        created++;
        return { uid: "new" };
      },
      updateUser: async () => {},
    }),
  };
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const functions = load("functions/index.js", {
    "firebase-admin": admin,
    "firebase-functions/v2/https": { onCall: (fn) => fn, HttpsError },
  });
  await assert.rejects(
    functions.adminCreateUser({
      auth: { uid: "member" },
      data: { username: "someone", password: "test123", role: "user" },
    }),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    functions.changeUserPassword({
      auth: { uid: "member" },
      data: { targetUid: "other", newPassword: "test123" },
    }),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    functions.adminCreateUser({
      auth: { uid: "kuredXmbTWhCfx4dVtvdUyiZsUq1" },
      data: { username: "someone", password: "test123", role: "admin" },
    }),
    (e) => e.code === "invalid-argument",
  );
  assert.equal(created, 0);
  assert.equal(
    (
      await functions.adminCreateUser({
        auth: { uid: "kuredXmbTWhCfx4dVtvdUyiZsUq1" },
        data: { username: "someone", password: "test123", role: "user" },
      })
    ).success,
    true,
  );
});
test("home after answering also requests saving rather than dropping answer", async () => {
  const s = await setup();
  await s.click("クイズ");
  await s.click("選択肢A");
  await s.click("← ホーム");
  assert.match(s.text(), /この回答を保存して終了/);
  await s.click("思い出せた");
  assert.equal(s.calls.filter(Array.isArray).length, 1);
  assert.match(s.text(), /お疲れさまでした/);
  await s.close();
});
test("screen markup matches original unaffected screens and reviewed answer panel baseline", async () => {
  const hashes = {};
  const crypto = require("node:crypto");
  const snap = (s, name) => {
    hashes[name] = crypto
      .createHash("sha256")
      .update(JSON.stringify(s.renderer.toJSON()))
      .digest("hex");
  };
  let s = await setup();
  snap(s, "home");
  await s.click("設定");
  snap(s, "settings");
  await s.click("2025a");
  await s.click("気道管理");
  snap(s, "filters");
  await s.click("← ホーム");
  await s.click("成績確認");
  snap(s, "stats");
  await s.click("← ホーム");
  await s.click("復習モード");
  snap(s, "review-list");
  await s.click("復習を開始");
  snap(s, "review-question");
  await s.click("選択肢A");
  snap(s, "answered");
  await s.click("解説を見る");
  snap(s, "explanation");
  await s.click("×");
  await s.click("今日はここまで");
  snap(s, "finish-prompt");
  await s.click("思い出せた");
  snap(s, "summary");
  await s.click("ホームに戻る");
  await s.click("試験モード");
  snap(s, "exam-select");
  await s.click("2025年度");
  snap(s, "exam-question");
  await s.click("← ホーム");
  snap(s, "exam-warning");
  await s.click("続ける");
  await s.click("選択肢A");
  snap(s, "exam-answered");
  await s.click("結果を見る");
  snap(s, "exam-transition");
  await s.click("B問題へ進む");
  snap(s, "exam-b");
  await s.click("選択肢B");
  await s.click("結果を見る");
  snap(s, "exam-result");
  assert.equal(s.calls.find((c) => c[0] === "exam")[1].score, 50);
  await s.click("履歴を見る");
  snap(s, "exam-history");
  await s.close();
  s = await setup({ admin: true });
  snap(s, "admin-home");
  await s.click("管理者パネル");
  snap(s, "admin-panel");
  await s.click("PW変更");
  snap(s, "password-panel");
  await s.close();
  s = await setup({ empty: true });
  await s.click("クイズ");
  snap(s, "empty");
  await s.close();
  s = await setup({ multi: true });
  await s.click("クイズ");
  await s.click("選択肢A");
  snap(s, "multi-selected");
  await s.click("選択肢B");
  snap(s, "multi-answered");
  await s.close();
  // Preserve the original refactor baseline for screens outside this UI change.
  const changed = [
    "review-question",
    "answered",
    "explanation",
    "finish-prompt",
    "exam-question",
    "exam-warning",
    "exam-answered",
    "exam-b",
    "multi-selected",
    "multi-answered",
  ];
  if (process.env.RECORD_ANSWER_PANEL_BASELINE === "1") {
    fs.writeFileSync(
      "tests/answer-panel-baseline.json",
      JSON.stringify(
        Object.fromEntries(changed.map((name) => [name, hashes[name]])),
        null,
        2,
      ) + "\n",
    );
  }
  const updated = JSON.parse(
    fs.readFileSync("tests/answer-panel-baseline.json"),
  );
  assert.deepEqual(Object.keys(updated).sort(), [...changed].sort());
  assert.deepEqual(hashes, {
    ...JSON.parse(fs.readFileSync("tests/screen-baseline.json")),
    ...updated,
  });
});

test("each recall choice saves the matching rating and advances even after an incorrect answer", async () => {
  for (const [label, rating] of [
    ["思い出せない", "again"],
    ["迷った", "hard"],
    ["思い出せた", "good"],
    ["余裕で分かった", "easy"],
  ]) {
    const s = await setup();
    await s.click("復習モード");
    await s.click("復習を開始");
    assert.equal(
      s.renderer.root.findAllByProps({ "aria-label": "回答結果と次の操作" })
        .length,
      0,
    );
    await s.click("選択肢B");
    assert.match(s.text(), /不正解/);
    assert.match(s.text(), /正答：A/);
    assert.match(s.text(), /回答を保存して次へ/);
    const dock = s.renderer.root.findByProps({
      "aria-label": "回答結果と次の操作",
    });
    assert.equal(dock.props.style.flexShrink, 0);
    const scroll = s.renderer.root.findByProps({
      "aria-label": "問題と選択肢",
    });
    assert.equal(scroll.props.style.overflowY, "auto");
    assert.equal(
      scroll.findAllByProps({ "aria-label": "回答結果と次の操作" }).length,
      0,
    );
    await s.click(label);
    assert.equal(s.calls.filter(Array.isArray)[0][4], rating);
    assert.match(s.text(), /問題 q2/);
    await s.close();
  }
});

test("ending can be cancelled; opening and closing explanation never saves an answer", async () => {
  const s = await setup();
  await s.click("復習モード");
  await s.click("復習を開始");
  await s.click("選択肢A");
  await s.click("今日はここまで");
  assert.match(s.text(), /この回答を保存して終了/);
  await s.click("解説を見る");
  assert.equal(s.renderer.root.findAllByProps({ role: "dialog" }).length, 1);
  await s.click("×");
  assert.equal(s.calls.filter(Array.isArray).length, 0);
  await s.click("終了をやめて、続ける");
  await s.click("思い出せた");
  assert.match(s.text(), /問題 q2/);
  assert.equal(s.calls.filter(Array.isArray).length, 1);
  await s.close();
});
