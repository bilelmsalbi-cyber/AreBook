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

// The single configured cap on how large a refund (finalRefundAmount) an
// EMPLOYEE may issue when cancelling a booking from the admin dashboard.
// null means it has never been set — in that state, employees cannot
// cancel any booking at all (safe-by-default; see
// checkEmployeeCancellationLimit in lib/cancellation.ts). ADMIN is never
// capped by this value.
export type EmployeeCancellationLimitItem = {
  id: number;
  maxRefundAmount: number;
  updatedAt: string;
} | null;

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