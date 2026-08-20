import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";

// GET — list all service prices. Readable by ADMIN and EMPLOYEE alike;
// the ADMIN-only boundary lives on the PATCH route below, not here.
export async function GET() {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const services = await prisma.servicePrice.findMany({
    orderBy: { serviceType: "asc" },
  });

  return NextResponse.json({ services });
}