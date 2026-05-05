import { supabase } from '@/lib/supabase'

/**
 * Verify the requesting user (from session) owns the child record.
 * Returns the child if authorized, throws/returns null if not.
 */
export async function verifyChildAccess(
  childId: string,
  session: { userId: string; role: string }
): Promise<{ id: string; parentId: string; driverId: string } | null> {
  if (session.role === 'ADMIN') {
    return supabase.from('Child').select('id, parentId, driverId').eq('id', childId).maybeSingle() as any
  }

  const { data: child } = await supabase
    .from('Child')
    .select('id, parentId, driverId')
    .eq('id', childId)
    .maybeSingle()

  if (!child) return null

  if (session.role === 'PARENT') {
    const { data: parent } = await supabase
      .from('Parent')
      .select('id')
      .eq('userId', session.userId)
      .maybeSingle()
    if (!parent || parent.id !== child.parentId) return null
  }

  if (session.role === 'DRIVER') {
    const { data: driver } = await supabase
      .from('Driver')
      .select('id')
      .eq('userId', session.userId)
      .maybeSingle()
    if (!driver || driver.id !== child.driverId) return null
  }

  return child
}
