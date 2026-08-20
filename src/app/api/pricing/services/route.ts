import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const prices = await prisma.servicePrice.findMany();

    // Reshape into a lookup keyed by serviceType, so the client can read
    // e.g. servicePrices.BAGGAGE.price directly without searching an array.
    const byType = Object.fromEntries(
      prices.map((p) => [
        p.serviceType,
        { label: p.label, price: p.price, maxQuantity: p.maxQuantity },
      ])
    );

    return NextResponse.json(byType);
  } catch (error) {
    console.error("Error fetching service prices:", error);
    return NextResponse.json({ error: "Could not fetch service prices" }, { status: 500 });
  }
}