import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import React from 'react'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
    color: '#0F1923',
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#1A3F7A',
    paddingBottom: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1A3F7A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#5A6474',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1A3F7A',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF2',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 160,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#5A6474',
  },
  value: {
    flex: 1,
    fontSize: 10,
  },
  clause: {
    marginBottom: 8,
    lineHeight: 1.5,
  },
  clauseNum: {
    fontFamily: 'Helvetica-Bold',
    marginRight: 4,
  },
  signatureBlock: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5EAF2',
    paddingTop: 16,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  signatureBox: {
    width: '45%',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#0F1923',
    marginBottom: 4,
    height: 40,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#5A6474',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopColor: '#E5EAF2',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#5A6474',
  },
  badge: {
    backgroundColor: '#E8F5F0',
    borderWidth: 1,
    borderColor: '#0F6E56',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 9,
    color: '#0F6E56',
    fontFamily: 'Helvetica-Bold',
  },
})

export interface ContractData {
  contractId: string
  contractVersion: string
  driverName: string
  driverPhone: string
  vehicleRegistration: string
  vehicleMake: string
  vehicleModel: string
  vehicleColour: string
  getsNumber?: string
  parentName: string
  parentPhone: string
  childName: string
  schoolName: string
  pickupAddress: string
  dropoffAddress: string
  monthlyAmountCents: number
  startDate: Date
  driverSignedAt?: Date
  parentSignedAt?: Date
  generatedAt: Date
}

function formatZAR(cents: number): string {
  return `R ${(cents / 100).toFixed(2)}`
}

function fmt(date: Date): string {
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ContractDocument({ data }: { data: ContractData }) {
  const isSigned = !!(data.driverSignedAt && data.parentSignedAt)

  return React.createElement(
    Document,
    { title: `Transport Agreement — ${data.childName}` },
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.title }, 'Scholar Transport Agreement'),
        React.createElement(Text, { style: styles.subtitle },
          `Accident Angels · Contract ${data.contractId.slice(-8).toUpperCase()} · v${data.contractVersion}`
        ),
        isSigned && React.createElement(View, { style: styles.badge },
          React.createElement(Text, { style: styles.badgeText }, '✓ FULLY EXECUTED')
        )
      ),
      // Parties
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, '1. Parties'),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Driver (Service Provider):'),
          React.createElement(Text, { style: styles.value }, data.driverName)
        ),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Driver Phone:'),
          React.createElement(Text, { style: styles.value }, data.driverPhone)
        ),
        data.getsNumber && React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'GETS Registration:'),
          React.createElement(Text, { style: styles.value }, data.getsNumber)
        ),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Parent / Guardian:'),
          React.createElement(Text, { style: styles.value }, data.parentName)
        ),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Parent Phone:'),
          React.createElement(Text, { style: styles.value }, data.parentPhone)
        ),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Learner:'),
          React.createElement(Text, { style: styles.value }, data.childName)
        ),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'School:'),
          React.createElement(Text, { style: styles.value }, data.schoolName)
        ),
      ),
      // Vehicle
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, '2. Vehicle'),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Registration:'),
          React.createElement(Text, { style: styles.value }, data.vehicleRegistration)
        ),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Vehicle:'),
          React.createElement(Text, { style: styles.value },
            `${data.vehicleMake} ${data.vehicleModel} (${data.vehicleColour})`
          )
        ),
      ),
      // Transport details
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, '3. Transport Details'),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Pickup Address:'),
          React.createElement(Text, { style: styles.value }, data.pickupAddress)
        ),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Dropoff Address:'),
          React.createElement(Text, { style: styles.value }, data.dropoffAddress)
        ),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Start Date:'),
          React.createElement(Text, { style: styles.value }, fmt(data.startDate))
        ),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Monthly Fee:'),
          React.createElement(Text, { style: styles.value }, formatZAR(data.monthlyAmountCents))
        ),
      ),
      // Terms
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, '4. Terms and Conditions'),
        ...[
          ['4.1', 'The Service Provider agrees to transport the Learner safely between the Pickup and Dropoff addresses on all school days, arriving on time.'],
          ['4.2', 'The Parent agrees to pay the Monthly Fee by the 1st of each month. Failure to pay within 7 days may result in suspension of the service.'],
          ['4.3', 'The Service Provider holds a valid Professional Driving Permit (PDP) for passengers, police clearance, and passenger liability insurance.'],
          ['4.4', 'The Service Provider will not carry more passengers than the vehicle\'s licensed capacity.'],
          ['4.5', 'Either party may terminate this agreement with 30 days written notice.'],
          ['4.6', 'This agreement is governed by South African law and complies with the Gauteng Department of Education scholar transport regulations.'],
          ['4.7', 'This agreement constitutes an electronic signature in terms of the Electronic Communications and Transactions Act 25 of 2002 (ECTA).'],
        ].map(([num, text]) =>
          React.createElement(View, { key: num, style: styles.clause },
            React.createElement(Text, null,
              React.createElement(Text, { style: styles.clauseNum }, `${num} `),
              text
            )
          )
        )
      ),
      // Signatures
      React.createElement(View, { style: styles.signatureBlock },
        React.createElement(Text, { style: styles.sectionTitle }, '5. Signatures'),
        React.createElement(Text, { style: { fontSize: 9, color: '#5A6474', marginBottom: 12 } },
          'By signing (via OTP verification), both parties agree to be bound by this agreement in terms of ECTA.'
        ),
        React.createElement(View, { style: styles.signatureRow },
          React.createElement(View, { style: styles.signatureBox },
            React.createElement(View, { style: styles.signatureLine }),
            React.createElement(Text, { style: styles.signatureLabel },
              `Driver: ${data.driverName}`
            ),
            React.createElement(Text, { style: styles.signatureLabel },
              data.driverSignedAt
                ? `Signed: ${fmt(data.driverSignedAt)}`
                : 'Not yet signed'
            ),
          ),
          React.createElement(View, { style: styles.signatureBox },
            React.createElement(View, { style: styles.signatureLine }),
            React.createElement(Text, { style: styles.signatureLabel },
              `Parent: ${data.parentName}`
            ),
            React.createElement(Text, { style: styles.signatureLabel },
              data.parentSignedAt
                ? `Signed: ${fmt(data.parentSignedAt)}`
                : 'Not yet signed'
            ),
          )
        )
      ),
      // Footer
      React.createElement(View, { style: styles.footer, fixed: true },
        React.createElement(Text, { style: styles.footerText },
          `Accident Angels · ${data.contractId.slice(-8).toUpperCase()}`
        ),
        React.createElement(Text, { style: styles.footerText },
          `Generated: ${fmt(data.generatedAt)}`
        ),
        React.createElement(
          Text,
          {
            style: styles.footerText,
            render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Page ${pageNumber} of ${totalPages}`,
          }
        )
      )
    )
  )
}

export async function generateContractPdf(data: ContractData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ContractDocument, { data }) as any
  return renderToBuffer(element)
}
