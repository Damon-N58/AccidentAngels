export const ADMIN_PAYMENT_MESSAGE = "Please pay your transport fees";

export function maskAmountForAdmin(
  amountCents: number | null | undefined,
  viewerRole: string
): number | null {
  if (viewerRole === "ADMIN") return null;
  return amountCents ?? null;
}
