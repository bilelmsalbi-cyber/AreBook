import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { adminAuth } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { rpID, origin } from "@/lib/webauthn";
import { consumeChallenge } from "@/lib/webauthnChallengeStore";

export async function POST(request: NextRequest) {
  const session = await adminAuth();
  if (!session?.user?.adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminId = parseInt(session.user.adminId, 10);

  const body = (await request.json()) as {
    response: RegistrationResponseJSON;
    deviceLabel?: string;
  };

  const expectedChallenge = await consumeChallenge("reg", String(adminId));
  if (!expectedChallenge) {
    return NextResponse.json(
      { error: "Registration expired, please try again." },
      { status: 400 }
    );
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (err) {
    console.error("Passkey registration verification failed:", err);
    return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

  await prisma.adminPasskey.create({
    data: {
      adminId,
      credentialId: Buffer.from(credentialID).toString("base64url"),
      publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
      counter: BigInt(counter),
      deviceLabel: body.deviceLabel?.trim() || "Unnamed device",
      transports: body.response.response.transports?.join(",") ?? null,
    },
  });

  return NextResponse.json({ success: true });
}