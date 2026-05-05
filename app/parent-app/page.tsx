import { redirect } from 'next/navigation'

export default function ParentRootPage() {
  redirect('/parent-app/dashboard')
}
