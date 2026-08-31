import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorDevice,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  checkAdminLoginLock,
  recordAdminLoginFailure,
  clearAdminLoginFailures,
} from "@/lib/rateLimitAdmin";
import { consumeChallenge } from "@/lib/webauthnChallengeStore";
import { rpID, origin } from "@/lib/webauthn";

const TIMING_SAFE_DUMMY_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$WQ2EDYfFrEzA0DHc4FObOA$0s7ndQJSON3P/yemLaiDaqCObNcUnsUDVvnjTmQbqvY";

class AccountLockedError extends CredentialsSignin {
  code = "account_locked";
}

function getClientIp(request: Request | undefined): string {
  const forwardedFor = request?.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

async function logAdminLoginAttempt(params: {
  eventType: "ADMIN_LOGIN_SUCCESS" | "ADMIN_LOGIN_FAILURE";
  adminId: number | null;
  email: string;
  ip: string;
  detail: string;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        eventType: params.eventType,
        adminId: params.adminId,
        ipAddress: params.ip,
        detail: params.detail,
      },
    });
  } catch (err) {
    console.error("Failed to write admin login audit log:", err);
  }
}

const SESSION_ABSOLUTE_MAX_AGE_SECONDS = 8 * 60 * 60;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const {
  handlers: adminHandlers,
  signIn: adminSignIn,
  signOut: adminSignOut,
  auth: adminAuth,
} = NextAuth({
  basePath: "/api/auth/admin",
  providers: [
    // ---------------------------------------------------------------
    // Password-only login. Deliberately restricted to accounts that
    // have NOT set up a passkey yet — this is the one-time onboarding
    // path for a brand-new account created by an admin. Once an
    // account has at least one passkey, this path refuses to log it
    // in even with a correct password, forcing the combined
    // "admin-2fa" provider below instead. This is what makes 2FA
    // actually mandatory rather than optional.
    // ---------------------------------------------------------------
    Credentials({
      id: "admin-credentials",
      name: "Admin Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const ip = getClientIp(request);
        const lock = await checkAdminLoginLock(ip);
        if (lock.locked) {
          throw new AccountLockedError();
        }

        const normalizedEmail = (credentials.email as string).trim().toLowerCase();
        const admin = await prisma.admin.findUnique({
          where: { email: normalizedEmail },
          include: { passkeys: true },
        });

        const isValid = await verifyPassword(
          admin?.passwordHash ?? TIMING_SAFE_DUMMY_HASH,
          credentials.password as string
        );

        if (!admin || !isValid) {
          await recordAdminLoginFailure(ip);
          await logAdminLoginAttempt({
            eventType: "ADMIN_LOGIN_FAILURE",
            adminId: admin?.id ?? null,
            email: normalizedEmail,
            ip,
            detail: admin ? "Password mismatch" : "No admin found for this email",
          });
          return null;
        }

        if (admin.passkeys.length > 0) {
          await recordAdminLoginFailure(ip);
          await logAdminLoginAttempt({
            eventType: "ADMIN_LOGIN_FAILURE",
            adminId: admin.id,
            email: normalizedEmail,
            ip,
            detail: "Password-only login rejected: account already has a passkey, 2FA required",
          });
          return null;
        }

        await clearAdminLoginFailures(ip);
        await logAdminLoginAttempt({
          eventType: "ADMIN_LOGIN_SUCCESS",
          adminId: admin.id,
          email: normalizedEmail,
          ip,
          detail: "Password-only login (onboarding — no passkey set up yet)",
        });

        return {
          id: admin.id.toString(),
          email: admin.email,
          name: `${admin.firstName} ${admin.lastName}`,
          role: admin.role,
        };
      },
    }),

    // ---------------------------------------------------------------
    // Mandatory 2FA: password AND passkey together, verified in the
    // same request. This is the only way in for any account that has
    // already completed passkey setup.
    // ---------------------------------------------------------------
    Credentials({
      id: "admin-2fa",
      name: "Admin 2FA",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        assertion: { label: "Assertion", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password || !credentials?.assertion) {
          return null;
        }

        const ip = getClientIp(request);
        const lock = await checkAdminLoginLock(ip);
        if (lock.locked) {
          throw new AccountLockedError();
        }

        const normalizedEmail = (credentials.email as string).trim().toLowerCase();
        const admin = await prisma.admin.findUnique({
          where: { email: normalizedEmail },
          include: { passkeys: true },
        });

        const isPasswordValid = await verifyPassword(
          admin?.passwordHash ?? TIMING_SAFE_DUMMY_HASH,
          credentials.password as string
        );

        const fail = async (detail: string) => {
          await recordAdminLoginFailure(ip);
          await logAdminLoginAttempt({
            eventType: "ADMIN_LOGIN_FAILURE",
            adminId: admin?.id ?? null,
            email: normalizedEmail,
            ip,
            detail,
          });
          return null;
        };

        if (!admin || !isPasswordValid) {
          return fail(admin ? "Password mismatch (2FA attempt)" : "No admin found (2FA attempt)");
        }

        if (admin.passkeys.length === 0) {
          return fail("2FA attempted but no passkey is registered for this account");
        }

        let assertionResponse: AuthenticationResponseJSON;
        try {
          assertionResponse = JSON.parse(credentials.assertion as string);
        } catch {
          return fail("Malformed passkey assertion");
        }

        const storedCredential = admin.passkeys.find(
          (p) => p.credentialId === assertionResponse.id
        );
        if (!storedCredential) {
          return fail("Passkey not recognized for this admin");
        }

        const expectedChallenge = await consumeChallenge("auth", normalizedEmail);
        if (!expectedChallenge) {
          return fail("Passkey challenge missing or expired");
        }

        const authenticator: AuthenticatorDevice = {
          credentialID: Buffer.from(storedCredential.credentialId, "base64url"),
          credentialPublicKey: Buffer.from(storedCredential.publicKey, "base64url"),
          counter: Number(storedCredential.counter),
          transports: storedCredential.transports
            ? (storedCredential.transports.split(",") as AuthenticatorTransportFuture[])
            : undefined,
        };

        let verification;
        try {
          verification = await verifyAuthenticationResponse({
            response: assertionResponse,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            authenticator,
            requireUserVerification: true,
          });
        } catch (err) {
          console.error("Passkey authentication verification error:", err);
          return fail("Passkey verification threw an error");
        }

        if (!verification.verified) {
          return fail("Passkey signature did not verify");
        }

        await prisma.adminPasskey.update({
          where: { id: storedCredential.id },
          data: {
            counter: BigInt(verification.authenticationInfo.newCounter),
            lastUsedAt: new Date(),
          },
        });

        await clearAdminLoginFailures(ip);
        await logAdminLoginAttempt({
          eventType: "ADMIN_LOGIN_SUCCESS",
          adminId: admin.id,
          email: normalizedEmail,
          ip,
          detail: `2FA login (password + passkey: ${storedCredential.deviceLabel})`,
        });

        return {
          id: admin.id.toString(),
          email: admin.email,
          name: `${admin.firstName} ${admin.lastName}`,
          role: admin.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_ABSOLUTE_MAX_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: "admin-session-token",
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      const now = Date.now();

      if (user) {
        token.adminId = user.id;
        token.role = (user as { role?: "ADMIN" | "EMPLOYEE" }).role;
        token.loginAt = now;
        token.lastActivity = now;
        return token;
      }

      const lastActivity = (token.lastActivity as number | undefined) ?? now;
      if (now - lastActivity > SESSION_IDLE_TIMEOUT_MS) {
        return null;
      }

      token.lastActivity = now;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.adminId = token.adminId as string | undefined;
        session.user.role = token.role as "ADMIN" | "EMPLOYEE" | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin/login",
  },
});