import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const planeId = Number(id);

    // Referential safety: block deletion if trips use this plane
    const linkedTripsCount = await prisma.trip.count({
      where: { planId: planeId },
    });

    if (linkedTripsCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete this plane: ${linkedTripsCount} trip(s) are linked to it. Delete those trips first.`,
        },
        { status: 409 }
      );
    }

    await prisma.plane.delete({ where: { id: planeId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete plane error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}