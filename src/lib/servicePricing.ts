// Goes in: D:\AreBook\src\lib\servicePricing.ts
//
// Single source of truth for service prices. The backend always
// recalculates prices from this file — it never trusts a "price" value
// sent by the client (that would allow price tampering).

export const BAG_PRICE = 50;
export const MAX_BAGS = 3;
export const MEAL_PRICE = 20;
export const PET_PRICE_PER_KG = 21;

export type RawService =
  | { type: "WHEELCHAIR" }
  | { type: "MEAL" }
  | { type: "BAGGAGE"; quantity: number }
  | { type: "PET"; petType: string; petWeight: number };

// Recomputes the correct price + label for a service, ignoring any price
// the client might have sent.
export function priceService(service: RawService): { label: string; price: number } {
  switch (service.type) {
    case "WHEELCHAIR":
      return { label: "Wheelchair Assistance", price: 0 };
    case "MEAL":
      return { label: "Special Meal (Gluten-Free)", price: MEAL_PRICE };
    case "BAGGAGE": {
      const qty = Math.min(MAX_BAGS, Math.max(0, service.quantity));
      return { label: `Extra Baggage x${qty}`, price: qty * BAG_PRICE };
    }
    case "PET": {
      const weight = Math.max(0, service.petWeight);
      return {
        label: `Pet Travel (${service.petType}, ${weight}kg)`,
        price: weight * PET_PRICE_PER_KG,
      };
    }
  }
}