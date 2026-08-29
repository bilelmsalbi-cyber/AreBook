import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/emailVerification";
import { isRateLimited } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    if (isRateLimited(`signup:${ip}`)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, email, phone, gender, dateBirth, password } = body;

    if (!firstName || !lastName || !email || !phone || !gender || !dateBirth || !password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const normalizedEmail = (email as string).trim().toLowerCase();

    const existing = await prisma.person.findFirst({
      where: { email: normalizedEmail },
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
            email: normalizedEmail,
            phone,
            gender,
            dateBirth: new Date(dateBirth),
          },
        },
      },
      include: { person: true },
    });

    await sendVerificationEmail(customer.id, customer.person.email, customer.person.firstName);

    return NextResponse.json({
      success: true,
      message: "Account created. Please check your email to confirm your address before logging in.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}