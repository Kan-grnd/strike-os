import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../src/lib/demo-seed";

const prisma = new PrismaClient();

async function main() {
  const counts = await seedDemo(prisma);
  console.log("✅ Seed complete!");
  console.log(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });