import { redirect } from 'next/navigation'

// Parents now choose their own driver — drivers no longer add children.
export default function DriverAddChildRedirect() {
  redirect('/driver-app/children')
}
