export class ValidationError extends Error {}

export function validateNonNegativeNumber(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new ValidationError(`${fieldName} must be a number.`);
  }
  if (num < 0) {
    throw new ValidationError(`${fieldName} cannot be negative.`);
  }
  return num;
}

export function validatePercent(value: unknown, fieldName: string): number {
  const num = validateNonNegativeNumber(value, fieldName);
  if (num > 100) {
    throw new ValidationError(`${fieldName} cannot exceed 100%.`);
  }
  return num;
}

export function validateOptionalNonNegative(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  return validateNonNegativeNumber(value, fieldName);
}

export function validateOptionalPositiveInt(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError(`${fieldName} must be a positive whole number.`);
  }
  return num;
}

// Ensures a single tier's own range is coherent: max (if set) must exceed min.
export function validateTierRange(
  min: number,
  max: number | null,
  minFieldName: string,
  maxFieldName: string
) {
  if (max !== null && max <= min) {
    throw new ValidationError(`${maxFieldName} must be greater than ${minFieldName}.`);
  }
}

// Validates a full ordered set of tiers as ONE unit: must start at 0, end
// with exactly one open-ended (max === null) tier, and have zero gap /
// zero overlap between consecutive tiers — current.max must equal
// next.min exactly. Called after every mutation (create/update/delete) on
// a tier list, using the FULL resulting set (not just the row being
// changed), because gaps/overlaps are a property of the whole set.
export function validateTierSetIntegrity(tiers: { min: number; max: number | null }[]) {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);

  if (sorted.length === 0) {
    throw new ValidationError("At least one tier is required.");
  }

  if (sorted[0].min !== 0) {
    throw new ValidationError("The lowest tier must start at 0.");
  }

  const openEnded = sorted.filter((t) => t.max === null);
  if (openEnded.length !== 1) {
    throw new ValidationError(
      "Exactly one tier must be open-ended (no maximum) to cover all values above the highest tier."
    );
  }
  if (sorted[sorted.length - 1].max !== null) {
    throw new ValidationError("The open-ended tier must be the last (highest) one.");
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.max !== next.min) {
      throw new ValidationError(
        current.max! < next.min
          ? `Gap between ${current.max} and ${next.min} — no tier covers this range.`
          : `Overlap between tier ending at ${current.max} and tier starting at ${next.min}.`
      );
    }
  }
}