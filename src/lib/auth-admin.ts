import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const {
  handlers: adminHandlers,
  signIn: adminSignIn,
  signOut: adminSignOut,
  auth: adminAuth,
} = NextAuth({
  basePath: "/api/auth/admin",
  providers: [
    Credentials({
      name: "admin-credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const admin = await prisma.admin.findUnique({
          where: { email: credentials.email as string },
        });

        if (!admin) {
          return null;
        }

        const isValid = await verifyPassword(
          admin.passwordHash,
          credentials.password as string
        );

        if (!isValid) {
          return null;
        }

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
  },
  cookies: {
    sessionToken: {
      name: "admin-session-token",
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.adminId = user.id;
        token.role = (user as { role?: "ADMIN" | "EMPLOYEE" }).role;
      }
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