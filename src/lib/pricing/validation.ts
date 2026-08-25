// Shared validation helpers for pricing config forms. Applied server-side
// on every mutation — the UI's own input constraints (min="0", etc.) are
// a convenience layer only, not a security boundary (defense in depth).

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

// Validates a full ordered set of tiers as ONE unit: must start at 0, end
// with exactly one open-ended (max === null) tier, and have zero gap /
// zero overlap between consecutive tiers — current.max must equal
// next.min exactly. Called once on the FULL proposed set at save time
// (bulk replace), not after each individual add/edit/remove — the set is
// only meaningful as a whole, so intermediate states while the admin is
// still editing are allowed to be temporarily invalid.
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