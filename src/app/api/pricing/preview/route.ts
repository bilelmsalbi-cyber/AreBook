// Goes in: D:\AreBook\src\app\api\pricing\preview\route.ts

import { NextRequest, NextResponse } from "next/server";
import { calculateRoundTripPrice } from "@/lib/pricing/engine";

export async function POST(request: NextRequest) {
  try {
    const { outboundFare, returnFare } = await request.json();

    if (
      typeof outboundFare !== "number" || outboundFare < 0 ||
      typeof returnFare !== "number" || returnFare < 0
    ) {
      return NextResponse.json({ error: "Invalid fare values" }, { status: 400 });
    }

    const discounted = await calculateRoundTripPrice(outboundFare, returnFare);
    const original = outboundFare + returnFare;

    return NextResponse.json({
      original,
      discounted,
      savings: original - discounted,
    });
  } catch (error) {
    console.error("Error computing pricing preview:", error);
    return NextResponse.json({ error: "Could not compute price" }, { status: 500 });
  }
}