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