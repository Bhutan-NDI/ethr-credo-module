import type { EthereumAgentModules } from './utils'
import type { EthereumDidCreateOptions } from '../src/dids'
import type { Agent } from '@credo-ts/core'

import { TypedArrayEncoder } from '@credo-ts/core'
import { Wallet } from 'ethers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getEthereumAgent, hasE2eEnv } from './utils'

// did:ethr create + resolve read from the Sepolia registry, so they require a real RPC.
const describeIfE2e = hasE2eEnv ? describe : describe.skip

describeIfE2e('Ethereum Module did resolver (e2e)', () => {
  let aliceAgent: Agent<EthereumAgentModules>
  // Ephemeral key: did:ethr is derived from it and resolves off-chain, so no funding needed.
  const privateKey = TypedArrayEncoder.fromHex(Wallet.createRandom().privateKey.slice(2))
  let did: string

  beforeAll(async () => {
    aliceAgent = getEthereumAgent('alice')
    await aliceAgent.initialize()
  })

  afterAll(async () => {
    if (aliceAgent) await aliceAgent.shutdown()
  })

  it('creates and resolves a did:ethr did', async () => {
    const created = await aliceAgent.dids.create<EthereumDidCreateOptions>({
      method: 'ethr',
      options: { network: 'sepolia' },
      secret: { privateKey },
    })
    expect(created.didState.state).toBe('finished')
    did = created.didState.did as string
    expect(did).toMatch(/^did:ethr:sepolia:0x[0-9a-fA-F]+$/)
  })

  describe('EthereumDidResolver', () => {
    it('resolves a did:ethr document with a secp256k1 controller key', async () => {
      const { didDocument } = await aliceAgent.dids.resolve(did)
      expect(didDocument?.id).toBe(did)
      const controllerKey = didDocument?.verificationMethod?.find((vm) => vm.id.endsWith('#controllerKey'))
      expect(controllerKey?.type).toBe('EcdsaSecp256k1VerificationKey2019')
      expect(controllerKey?.publicKeyBase58).toBeDefined()
    })

    it("fails with 'notFound' for an unregistered ethereum did", async () => {
      const unknownDid = 'did:ethr:testnet:0x525D4605f4EE59e1149987F59668D4f272359093'
      const result = await aliceAgent.dids.resolve(unknownDid)
      expect(result.didResolutionMetadata.error).toBe('notFound')
    })
  })
})
