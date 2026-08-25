export type ServicePriceItem = {
  id: number;
  serviceType: string;
  label: string;
  price: number;
  maxQuantity: number | null;
  updatedAt: string;
};

export type DiscountTierItem = {
  id: number;
  minTotal: number;
  maxTotal: number | null;
  discountPercent: number;
  updatedAt: string;
};

export type CancellationTierItem = {
  id: number;
  minHoursBefore: number;
  maxHoursBefore: number | null;
  businessDeductionPercent: number;
  guestDeductionPercent: number;
  updatedAt: string;
};

// Draft row shapes used while the admin is editing a tier set locally,
// before saving. `key` is a client-only stable identifier (existing DB id
// as a string, or a generated one for newly added rows) used for React
// keys and row removal — it is never sent to the server.
export type DiscountTierDraft = {
  key: string;
  minTotal: string;
  maxTotal: string;
  discountPercent: string;
};

export type CancellationTierDraft = {
  key: string;
  minHoursBefore: string;
  maxHoursBefore: string;
  businessDeductionPercent: string;
  guestDeductionPercent: string;
};