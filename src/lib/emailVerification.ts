import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { buildVerifyEmail } from "@/lib/emails/verifyEmail";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function sendVerificationEmail(
  customerId: number,
  email: string,
  firstName: string
) {
  await prisma.customerVerificationToken.deleteMany({
    where: { customerId },
  });

  const token = crypto.randomBytes(32).toString("hex");

  await prisma.customerVerificationToken.create({
    data: {
      customerId,
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const verifyUrl = `${getAppUrl()}/api/auth/verify?token=${token}`;
  const { html, text } = buildVerifyEmail({ firstName, verifyUrl });

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: email,
      subject: "Confirm your AreBook account",
      html,
      text,
    });
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
  }
}