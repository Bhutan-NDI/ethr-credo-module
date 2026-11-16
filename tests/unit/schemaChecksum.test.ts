import { describe, expect, it } from 'vitest'

import { computeSchemaChecksum } from '../../src/utils/schemaHelper'

const VECTOR = '09ad9fd2fb648cb2f62141215828ea00a62c299db05d20aa9ade2f527a301cc6'

describe('computeSchemaChecksum', () => {
  it('hashes the RFC 8785 canonical form', () => {
    expect(computeSchemaChecksum({ b: 'é', a: 1 })).toBe(VECTOR)
  })

  it('is unchanged by a schema file server round trip', () => {
    const served = JSON.parse(JSON.stringify({ a: 1, b: 'é' }, null, 2))
    expect(computeSchemaChecksum(served)).toBe(VECTOR)
  })
})
