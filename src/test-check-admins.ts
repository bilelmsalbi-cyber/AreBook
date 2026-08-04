import { prisma } from "./lib/prisma";

async function main() {
  const email = "Bilelmsalbi@gmail.com";

  console.log("Searching for exact email:", JSON.stringify(email));
  console.log("Email length:", email.length);

  const admin = await prisma.admin.findUnique({
    where: { email },
  });

  console.log("findUnique result:", admin);

  // Also check raw bytes of what's actually stored
  const raw = await prisma.$queryRaw`
    SELECT id, email, length(email) as email_length, encode(email::bytea, 'hex') as email_hex
    FROM admins
  `;
  console.log("Raw DB check:", raw);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());