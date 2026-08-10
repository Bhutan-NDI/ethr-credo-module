import type {
  AgentContext,
  DidCreateOptions,
  DidCreateResult,
  DidRegistrar,
  DidUpdateOptions,
  Buffer,
  DidDeactivateOptions,
  DidDeactivateResult,
  DidUpdateResult,
} from '@credo-ts/core'
import type { KmsJwkPublic } from '@credo-ts/core/kms'

import { transformPrivateKeyToPrivateJwk } from '@credo-ts/askar'
import {
  Buffer as CredoBuffer,
  DidRepository,
  DidRecord,
  DidDocumentRole,
  JsonTransformer,
  DidDocument,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { KeyManagementApi, KeyManagementKeyNotFoundError } from '@credo-ts/core/kms'
import { SigningKey } from 'ethers'
import { EthrDID } from 'ethr-did'

import { EthereumLedgerService } from '../ledger/index.js'

import { failedResult, validateSpecCompliantPayload } from './didEthrUtil.js'

export class EthereumDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['ethr']

  /**
   * Import a private key into the Askar KMS with an idempotency check, keyed by the base58
   * compressed public key. That keyId is the same name the ledger service fetches for signing,
   * and is backward-compatible with keys created under the pre-0.6 wallet API. Returns the keyId.
   */
  private async importKeyToKms(
    agentContext: AgentContext,
    privateKey: Uint8Array,
    publicKeyBase58: string
  ): Promise<string> {
    const kmsApi = agentContext.dependencyManager.resolve(KeyManagementApi)

    const { privateJwk } = transformPrivateKeyToPrivateJwk({
      type: { kty: 'EC', crv: 'secp256k1' },
      privateKey,
    })
    privateJwk.kid = publicKeyBase58

    // Reuse the key if it already exists under this kid, otherwise import it
    let publicJwk: KmsJwkPublic | undefined
    try {
      publicJwk = await kmsApi.getPublicKey({ backend: 'askar', keyId: publicKeyBase58 })
    } catch (error) {
      // Only "key does not exist" is expected here; any other failure (backend/storage error)
      // must surface rather than be silently treated as a missing key.
      if (!(error instanceof KeyManagementKeyNotFoundError)) {
        throw error
      }
      agentContext.config.logger.debug(`Key not found in Askar KMS, will import: ${publicKeyBase58}`)
    }

    if (!publicJwk) {
      // Pin the import to the Askar backend so the key lands in the same store that
      // EthereumLedgerService.getSigningKey reads from (which is hard-wired to Askar).
      const importedKey = await kmsApi.importKey({ backend: 'askar', privateJwk })
      agentContext.config.logger.debug(`Imported new key to Askar KMS: ${importedKey.keyId}`)
      return importedKey.keyId
    }

    agentContext.config.logger.debug(`Key already exists in Askar KMS: ${publicKeyBase58}`)
    return publicKeyBase58
  }

  public async create(agentContext: AgentContext, options: EthereumDidCreateOptions): Promise<DidCreateResult> {
    const ledgerService = agentContext.dependencyManager.resolve(EthereumLedgerService)
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    try {
      // Key preparation is inside the try so an invalid key or a KMS/backend failure
      // resolves to a failed DidCreateResult instead of rejecting agent.dids.create().
      const privateKey = options.secret.privateKey

      // Derive the compressed secp256k1 public key (matches the pre-0.6 wallet.createKey output).
      // new SigningKey throws for an invalid key, which the catch below turns into a failed result.
      const publicKeyHex = new SigningKey(privateKey).compressedPublicKey.substring(2) // strip '0x'
      const publicKeyBase58 = TypedArrayEncoder.toBase58(CredoBuffer.from(publicKeyHex, 'hex'))

      const ethrDid = new EthrDID({
        identifier: '0x' + publicKeyHex,
        chainNameOrId: options.options.network,
      })

      agentContext.config.logger.info(`Creating DID on ledger: ${ethrDid.did}`)

      // DID Document
      const resolvedDocument = await ledgerService.resolveDID(ethrDid.did)
      const didDocument = JsonTransformer.fromJSON(resolvedDocument.didDocument, DidDocument)

      // Reject a malformed document from the ledger/resolver before persisting it.
      const validationError = validateSpecCompliantPayload(didDocument)
      if (validationError) {
        return failedResult(`Resolved DID document is not spec compliant: ${validationError}`)
      }

      // Link the KMS key to the verification method that actually holds it.
      // did:ethr lists `#controller` (an EcdsaSecp256k1RecoveryMethod2020 with only a
      // blockchainAccountId) first; the imported public key lives in `#controllerKey`.
      // Match by public key, and persist the RELATIVE fragment — Credo's credential
      // services resolve the key id against the verification method fragment.
      const signingMethod = didDocument.verificationMethod?.find((vm) => vm.publicKeyBase58 === publicKeyBase58)
      if (!signingMethod) {
        return failedResult(`No verification method matching the imported key was found for did ${didDocument.id}`)
      }
      const didDocumentRelativeKeyId = `#${signingMethod.id.split('#').pop()}`

      // Import the key only after the document validates and a matching method is found, so a
      // resolution/matching failure above does not leave an orphan key in the Askar store.
      const keyId = await this.importKeyToKms(agentContext, privateKey, publicKeyBase58)

      const didRecord = new DidRecord({
        did: didDocument.id,
        role: DidDocumentRole.Created,
        didDocument,
        keys: [{ kmsKeyId: keyId, didDocumentRelativeKeyId }],
      })

      agentContext.config.logger.info(`Saving DID record to wallet: ${didDocument.id} and did document: ${didDocument}`)

      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {
          txn: null,
        },
        didState: {
          state: 'finished',
          did: didDocument.id,
          didDocument: didDocument,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      agentContext.config.logger.error(`Error registering DID : ${errorMessage}`)
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `unknownError: ${errorMessage}`,
        },
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-member-accessibility
  update(agentContext: AgentContext, options: DidUpdateOptions): Promise<DidUpdateResult> {
    throw new Error('Method not implemented.')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-member-accessibility
  deactivate(agentContext: AgentContext, options: DidDeactivateOptions): Promise<DidDeactivateResult> {
    throw new Error('Method not implemented.')
  }
}

export interface EthereumDidCreateOptions extends DidCreateOptions {
  method: 'ethr'
  did?: never
  options: {
    network: string
    endpoint?: string
    address?: string
  }
  secret: {
    privateKey: Buffer
  }
}

export interface EthereumDidUpdateOptions extends DidUpdateOptions {
  method: 'ethr'
  did: string
  didDocument: DidDocument
  secret?: {
    privateKey: Buffer
  }
}
