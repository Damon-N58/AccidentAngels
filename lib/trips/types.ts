export interface ChildWithSchedule {
  childId: string
  childName: string
  schoolName: string
  driverId: string
  parentId: string
  pickupAddress: string
  pickupLat: number | null
  pickupLng: number | null
  dropoffAddress: string
  dropoffLat: number | null
  dropoffLng: number | null
  morningPickupEarliest?: string | null
  morningPickupLatest?: string | null
  morningDropoffEarliest?: string | null
  morningDropoffLatest?: string | null
  afternoonPickupEarliest?: string | null
  afternoonPickupLatest?: string | null
  afternoonDropoffEarliest?: string | null
  afternoonDropoffLatest?: string | null
  notes?: string
}

export interface StopToOptimize {
  childId: string
  childName: string
  type: 'PICKUP' | 'DROPOFF'
  address: string
  lat: number
  lng: number
  windowEarliest?: number
  windowLatest?: number
  notes?: string
}

export interface OptimizedStop {
  childId: string
  childName: string
  type: 'PICKUP' | 'DROPOFF'
  address: string
  lat: number
  lng: number
  stopOrder: number
  estimatedArrivalMinutes: number
  distanceFromPrevMeters: number
  notes?: string
}

export interface OptimizationResult {
  stops: OptimizedStop[]
  totalDistanceMeters: number
  totalDurationSeconds: number
}

export interface TripData {
  id: string
  driverId: string
  date: string
  type: 'MORNING' | 'AFTERNOON'
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  totalDistanceMeters: number | null
  totalDurationSeconds: number | null
  driverStartedAt: string | null
  driverEndedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  stops: TripStopData[]
}

export interface TripStopData {
  id: string
  tripId: string
  childId: string
  type: 'PICKUP' | 'DROPOFF'
  stopOrder: number
  address: string
  lat: number | null
  lng: number | null
  scheduledTime: string | null
  estimatedTime: string | null
  actualTime: string | null
  status: 'PENDING' | 'COMPLETED' | 'MISSED'
  notes: string | null
  missedReason: string | null
  completedAt: string | null
  child?: { name: string; schoolName: string }
}

export interface ChildScheduleData {
  id: string
  childId: string
  daysOfWeek: number[]
  startDate: string
  endDate: string | null
  morningPickupEarliest: string | null
  morningPickupLatest: string | null
  morningDropoffEarliest: string | null
  morningDropoffLatest: string | null
  afternoonPickupEarliest: string | null
  afternoonPickupLatest: string | null
  afternoonDropoffEarliest: string | null
  afternoonDropoffLatest: string | null
  isActive: boolean
}

export interface ScheduleOverrideData {
  id: string
  childId: string
  date: string
  action: 'SKIP' | 'ADD'
  reason: string | null
  overrideTime: string | null
}

export const TRIP_START_HOURS = {
  MORNING: '06:00',
  AFTERNOON: '13:00',
} as const

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
