import type { EthereumAgentModules } from './utils'
import type { EthereumDidCreateOptions } from '../src/dids'
import type { Agent } from '@credo-ts/core'

import { TypedArrayEncoder } from '@credo-ts/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { EthereumDIDFixtures } from './fixtures'
import { getEthereumAgent, hasE2eEnv } from './utils'

// did:ethr create + resolve hit the Sepolia ledger, so they require a real RPC.
const describeIfE2e = hasE2eEnv ? describe : describe.skip

describeIfE2e('Ethereum Module did resolver (e2e)', () => {
  let aliceAgent: Agent<EthereumAgentModules>
  let did: string

  beforeAll(async () => {
    aliceAgent = getEthereumAgent('alice')
    await aliceAgent.initialize()
  })

  afterAll(async () => {
    if (aliceAgent) await aliceAgent.shutdown()
  })

  it('create and resolve a did:ethr did', async () => {
    const createdDid = await aliceAgent.dids.create<EthereumDidCreateOptions>({
      method: 'ethr',
      options: {
        network: 'sepolia',
      },
      secret: {
        privateKey: TypedArrayEncoder.fromHex('89d6e6df0272c4262533f951d0550ecd9f444ec2e13479952e4cc6982febfed6'),
      },
    })
    expect(createdDid.didState.state).toBe('finished')
    did =
      createdDid.didState.did || 'did:ethr:sepolia:0x022527341df022c9b898999cf6035ed3addca5d30e703028deeb4408f890f3baca'
  })

  describe('EthereumDidResolver', () => {
    it('should resolve a ethereum did when valid did is passed', async () => {
      const resolvedDIDDoc = await aliceAgent.dids.resolve(did)
      expect(resolvedDIDDoc.didDocument?.context).toEqual(
        EthereumDIDFixtures.VALID_DID_DOCUMENT.didDocument['@context']
      )
      expect(resolvedDIDDoc.didDocument?.id).toBe(EthereumDIDFixtures.VALID_DID_DOCUMENT.didDocument.id)
      expect(resolvedDIDDoc.didDocument?.verificationMethod).toEqual(
        EthereumDIDFixtures.VALID_DID_DOCUMENT.didDocument.verificationMethod
      )
      expect(resolvedDIDDoc.didDocument?.authentication).toEqual(
        EthereumDIDFixtures.VALID_DID_DOCUMENT.didDocument.authentication
      )
      expect(resolvedDIDDoc.didDocument?.assertionMethod).toEqual(
        EthereumDIDFixtures.VALID_DID_DOCUMENT.didDocument.assertionMethod
      )
    })

    it("should fail with 'notFound' when an unregistered ethereum did is resolved", async () => {
      const unknownDid = 'did:ethr:testnet:0x525D4605f4EE59e1149987F59668D4f272359093'
      const result = await aliceAgent.dids.resolve(unknownDid)
      expect(result.didResolutionMetadata.error).toBe('notFound')
      expect(result.didResolutionMetadata.message).toContain('resolver_error: Unable to resolve did')
    })
  })
})
