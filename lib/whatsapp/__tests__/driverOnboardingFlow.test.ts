import { describe, it, expect } from 'vitest'
import { handleIncomingMessage } from '../driverOnboardingFlow'
import type { OnboardingState } from '../driverOnboardingFlow'

// ── Helpers ────────────────────────────────────────────────────────────────────

const ASSOCIATIONS = [
  { id: 'assoc-1', name: 'Gauteng Scholar Transport' },
  { id: 'assoc-2', name: 'Alliance Transport Association' },
]

function makeState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    currentStep: 'DETAILS',
    collectedData: {},
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('handleIncomingMessage', () => {
  it('DETAILS -> VEHICLE: stores the name and asks for vehicle details', () => {
    const state = makeState()
    const result = handleIncomingMessage(state, 'Thabo Molefe', ASSOCIATIONS)

    expect(result.nextState.currentStep).toBe('VEHICLE')
    expect(result.nextState.collectedData.name).toBe('Thabo Molefe')
    expect(result.reply).toMatch(/vehicle/i)
    expect(result.readyToSubmit).toBe(false)
  })

  it('VEHICLE -> ASSOCIATION: stores the vehicle text and lists associations', () => {
    const state = makeState({ currentStep: 'VEHICLE', collectedData: { name: 'Thabo Molefe' } })
    const result = handleIncomingMessage(state, 'Toyota Quantum', ASSOCIATIONS)

    expect(result.nextState.currentStep).toBe('ASSOCIATION')
    expect(result.nextState.collectedData.vehicleRaw).toBe('Toyota Quantum')
    expect(result.reply).toContain('1. Gauteng Scholar Transport')
    expect(result.reply).toContain('2. Alliance Transport Association')
    expect(result.readyToSubmit).toBe(false)
  })

  it('ASSOCIATION: an out-of-range number leaves state unchanged', () => {
    const state = makeState({ currentStep: 'ASSOCIATION', collectedData: { name: 'Thabo Molefe' } })
    const result = handleIncomingMessage(state, '99', ASSOCIATIONS)

    expect(result.nextState).toEqual(state)
    expect(result.reply).toMatch(/didn't recognise/i)
    expect(result.readyToSubmit).toBe(false)
  })

  it('ASSOCIATION: a non-numeric reply also leaves state unchanged', () => {
    const state = makeState({ currentStep: 'ASSOCIATION', collectedData: {} })
    const result = handleIncomingMessage(state, 'not a number', ASSOCIATIONS)

    expect(result.nextState).toEqual(state)
    expect(result.reply).toMatch(/didn't recognise/i)
  })

  it('ASSOCIATION -> BANKING: a valid number advances and records the associationId', () => {
    const state = makeState({ currentStep: 'ASSOCIATION', collectedData: { name: 'Thabo Molefe' } })
    const result = handleIncomingMessage(state, '2', ASSOCIATIONS)

    expect(result.nextState.currentStep).toBe('BANKING')
    expect(result.nextState.collectedData.associationId).toBe('assoc-2')
    expect(result.reply).toMatch(/banking/i)
    expect(result.readyToSubmit).toBe(false)
  })
})
