import { redirect } from 'next/navigation'

// Root URL hit directly (not via subdomain) → send to driver app
export default function RootPage() {
  redirect('/login')
}
