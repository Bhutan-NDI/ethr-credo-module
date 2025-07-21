import type { DidDocument } from '@credo-ts/core'

import {
  DidDocumentBuilder,
  DidDocumentService,
  VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
  VerificationMethod,
} from '@credo-ts/core'

import { SECURITY_CONTEXT_SECP256k1_RECOVERY_URL } from '../signature-suites'

// export const generateSecp256k1KeyPair = async () => {
//   const { privateKey, publicKeyBase58, address } = await EthereumDID.createKeyPair('testnet')
//   return { privateKey, publicKeyBase58, address }
// }

export function getSecp256k1DidDocWithPublicKey(
  did: string,
  publicKeyBase58: string,
  serviceEndpoint?: string
): DidDocument {
  const verificationMethod = new VerificationMethod({
    id: `${did}#key-1`,
    type: VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
    controller: did,
    publicKeyBase58,
  })

  const didDocumentBuilder = new DidDocumentBuilder(did)
  didDocumentBuilder.addContext(SECURITY_CONTEXT_SECP256k1_RECOVERY_URL).addVerificationMethod(verificationMethod)

  if (serviceEndpoint) {
    const service = new DidDocumentService({
      id: `${did}#linked-domain`,
      serviceEndpoint,
      type: 'LinkedDomains',
    })

    didDocumentBuilder.addService(service)
  }

  didDocumentBuilder
    .addAuthentication(verificationMethod.id)
    .addAssertionMethod(verificationMethod.id)
    .addCapabilityDelegation(verificationMethod.id)
    .addCapabilityInvocation(verificationMethod.id)

  didDocumentBuilder.addKeyAgreement(verificationMethod.id)

  return didDocumentBuilder.build()
}

/**
 * Converts a hex-encoded public key to base58-encoded format
 * @param publicKeyHex - Hex string (e.g. from EcdsaSecp256k1VerificationKey2019)
 * @returns base58-encoded public key string
 */
export function convertHexToBase58(publicKeyHex: string): string {
  // Remove potential 0x prefix
  if (publicKeyHex.startsWith('0x')) {
    publicKeyHex = publicKeyHex.slice(2)
  }

  // Convert hex to a buffer
  const buffer = Buffer.from(publicKeyHex, 'hex')

  const publicKeyBase58 = bs58.encode(buffer)
  console.log('publicKeyBase58 in convertHexToBase58------', publicKeyBase58)

  return publicKeyBase58
}

export function parseAddress(address: string) {
  const parts = address.split(':')
  if (parts.length < 3) {
    throw new Error('Invalid CAIP format')
  }
  return parts[2]
}

export function getPreferredKey(methods: VerificationMethod[]): string {
  for (const m of methods) {
    if (m.blockchainAccountId) return m.blockchainAccountId
    if (m.publicKeyHex) return m.publicKeyHex
  }

  // Guaranteed fallback
  return methods[0].controller
}
