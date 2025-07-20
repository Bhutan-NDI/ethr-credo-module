import {
  DidDocument,
  type AgentContext,
  type DidResolutionResult,
  type DidResolver,
  JsonTransformer,
} from '@credo-ts/core'

import { EthereumLedgerService } from '../ledger/EthereumLedgerService'

// import { isValidEthereumDid } from './didEthrUtil'

export class EthereumDidResolver implements DidResolver {
  public readonly allowsCaching = true

  public readonly supportedMethods = ['ethr']

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const ethereumLedgerService = agentContext.dependencyManager.resolve(EthereumLedgerService)
    const didDocumentMetadata = {}
    // if (!isValidEthereumDid(did)) {
    //   throw new Error('Invalid DID')
    // }
    try {
      const { didDocument, didDocumentMetadata, didResolutionMetadata } = await ethereumLedgerService.resolveDID(did)
      if (didDocument?.['@context'] && Array.isArray(didDocument?.['@context'])) {
        didDocument['@context'] = didDocument['@context'].filter(
          (ctx: string) => ctx !== 'https://w3id.org/security/v3-unstable'
        )

        if (!didDocument['@context'].includes('https://w3id.org/security/suites/secp256k1-2019/v1')) {
          didDocument['@context'].push('https://w3id.org/security/suites/secp256k1-2019/v1')
        }
      }
      return {
        didDocument: JsonTransformer.fromJSON(didDocument, DidDocument),
        didDocumentMetadata,
        didResolutionMetadata,
      }
    } catch (error) {
      return {
        didDocument: null,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did '${did}': ${error}`,
        },
      }
    }
  }
}
