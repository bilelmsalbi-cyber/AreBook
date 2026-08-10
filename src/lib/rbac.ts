import { NextResponse } from "next/server";

// Blocks a request unless the caller's Admin role is "ADMIN".
// Employees currently have read-only access across every admin section —
// this guard goes at the top of any mutation-only route (POST/PUT/PATCH/DELETE)
// right after the adminAuth() session check.
// Returns a 403 response to short-circuit the route, or null if the caller
// is allowed to proceed.
export function requireAdminRole(role: string | undefined) {
  if (role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: this action requires Admin privileges." },
      { status: 403 }
    );
  }
  return null;
}