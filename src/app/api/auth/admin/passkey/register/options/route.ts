import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { adminAuth } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { rpName, rpID } from "@/lib/webauthn";
import { saveChallenge } from "@/lib/webauthnChallengeStore";

export async function POST() {
  const session = await adminAuth();
  if (!session?.user?.adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminId = parseInt(session.user.adminId, 10);
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { passkeys: true },
  });
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: String(admin.id),
    userName: admin.email,
    userDisplayName: `${admin.firstName} ${admin.lastName}`,
    attestationType: "none",
    excludeCredentials: admin.passkeys.map((p) => ({
      id: Buffer.from(p.credentialId, "base64url"),
      type: "public-key" as const,
      transports: p.transports
        ? (p.transports.split(",") as AuthenticatorTransportFuture[])
        : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  await saveChallenge("reg", String(adminId), options.challenge);

  return NextResponse.json(options);
}