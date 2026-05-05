import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const session = await getSession(request.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: associations } = await supabase
    .from('Association')
    .select('id, name, region, code')
    .eq('isActive', true)
    .order('name', { ascending: true })

  return NextResponse.json(associations ?? [])
}
