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

// 本人によるパスワード変更はFirebase Auth clientSDKで直接実行可能なので不要