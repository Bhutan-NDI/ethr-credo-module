import type { EthereumAgentModules } from './utils'
import type { Agent } from '@credo-ts/core'

import { transformPrivateKeyToPrivateJwk } from '@credo-ts/askar'
import {
  ClaimFormat,
  CREDENTIALS_CONTEXT_V1_URL,
  DidDocument,
  JsonTransformer,
  TypedArrayEncoder,
  W3cCredential,
  W3cJsonLdVerifiableCredential,
} from '@credo-ts/core'
import { KeyManagementApi } from '@credo-ts/core/kms'
import { computeAddress, SigningKey } from 'ethers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { EcdsaSecp256k1Signature2019Fixtures } from './fixtures'
import { getEthereumAgent, hasE2eEnv } from './utils'

/**
 * Proves the fix from PR #15: after a did:ethr key is imported into the Askar KMS and the
 * DID record maps `#controllerKey` -> that KMS key, credential signing resolves and uses it.
 * This runs offline — the issuer DID is imported as a *created* DID so no ledger/RPC is needed.
 */
describe('EcdsaSecp256k1Signature2019 (Credo 0.6 KMS)', () => {
  let agent: Agent<EthereumAgentModules>
  const privateKey = TypedArrayEncoder.fromHex('89d6e6df0272c4262533f951d0550ecd9f444ec2e13479952e4cc6982febfed6')
  let issuerDid: string
  let verificationMethod: string

  beforeAll(async () => {
    agent = getEthereumAgent('secp256k1')
    await agent.initialize()

    // Import the issuer key into the Askar KMS, keyed by its base58 public key — exactly
    // what EthereumDidRegistrar.importKeyToKms does during did:ethr creation.
    const kms = agent.dependencyManager.resolve(KeyManagementApi)
    const publicKeyHex = new SigningKey(privateKey).compressedPublicKey.substring(2)
    const publicKeyBase58 = TypedArrayEncoder.toBase58(TypedArrayEncoder.fromHex(publicKeyHex))
    const { privateJwk } = transformPrivateKeyToPrivateJwk({ type: { kty: 'EC', crv: 'secp256k1' }, privateKey })
    privateJwk.kid = publicKeyBase58
    const imported = await kms.importKey({ backend: 'askar', privateJwk })

    issuerDid = `did:ethr:sepolia:0x${publicKeyHex}`
    verificationMethod = `${issuerDid}#controllerKey`
    const address = computeAddress(new SigningKey(privateKey))

    // Import the resolved did:ethr document + key mapping, mirroring what create() persists:
    // did:ethr lists `#controller` (recovery method, no key) first and `#controllerKey` second.
    const didDocument = JsonTransformer.fromJSON(
      {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/secp256k1recovery-2020/v2',
          'https://w3id.org/security/suites/secp256k1-2019/v1',
        ],
        id: issuerDid,
        verificationMethod: [
          {
            id: `${issuerDid}#controller`,
            type: 'EcdsaSecp256k1RecoveryMethod2020',
            controller: issuerDid,
            blockchainAccountId: `eip155:11155111:${address}`,
          },
          { id: verificationMethod, type: 'EcdsaSecp256k1VerificationKey2019', controller: issuerDid, publicKeyBase58 },
        ],
        authentication: [`${issuerDid}#controller`, verificationMethod],
        assertionMethod: [`${issuerDid}#controller`, verificationMethod],
      },
      DidDocument
    )
    await agent.dids.import({
      did: issuerDid,
      didDocument,
      keys: [{ kmsKeyId: imported.keyId, didDocumentRelativeKeyId: '#controllerKey' }],
      overwrite: true,
    })
  })

  afterAll(async () => {
    if (agent) await agent.shutdown()
  })

  describe('signCredential', () => {
    it('signs a credential with the imported #controllerKey KMS key', async () => {
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
      expect(Array.isArray(vc.proof)).toBe(false)
      expect((vc.proof as unknown as { verificationMethod: string }).verificationMethod).toEqual(verificationMethod)
    })
  })

  // Verifying the pre-signed fixture resolves the issuer DID from the ledger, so it needs a
  // real RPC. Gated behind SEPOLIA_RPC_URL.
  const describeIfE2e = hasE2eEnv ? describe : describe.skip
  describeIfE2e('verifyCredential (requires ledger resolution)', () => {
    it('verifies a pre-signed credential', async () => {
      const result = await agent.w3cCredentials.verifyCredential({
        credential: JsonTransformer.fromJSON(
          EcdsaSecp256k1Signature2019Fixtures.TEST_LD_DOCUMENT_SIGNED,
          W3cJsonLdVerifiableCredential
        ),
      })
      expect(result.isValid).toBe(true)
    })
  })
})
