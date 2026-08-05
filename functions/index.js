const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

// adminによる他ユーザーのパスワード変更
exports.changeUserPassword = onCall(async (request) => {
  // 呼び出し元がログインしているか確認
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ログインが必要です");
  }

  // 呼び出し元がadminか確認
  const callerDoc = await admin.firestore()
    .collection("users")
    .doc(request.auth.uid)
    .get();

  if (!callerDoc.exists || callerDoc.data().role !== "admin") {
    throw new HttpsError("permission-denied", "管理者権限が必要です");
  }

  const { targetUid, newPassword } = request.data;

  if (!targetUid || !newPassword || newPassword.length < 6) {
    throw new HttpsError("invalid-argument", "パスワードは6文字以上必要です");
  }

  await admin.auth().updateUser(targetUid, { password: newPassword });

  return { success: true };
});

// adminによるユーザー追加
//
// ⚠️ **アカウントの作成をここに集めるのが目的。**
//    それまでは管理画面がブラウザから `createUserWithEmailAndPassword` を
//    呼んでいた。その方式ではサインアップを開けておくしかなく、
//    **誰でもアカウントを作って問題集を全部読める**状態になっていた
//    （2026-08-06 に他アプリで実際に作れることを確認）。
//    作成を Functions へ移せばサインアップ自体を閉じられる。
exports.adminCreateUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ログインが必要です");
  }
  const callerDoc = await admin.firestore()
    .collection("users").doc(request.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== "admin") {
    throw new HttpsError("permission-denied", "管理者権限が必要です");
  }

  const { username, password, role } = request.data;
  if (!username || !/^[A-Za-z0-9_.-]{2,32}$/.test(username)) {
    throw new HttpsError("invalid-argument",
      "ユーザー名は英数字・._- の2〜32文字で指定してください");
  }
  if (!password || password.length < 6) {
    throw new HttpsError("invalid-argument", "パスワードは6文字以上必要です");
  }

  const email = `${username.toLowerCase()}@periop-quiz.app`;
  try {
    const user = await admin.auth().createUser({ email, password });
    await admin.firestore().collection("users").doc(user.uid).set({
      username, email,
      role: role === "admin" ? "admin" : "user",
      createdAt: new Date(),
    });
    return { success: true, uid: user.uid };
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "そのユーザー名は既に使われています");
    }
    throw e;
  }
});

// 本人によるパスワード変更はFirebase Auth clientSDKで直接実行可能なので不要