// Central branding config — change names/URLs/colors here to rebrand everything at once

export const brand = {
  platform: {
    name: 'Accident Angels',
    shortName: 'AccidentAngels',
    tagline: 'Safe transport, every day',
    domain: 'accidentangels.co.za',
    email: 'hello@accidentangels.co.za',
    supportPhone: '',
  },

  apps: {
    driver: {
      name: 'Angels Driver',
      shortName: 'Angels Driver',
      tagline: 'Your compliance, your livelihood',
      url: process.env.NEXT_PUBLIC_DRIVER_URL ?? 'https://driver.accidentangels.co.za',
      themeColor: '#1A3F7A',
    },
    parent: {
      name: 'Angels',
      shortName: 'Angels',
      tagline: 'Safe transport, every day',
      url: process.env.NEXT_PUBLIC_PARENT_URL ?? 'https://parent.accidentangels.co.za',
      themeColor: '#1A3F7A',
    },
    admin: {
      name: 'Accident Angels Admin',
      shortName: 'AA Admin',
      url: process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin.accidentangels.co.za',
    },
  },

  colors: {
    primary: '#1A3F7A',   // deep Gauteng blue
    accent: '#F5A623',    // gold
    success: '#0F6E56',   // verified / compliant
    danger: '#E24B4A',    // non-compliant / failed
    warning: '#F59E0B',   // expiring / attention
    surface: '#F8F9FB',
    card: '#FFFFFF',
    border: 'rgba(26,63,122,0.10)',
    text: '#0F1923',
    textMuted: '#5A6474',
  },

  partners: {
    gets: {
      name: 'GETS',
      fullName: 'Gauteng Education Transport Services',
    },
    tcc: {
      name: 'TCC / Angels',
    },
    studio: {
      name: 'Nineteen58',
      url: 'https://nineteen58.co.za',
    },
  },

  sms: {
    senderId: 'AccidentAngels',
  },
}
