import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";
import { rpID } from "@/lib/webauthn";
import { saveChallenge } from "@/lib/webauthnChallengeStore";
import { checkAdminLoginLock } from "@/lib/rateLimitAdmin";

export async function POST(request: NextRequest) {
  const { email } = (await request.json()) as { email?: string };
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required." }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const lock = await checkAdminLoginLock(ip);
  if (lock.locked) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 }
    );
  }

  const admin = await prisma.admin.findUnique({
    where: { email: normalizedEmail },
    include: { passkeys: true },
  });

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: admin?.passkeys.map((p) => ({
      id: Buffer.from(p.credentialId, "base64url"),
      type: "public-key" as const,
      transports: p.transports
        ? (p.transports.split(",") as AuthenticatorTransportFuture[])
        : undefined,
    })),
  });

  await saveChallenge("auth", normalizedEmail, options.challenge);

  return NextResponse.json(options);
}