import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      customerId?: string;
      adminId?: string;
      role?: "ADMIN" | "EMPLOYEE";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    customerId?: string;
    adminId?: string;
    role?: "ADMIN" | "EMPLOYEE";
  }
}