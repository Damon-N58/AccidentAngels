import { Card, CardContent } from '@/components/ui/card'

export default function AdminPaymentsPage() {
  // NOTE: Never render Transaction.grossAmountCents, driverNetCents, or Contract.monthlyAmountCents directly here.
  // Use maskAmountForAdmin() from lib/utils/payment-messages.ts — admin sees "Please pay your transport fees" only.
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-[#0F1923] mb-4">Payments</h1>
      <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
        <CardContent className="p-6 text-center text-[#5A6474]">
          Payments management coming soon.
        </CardContent>
      </Card>
    </div>
  )
}
