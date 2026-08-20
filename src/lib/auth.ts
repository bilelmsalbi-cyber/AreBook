import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

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

        const customer = await prisma.customer.findFirst({
          where: {
            person: {
              email: credentials.email as string,
            },
          },
          include: {
            person: true,
          },
        });

        if (!customer) {
          return null;
        }

        const isValid = await verifyPassword(
          customer.passwordHash,
          credentials.password as string
        );

        if (!isValid) {
          return null;
        }

        // This object becomes the JWT payload (see callbacks below)
        return {
          id: customer.id.toString(),
          email: customer.person.email,
          name: `${customer.person.firstName} ${customer.person.lastName}`,
        };
      },
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
    async jwt({ token, user }) {
      if (user) {
        token.customerId = user.id;
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