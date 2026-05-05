const store = new Map<string, number[]>()

// Prune stale entries every 5 minutes
let lastPrune = Date.now()
function maybePrune() {
  if (Date.now() - lastPrune < 300_000) return
  lastPrune = Date.now()
  const cutoff = Date.now() - 60_000
  for (const [key, timestamps] of store) {
    const fresh = timestamps.filter(t => t > cutoff)
    if (fresh.length === 0) store.delete(key)
    else store.set(key, fresh)
  }
}

export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  maybePrune()
  const now = Date.now()
  const window = now - windowMs
  const timestamps = store.get(key) ?? []
  const withinWindow = timestamps.filter(t => t > window)
  if (withinWindow.length >= maxAttempts) return false
  withinWindow.push(now)
  store.set(key, withinWindow)
  return true
}
