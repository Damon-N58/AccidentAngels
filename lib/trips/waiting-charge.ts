export interface WaitingChargeResult {
  waitingSeconds: number
  billableMinutes: number
  chargeCents: number
}

/**
 * Compute waiting-time charge.
 * Grace = 3 min free. After grace, R5/min, billed per whole minute (ceiling).
 * Completed at exactly 3:00 → 0 charge. 3:01 → 1 min → R5. 4:01 → 2 min → R10.
 * Clock skew (completedAt < arrivedAt) → 0 charge, never throws.
 */
export function calcWaitingCharge(
  arrivedAt: Date,
  completedAt: Date,
  graceMinutes = 3,
  rateCentsPerMin = 500,
): WaitingChargeResult {
  const ms = completedAt.getTime() - arrivedAt.getTime()
  const waitingSeconds = Math.max(0, Math.floor(ms / 1000))
  const graceSeconds = graceMinutes * 60
  if (waitingSeconds <= graceSeconds) {
    return { waitingSeconds, billableMinutes: 0, chargeCents: 0 }
  }
  const billableMinutes = Math.ceil((waitingSeconds - graceSeconds) / 60)
  return { waitingSeconds, billableMinutes, chargeCents: billableMinutes * rateCentsPerMin }
}
