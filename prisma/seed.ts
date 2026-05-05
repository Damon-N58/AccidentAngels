import { supabase } from '../lib/supabase'

async function main() {
  // ── Platform config ────────────────────────────────────────
  const configs = [
    { key: 'PAYMENTS_LIVE',         value: 'false', description: 'Master switch — set to true to begin charging parents' },
    { key: 'PLATFORM_FEE_CENTS',    value: '0',     description: 'Nineteen58 platform fee per transaction in cents (TBD)' },
    { key: 'TCC_SPLIT_CENTS',       value: '0',     description: 'TCC/Angels split per transaction in cents (TBD)' },
    { key: 'RETRY_DAY_1',           value: '3',     description: 'Days after failure before first retry' },
    { key: 'RETRY_DAY_2',           value: '7',     description: 'Days after failure before second retry' },
    { key: 'DEBICHECK_ENABLED',     value: 'false', description: 'Show DebiCheck payment option in UI' },
    { key: 'CAPITEC_VRP_ENABLED',   value: 'false', description: 'Show Capitec Pay VRP option in UI' },
    { key: 'DEBICHECK_PROVIDER',    value: '',      description: 'Provider slug, e.g. "netcash"' },
    { key: 'CAPITEC_VRP_PROVIDER',  value: '',      description: 'Provider slug: "stitch" | "ebanx" | "direct"' },
  ]

  for (const config of configs) {
    const { error } = await supabase
      .from('PlatformConfig')
      .upsert({ id: crypto.randomUUID(), ...config }, { onConflict: 'key' })
    if (error) console.error(`Failed to seed config "${config.key}":`, error.message)
  }
  console.log('✓ Platform config seeded')

  // ── Associations ────────────────────────────────────────────
  const associations = [
    { name: 'Soweto Scholar Transport Association',       code: 'SSTA', region: 'Gauteng South',     contactName: 'Thabo Molefe',    contactPhone: '+27110000001', monthlyLevy: 0 },
    { name: 'East Rand Learner Transport',                code: 'ERLT', region: 'Ekurhuleni',         contactName: 'Sipho Dlamini',   contactPhone: '+27110000002', monthlyLevy: 0 },
    { name: 'Tshwane Scholar Operators Guild',            code: 'TSOG', region: 'Tshwane',            contactName: 'Nomsa Khumalo',   contactPhone: '+27110000003', monthlyLevy: 0 },
    { name: 'Johannesburg North Transport Association',   code: 'JNTA', region: 'Johannesburg North', contactName: 'Pieter van der Berg', contactPhone: '+27110000004', monthlyLevy: 0 },
    { name: 'West Rand Learner Transport Guild',          code: 'WRLG', region: 'West Rand',          contactName: 'Lerato Sithole',  contactPhone: '+27110000005', monthlyLevy: 0 },
  ]

  for (const assoc of associations) {
    const { error } = await supabase
      .from('Association')
      .upsert({ id: crypto.randomUUID(), ...assoc }, { onConflict: 'code' })
    if (error) console.error(`Failed to seed association "${assoc.code}":`, error.message)
  }
  console.log('✓ Associations seeded')

  // ── Admin user ─────────────────────────────────────────────
  const adminPhone = '+27000000000'
  const { data: existing } = await supabase
    .from('User')
    .select('id')
    .eq('phone', adminPhone)
    .maybeSingle()

  if (!existing) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('User').insert({
      id:        crypto.randomUUID(),
      phone:     adminPhone,
      name:      'Platform Admin',
      role:      'ADMIN',
      email:     'admin@accidentangels.co.za',
      isActive:  true,
      createdAt: now,
      updatedAt: now,
    })
    if (error) console.error('Failed to seed admin user:', error.message)
    else console.log('✓ Admin user seeded')
  } else {
    console.log('✓ Admin user already exists')
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
