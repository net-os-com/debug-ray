import { randomUUID } from 'node:crypto'
import type { MockHit } from '../../shared/mocks/types'

export class MockHitLog {
  private hits: MockHit[] = []

  constructor(
    private readonly max: number,
    private readonly publish: (hit: MockHit) => void,
  ) {}

  add(hit: Omit<MockHit, 'id'>): MockHit {
    const stored = { ...hit, id: randomUUID() }

    this.hits = [stored, ...this.hits].slice(0, this.max)
    this.publish(stored)

    return stored
  }

  all(): MockHit[] {
    return this.hits
  }

  clear(): void {
    this.hits = []
  }
}
