// Activity types the dashboard can log — each maps to a HubSpot engagement object type.
// Kept free of server imports so client components can use it.
export const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
}

export function isActivityType(v: unknown): v is ActivityType {
  return typeof v === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(v)
}
