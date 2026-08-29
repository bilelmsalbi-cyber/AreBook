import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/emailVerification";
import { isRateLimited } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    if (isRateLimited(`resend-verification:${ip}`)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429 }
      );
    }

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const normalizedEmail = (email as string).trim().toLowerCase();

    const person = await prisma.person.findFirst({
      where: { email: normalizedEmail },
      include: { customer: true },
    });

    const genericResponse = NextResponse.json({
      success: true,
      message:
        "If an account exists for this email and isn't verified yet, a new confirmation link has been sent.",
    });

    if (!person?.customer || person.customer.emailVerified) {
      return genericResponse;
    }

    await sendVerificationEmail(
      person.customer.id,
      person.email,
      person.firstName
    );

    return genericResponse;
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}