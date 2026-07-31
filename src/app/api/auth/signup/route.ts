import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      gender,
      dateBirth,
      password,
    } = body;

    // Basic validation
    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !gender ||
      !dateBirth ||
      !password
    ) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Check if email already exists (on Person, since Customer links to it)
    const existing = await prisma.person.findFirst({
      where: { email },
      include: { customer: true },
    });

    if (existing?.customer) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const customer = await prisma.customer.create({
      data: {
        passwordHash,
        person: {
          create: {
            firstName,
            lastName,
            email,
            phone,
            gender,
            dateBirth: new Date(dateBirth),
          },
        },
      },
      include: { person: true },
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.person.email,
        firstName: customer.person.firstName,
        lastName: customer.person.lastName,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}