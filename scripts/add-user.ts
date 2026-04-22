import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const role = process.argv[4] ?? "user";

  if (!email || !password) {
    console.error("使い方: npx tsx scripts/add-user.ts <email> <password> [role]");
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await db.user.upsert({
    where: { email },
    create: { email, password: hashed, role },
    update: { password: hashed, role },
  });
  console.log(`✓ ユーザー作成完了: ${user.email} (${user.role})`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
