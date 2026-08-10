import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import { requireAdminRole } from "@/lib/rbac";

// DELETE a plane — Admin only
export async function DELETE(
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

    const linkedTripsCount = await prisma.trip.count({
      where: { planId: planeId },
    });

    if (linkedTripsCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete this plane: ${linkedTripsCount} trip(s) are linked to it. Delete those trips first, or retire the plane instead.`,
        },
        { status: 409 }
      );
    }

    const linkedMaintenanceCount = await prisma.planMaintenance.count({
      where: { planId: planeId },
    });

    if (linkedMaintenanceCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete this plane: ${linkedMaintenanceCount} maintenance record(s) are linked to it. Retire the plane instead.`,
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

// Toggles a plane's service status — Admin only.
// action "retire": takes the plane out of service. Blocked if the plane
// still has future trips scheduled (a plane cannot be retired while it's
// committed to upcoming flights).
// action "activate": returns a retired plane to service. Always allowed.
export async function PATCH(
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
    const { action } = await request.json();

    if (action !== "retire" && action !== "activate") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const plane = await prisma.plane.findUnique({ where: { id: planeId } });
    if (!plane) {
      return NextResponse.json({ error: "Plane not found." }, { status: 404 });
    }

    if (action === "retire") {
      const futureTripsCount = await prisma.trip.count({
        where: { planId: planeId, departureDateTime: { gt: new Date() } },
      });

      if (futureTripsCount > 0) {
        return NextResponse.json(
          {
            error: `Cannot retire this plane: ${futureTripsCount} future trip(s) are scheduled with it. Reassign or delete those trips first.`,
          },
          { status: 409 }
        );
      }

      const updated = await prisma.plane.update({
        where: { id: planeId },
        data: { serviceEndDate: new Date() },
      });

      return NextResponse.json({ success: true, plane: updated });
    }

    // action === "activate"
    const updated = await prisma.plane.update({
      where: { id: planeId },
      data: { serviceEndDate: null },
    });

    return NextResponse.json({ success: true, plane: updated });
  } catch (error) {
    console.error("Update plane service status error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}