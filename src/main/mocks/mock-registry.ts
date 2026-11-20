import { EMPTY_STATE, type MockState } from '../../shared/mocks/types'

export class MockRegistry {
  private current: MockState = EMPTY_STATE

  constructor(private readonly onChange: (state: MockState) => void) {}

  state(): MockState {
    return this.current
  }

  replace(next: MockState): void {
    this.current = next
    this.onChange(next)
  }
}
