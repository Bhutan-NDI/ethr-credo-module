import {
  DidDocument,
  type AgentContext,
  type DidResolutionResult,
  type DidResolver,
  JsonTransformer,
} from '@credo-ts/core'

import { EthereumLedgerService } from '../ledger/EthereumLedgerService'

import { isValidEthereumDid } from './didEthrUtil'

export class EthereumDidResolver implements DidResolver {
  public readonly allowsCaching = true

  public readonly supportedMethods = ['ethr']

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const ethereumLedgerService = agentContext.dependencyManager.resolve(EthereumLedgerService)
    const didDocumentMetadata = {}
    if (!isValidEthereumDid(did)) {
      throw new Error('Invalid DID')
    }

    try {
      const { didDocument, didDocumentMetadata, didResolutionMetadata } = await ethereumLedgerService.resolveDID(did)

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
