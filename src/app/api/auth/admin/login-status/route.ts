import { NextRequest, NextResponse } from "next/server";
import { checkAdminLoginLock } from "@/lib/rateLimitAdmin";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const lock = await checkAdminLoginLock(ip);
  if (lock.locked) {
    return NextResponse.json({ locked: true, retryAfterSeconds: lock.retryAfterSeconds });
  }
  return NextResponse.json({ locked: false });
}