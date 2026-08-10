import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import { requireAdminRole } from "@/lib/rbac";

// GET maintenance history for a plane — read-only, available to both
// ADMIN and EMPLOYEE
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const planeId = Number(id);

  const maintenances = await prisma.planMaintenance.findMany({
    where: { planId: planeId },
    orderBy: { dateMaint: "desc" },
  });

  return NextResponse.json({ maintenances });
}

// CREATE a maintenance record — Admin only
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forbidden = requireAdminRole(session.user.role);
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const planeId = Number(id);
    const body = await request.json();
    const { dateMaint, description, notes } = body;

    if (!dateMaint || !description) {
      return NextResponse.json(
        { error: "Date and description are required." },
        { status: 400 }
      );
    }

    const maintenance = await prisma.planMaintenance.create({
      data: {
        planId: planeId,
        dateMaint: new Date(dateMaint),
        description,
        notes: notes || null,
      },
    });

    return NextResponse.json({ success: true, maintenance });
  } catch (error) {
    console.error("Create maintenance error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}