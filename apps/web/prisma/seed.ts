import { PrismaClient } from "@prisma/client";
import { seedAjsLookups } from "../src/lib/ajs/seedAjsData";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    console.log("No user yet; skipping AJS lookups. Sign up in the app, then re-run the seed.");
    return;
  }

  await seedAjsLookups(user.id, prisma);
  console.log(`AJS lookups seeded for user ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
