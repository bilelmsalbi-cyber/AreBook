import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const normalizedEmail = (credentials.email as string).trim().toLowerCase();

        const customer = await prisma.customer.findFirst({
          where: { person: { email: normalizedEmail } },
          include: { person: true },
        });

        if (!customer || !customer.passwordHash) {
          return null;
        }

        const isValid = await verifyPassword(
          customer.passwordHash,
          credentials.password as string
        );

        if (!isValid) {
          return null;
        }

        if (!customer.emailVerified) {
          throw new EmailNotVerifiedError();
        }

        return {
          id: customer.id.toString(),
          email: customer.person.email,
          name: `${customer.person.firstName} ${customer.person.lastName}`,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: "customer-session-token",
    },
  },
  callbacks: {
        async signIn({ user, account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

            if (account.provider === "google" && profile?.email_verified === false) {
        return false;
      }

      const email = user.email?.trim().toLowerCase();
      if (!email) return false;

      const googleId = account.providerAccountId;

      const cookieStore = await cookies();
      const intent = cookieStore.get("oauth_intent")?.value;
      cookieStore.delete("oauth_intent");

      const existingCustomer = await prisma.customer.findFirst({
        where: {
          OR: [{ googleId }, { person: { email } }],
        },
        include: { person: true },
      });

      if (intent === "login" && !existingCustomer) {
        cookieStore.set("oauth_error", "no_account", { maxAge: 30, path: "/" });
        return false;
      }

      if (intent === "signup" && existingCustomer) {
        cookieStore.set("oauth_error", "account_exists", { maxAge: 30, path: "/" });
        return false;
      }

      let customerId: number;

      if (existingCustomer) {
        customerId = existingCustomer.id;

                const updates: { emailVerified?: Date; googleId?: string; passwordHash?: null } = {};
        if (!existingCustomer.emailVerified) {
          updates.emailVerified = new Date();
          if (existingCustomer.passwordHash) {
            updates.passwordHash = null;
          }
        }
        if (!existingCustomer.googleId) {
          updates.googleId = googleId;
        }
        if (Object.keys(updates).length > 0) {
          await prisma.customer.update({ where: { id: customerId }, data: updates });
        }
      } else {
        try {
          const [firstName, ...rest] = (user.name || "Google User").split(" ");
          const created = await prisma.customer.create({
            data: {
              emailVerified: new Date(),
              googleId,
              person: {
                create: {
                  firstName: firstName || "Google",
                  lastName: rest.join(" ") || "User",
                  email,
                  phone: "",
                  gender: "",
                  dateBirth: new Date("2000-01-01"),
                },
              },
            },
          });
          customerId = created.id;
        } catch {
          const fallback = await prisma.customer.findFirst({
            where: {
              OR: [{ googleId }, { person: { email } }],
            },
          });
          if (!fallback) return false;
          customerId = fallback.id;
        }
      }

      (user as { customerId?: string }).customerId = customerId.toString();
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.customerId = (user as { customerId?: string }).customerId ?? user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.customerId = token.customerId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});