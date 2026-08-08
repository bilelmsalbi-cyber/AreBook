import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/auth-admin";
import { hashPassword, verifyPassword } from "@/lib/password";

const staffSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  gender: true,
  dateBirth: true,
  salary: true,
  role: true,
  createdBy: { select: { firstName: true, lastName: true } },
} as const;

// GET — list all staff, optionally filtered by name/email search term.
// Staff management is ADMIN-only (see role check below).
export async function GET(request: NextRequest) {
  const session = await adminAuth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  const staff = await prisma.admin.findMany({
    where: query
      ? {
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: staffSelect,
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ staff });
}

// POST — create a new staff account (ADMIN or EMPLOYEE).
// Requires the acting admin to re-enter their own password as a
// confirmation step, since account creation grants real system access.
export async function POST(request: NextRequest) {
  const session = await adminAuth();
  if (session?.user?.role !== "ADMIN" || !session.user.adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      gender,
      dateBirth,
      salary,
      role,
      password,
      currentAdminPassword,
    } = body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !gender ||
      !dateBirth ||
      !salary ||
      !role ||
      !password ||
      !currentAdminPassword
    ) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    if (role !== "ADMIN" && role !== "EMPLOYEE") {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    // Confirm the acting admin's identity before granting new access.
    const actingAdmin = await prisma.admin.findUnique({
      where: { id: Number(session.user.adminId) },
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

    const passwordHash = await hashPassword(password);

    const created = await prisma.admin.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone,
        gender,
        dateBirth: new Date(dateBirth),
        salary: Number(salary),
        role,
        passwordHash,
        createdById: actingAdmin.id,
      },
      select: staffSelect,
    });

    return NextResponse.json({ staff: created }, { status: 201 });
  } catch (error: unknown) {
    // Prisma unique constraint violation → duplicate email
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    console.error("Create staff error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}