import type { DidCreateResult } from '@credo-ts/core'

export const ethereumDidRegex = new RegExp(/^did:ethr(:[0-9a-fA-F])?:0x[0-9a-fA-F]{40}$/)

export const isValidEthereumDid = (did: string) => ethereumDidRegex.test(did)

export function failedResult(reason: string): DidCreateResult {
  return {
    didDocumentMetadata: {},
    didRegistrationMetadata: {},
    didState: {
      state: 'failed',
      reason: reason,
    },
  }
}
