import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import { verifyPassword } from "@/lib/password";

// DELETE — remove a staff account. Protected by three independent
// safety checks (see comments below), plus a password re-entry step.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminAuth();
  if (session?.user?.role !== "ADMIN" || !session.user.adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const targetId = Number(id);

  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "Invalid account ID." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { currentAdminPassword } = body;

    if (!currentAdminPassword) {
      return NextResponse.json(
        { error: "Password confirmation is required." },
        { status: 400 }
      );
    }

    const actingAdminId = Number(session.user.adminId);

    // Safety check #1: an admin can never delete their own account.
    if (targetId === actingAdminId) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    const actingAdmin = await prisma.admin.findUnique({
      where: { id: actingAdminId },
    });

    if (!actingAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const passwordConfirmed = await verifyPassword(
      actingAdmin.passwordHash,
      currentAdminPassword
    );

    if (!passwordConfirmed) {
      return NextResponse.json(
        { error: "Your password is incorrect." },
        { status: 401 }
      );
    }

    const target = await prisma.admin.findUnique({ where: { id: targetId } });

    if (!target) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    // Safety check #2: never allow the last remaining ADMIN to be deleted.
    // Independent from check #1 on purpose — see the accompanying report
    // for why both are kept (defense in depth, not redundancy).
    if (target.role === "ADMIN") {
      const adminCount = await prisma.admin.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the last remaining admin account." },
          { status: 409 }
        );
      }
    }

    await prisma.admin.delete({ where: { id: targetId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete staff error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}