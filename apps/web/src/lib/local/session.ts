import prisma from "@/lib/db";

export async function localSession() {
  const users = await prisma.user.findMany({
    where: process.env.JBCN_USER_ID ? { id: process.env.JBCN_USER_ID } : undefined,
    select: { id: true, name: true, email: true },
    take: 2,
  });
  if (users.length > 1) {
    throw new Error("存在多个账号，请在启动配置中设置 JBCN_USER_ID 以选择原有数据。");
  }
  const user = users[0];
  if (!user) throw new Error("未找到本地账号，请重新运行 JBCN 初始化。");
  return { user, expires: "9999-12-31T23:59:59.999Z" };
}
