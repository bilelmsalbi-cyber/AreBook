import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const appUrl = getAppUrl();

  if (!token) {
    return NextResponse.redirect(`${appUrl}/login?verify=missing`);
  }

  const record = await prisma.customerVerificationToken.findUnique({
    where: { token },
  });

  if (!record) {
    return NextResponse.redirect(`${appUrl}/login?verify=invalid`);
  }

  if (record.expiresAt < new Date()) {
    await prisma.customerVerificationToken.delete({ where: { id: record.id } });
    return NextResponse.redirect(`${appUrl}/login?verify=expired`);
  }

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: record.customerId },
      data: { emailVerified: new Date() },
    }),
    prisma.customerVerificationToken.deleteMany({
      where: { customerId: record.customerId },
    }),
  ]);

  return NextResponse.redirect(`${appUrl}/login?verify=success`);
}