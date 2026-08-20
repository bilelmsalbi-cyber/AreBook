import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import { requireAdminRole } from "@/lib/rbac";
import {
  validateNonNegativeNumber,
  validateOptionalPositiveInt,
  ValidationError,
} from "@/lib/pricing/validation";

// PATCH — update a service's price and/or max quantity.
// This is the real security boundary (defense in depth): the UI hides the
// edit control for Employees, but this check is what actually enforces it.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireAdminRole(session.user.role);
  if (forbidden) return forbidden;

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "Invalid service ID." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data: { price?: number; maxQuantity?: number | null } = {};

    if (body.price !== undefined) {
      data.price = validateNonNegativeNumber(body.price, "Price");
    }
    if (body.maxQuantity !== undefined) {
      data.maxQuantity = validateOptionalPositiveInt(body.maxQuantity, "Max quantity");
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes provided." }, { status: 400 });
    }

    const updated = await prisma.servicePrice.update({
      where: { id: targetId },
      data,
    });

    return NextResponse.json({ service: updated });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }
    console.error("Update service price error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}