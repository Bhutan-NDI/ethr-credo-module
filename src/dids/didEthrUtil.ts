import type { DidCreateResult, DidDocument } from '@credo-ts/core'

import { VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019 } from '@credo-ts/core'

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

/**
 * Validate that a DID document payload is spec-compliant for did:ethr.
 * Returns `null` when valid, otherwise a human-readable reason.
 */
export function validateSpecCompliantPayload(didDocument: DidDocument): string | null {
  // id is required
  if (!didDocument.id) return 'id is required'

  // verificationMethod is required
  if (!didDocument.verificationMethod) return 'verificationMethod is required'

  // verificationMethod must be an array
  if (!Array.isArray(didDocument.verificationMethod)) return 'verificationMethod must be an array'

  // verificationMethod must not be empty
  if (!didDocument.verificationMethod.length) return 'verificationMethod must be not be empty'

  // verificationMethod types must be supported
  const isValidVerificationMethod = didDocument.verificationMethod.every((vm) => {
    switch (vm.type) {
      case VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019:
        return vm?.publicKeyBase58 && vm?.controller && vm?.id
      // did:ethr documents also carry a `#controller` recovery method keyed by blockchain account id.
      case 'EcdsaSecp256k1RecoveryMethod2020':
        return vm?.blockchainAccountId && vm?.controller && vm?.id
      default:
        return false
    }
  })

  if (!isValidVerificationMethod) return 'verificationMethod is Invalid'

  if (didDocument.service) {
    const isValidService = didDocument.service.every((s) => s?.serviceEndpoint && s?.id && s?.type)
    if (!isValidService) return 'Service is Invalid'
  }

  return null
}
