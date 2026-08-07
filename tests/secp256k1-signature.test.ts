import type { EthereumAgentModules } from './utils'
import type { EthereumDidCreateOptions } from '../src/dids'
import type { Agent } from '@credo-ts/core'

import {
  ClaimFormat,
  CREDENTIALS_CONTEXT_V1_URL,
  JsonTransformer,
  TypedArrayEncoder,
  W3cCredential,
  W3cJsonLdVerifiableCredential,
} from '@credo-ts/core'
import { computeAddress, SigningKey, Wallet } from 'ethers'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { EthereumLedgerService } from '../src/ledger'

import { getEthereumAgent } from './utils'

/**
 * Exercises the real EthereumDidRegistrar.create() offline (ledger resolution is stubbed) so
 * the PR's main migration path — importKeyToKms, #controllerKey matching, and the persisted
 * KMS-key mapping — is covered without RPC, then proves credential signing uses that mapping.
 * Uses an ephemeral random key so no private key is committed.
 */
describe('EthereumDidRegistrar + EcdsaSecp256k1Signature2019 (Credo 0.6 KMS)', () => {
  let agent: Agent<EthereumAgentModules>
  const privateKey = TypedArrayEncoder.fromHex(Wallet.createRandom().privateKey.slice(2))
  let issuerDid: string
  let verificationMethod: string

  beforeAll(async () => {
    agent = getEthereumAgent('secp256k1')
    await agent.initialize()

    // Build the base did:ethr document the resolver would return for this key, and stub
    // resolveDID so create() runs offline while still executing all the migrated logic.
    const publicKeyHex = new SigningKey(privateKey).compressedPublicKey.substring(2)
    const publicKeyBase58 = TypedArrayEncoder.toBase58(TypedArrayEncoder.fromHex(publicKeyHex))
    const address = computeAddress(new SigningKey(privateKey))
    const did = `did:ethr:sepolia:0x${publicKeyHex}`

    const ledgerService = agent.dependencyManager.resolve(EthereumLedgerService)
    vi.spyOn(ledgerService, 'resolveDID').mockResolvedValue({
      didDocument: {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/secp256k1recovery-2020/v2',
          'https://w3id.org/security/suites/secp256k1-2019/v1',
        ],
        id: did,
        verificationMethod: [
          {
            id: `${did}#controller`,
            type: 'EcdsaSecp256k1RecoveryMethod2020',
            controller: did,
            blockchainAccountId: `eip155:11155111:${address}`,
          },
          { id: `${did}#controllerKey`, type: 'EcdsaSecp256k1VerificationKey2019', controller: did, publicKeyBase58 },
        ],
        authentication: [`${did}#controller`, `${did}#controllerKey`],
        assertionMethod: [`${did}#controller`, `${did}#controllerKey`],
      },
      didDocumentMetadata: {},
      didResolutionMetadata: {},
    } as unknown as Awaited<ReturnType<EthereumLedgerService['resolveDID']>>)

    const created = await agent.dids.create<EthereumDidCreateOptions>({
      method: 'ethr',
      options: { network: 'sepolia' },
      secret: { privateKey },
    })
    expect(created.didState.state).toBe('finished')
    issuerDid = created.didState.did as string
    verificationMethod = `${issuerDid}#controllerKey`
  })

  afterAll(async () => {
    if (agent) await agent.shutdown()
  })

  it('signs a credential using the #controllerKey KMS key persisted by create()', async () => {
    // credentials/v1 alone is sufficient for this suite (see _includesCompatibleContext).
    const credential = JsonTransformer.fromJSON(
      {
        '@context': [CREDENTIALS_CONTEXT_V1_URL],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        issuanceDate: '2020-01-01T00:00:00Z',
        credentialSubject: { id: 'did:example:subject' },
      },
      W3cCredential
    )

    const vc = await agent.w3cCredentials.signCredential({
      format: ClaimFormat.LdpVc,
      credential,
      proofType: 'EcdsaSecp256k1Signature2019',
      verificationMethod,
    })

    expect(vc).toBeInstanceOf(W3cJsonLdVerifiableCredential)
    expect(vc.issuerId).toEqual(issuerDid)
    expect((vc.proof as unknown as { verificationMethod: string }).verificationMethod).toEqual(verificationMethod)
  })

  it('returns didState "failed" (does not throw) for an invalid private key', async () => {
    const result = await agent.dids.create<EthereumDidCreateOptions>({
      method: 'ethr',
      options: { network: 'sepolia' },
      secret: { privateKey: TypedArrayEncoder.fromHex('00') }, // 1-byte, invalid secp256k1 key
    })
    expect(result.didState.state).toBe('failed')
  })
})
