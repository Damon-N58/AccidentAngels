// lib/whatsapp/driverOnboardingFlow.ts
//
// Pure state machine for the WhatsApp driver-onboarding conversation.
// Takes the current session state + incoming message text, returns the
// reply to send + the updated state. No WhatsApp/Nineteen58 API calls here —
// keeps this testable without real webhook access, and reusable regardless
// of which provider format eventually calls it.

export type OnboardingStep =
  | 'DETAILS'
  | 'VEHICLE'
  | 'ASSOCIATION'
  | 'BANKING'
  | 'COMPLIANCE_DOCS'
  | 'DONE'

export interface OnboardingState {
  currentStep: OnboardingStep
  collectedData: Record<string, unknown>
}

export interface StepResult {
  reply: string
  nextState: OnboardingState
  /** true once all steps are done and onboardDriver() should be called */
  readyToSubmit: boolean
}

// TODO(matt): association list must come from the real Association table,
// not hardcoded — this function will need it passed in once wired to the DB.
export function handleIncomingMessage(
  state: OnboardingState,
  messageText: string,
  associations: { id: string; name: string }[],
): StepResult {
  const text = messageText.trim()

  switch (state.currentStep) {
    case 'DETAILS': {
      // First message in this step is the name; GETS number is optional
      // follow-up handled by asking a yes/no first — kept simple for v1.
      const data = { ...state.collectedData, name: text }
      return {
        reply: 'Got it. Now let\'s add your vehicle.\nWhat make and model is it? (e.g. "Toyota Quantum")',
        nextState: { currentStep: 'VEHICLE', collectedData: data },
        readyToSubmit: false,
      }
    }

    case 'VEHICLE': {
      const data = { ...state.collectedData, vehicleRaw: text }
      const list = associations.map((a, i) => `${i + 1}. ${a.name}`).join('\n')
      return {
        reply: `Thanks. Which association are you with?\n${list}\n\nReply with the number.`,
        nextState: { currentStep: 'ASSOCIATION', collectedData: data },
        readyToSubmit: false,
      }
    }

    case 'ASSOCIATION': {
      const index = parseInt(text, 10) - 1
      const chosen = associations[index]
      if (!chosen) {
        return {
          reply: 'Sorry, I didn\'t recognise that number. Please reply with a number from the list above.',
          nextState: state,
          readyToSubmit: false,
        }
      }
      const data = { ...state.collectedData, associationId: chosen.id }
      return {
        reply: 'Last step: your banking details, for payouts. What bank do you use?',
        nextState: { currentStep: 'BANKING', collectedData: data },
        readyToSubmit: false,
      }
    }

    case 'BANKING': {
      // Bank name only for now — account number/branch code collection is
      // still pending a decision on how multi-field steps are best split
      // into separate WhatsApp prompts.
      const data = { ...state.collectedData, bankName: text }
      return {
        reply: 'Document upload isn\'t ready yet — hang tight',
        nextState: { currentStep: 'COMPLIANCE_DOCS', collectedData: data },
        readyToSubmit: false,
      }
    }

    case 'COMPLIANCE_DOCS': {
      // Intentionally incomplete: blocked on media-handling design for
      // receiving document/photo uploads over WhatsApp. Stay on this step.
      return {
        reply: 'Document upload isn\'t ready yet — hang tight',
        nextState: state,
        readyToSubmit: false,
      }
    }

    case 'DONE':
      return {
        reply: 'You\'re all set!',
        nextState: state,
        readyToSubmit: false,
      }

    default:
      return { reply: '', nextState: state, readyToSubmit: false }
  }
}
