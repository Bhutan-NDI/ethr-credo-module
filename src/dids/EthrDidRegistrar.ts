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

export class EthereumDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['ethr']

  /**
   * Import a private key into the KMS with an idempotency check.
   * Uses the base58 compressed public key as the keyId (askar key name) so it stays
   * consistent with the name the ledger service later fetches for signing, and
   * backward-compatible with keys created under the pre-0.6 wallet API.
   */
  private async importKeyToKms(
    agentContext: AgentContext,
    privateKey: Uint8Array
  ): Promise<{ publicKeyBase58: string; publicKeyHex: string; keyId: string }> {
    const kmsApi = agentContext.dependencyManager.resolve(KeyManagementApi)

    // Compressed secp256k1 public key — matches the pre-0.6 wallet.createKey({ K256 }) output
    const signingKey = new SigningKey(privateKey)
    const publicKeyHex = signingKey.compressedPublicKey.substring(2) // strip '0x'
    const publicKeyBase58 = TypedArrayEncoder.toBase58(CredoBuffer.from(publicKeyHex, 'hex'))

    const { privateJwk } = transformPrivateKeyToPrivateJwk({
      type: { kty: 'EC', crv: 'secp256k1' },
      privateKey,
    })
    privateJwk.kid = publicKeyBase58

    // Reuse the key if it already exists under this kid, otherwise import it
    let publicJwk: KmsJwkPublic | undefined
    try {
      publicJwk = await kmsApi.getPublicKey({ keyId: publicKeyBase58 })
    } catch (error) {
      if (error instanceof KeyManagementKeyNotFoundError) {
        agentContext.config.logger.debug(`Key not found in KMS, will import: ${publicKeyBase58}`)
      }
    }

    let keyId = publicKeyBase58
    if (!publicJwk) {
      const importedKey = await kmsApi.importKey({ privateJwk })
      keyId = importedKey.keyId
      agentContext.config.logger.debug(`Imported new key to KMS: ${keyId}`)
    } else {
      agentContext.config.logger.debug(`Key already exists in KMS: ${keyId}`)
    }

    return { publicKeyBase58, publicKeyHex, keyId }
  }

  public async create(agentContext: AgentContext, options: EthereumDidCreateOptions): Promise<DidCreateResult> {
    const ledgerService = agentContext.dependencyManager.resolve(EthereumLedgerService)
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    const privateKey = options.secret.privateKey

    const { publicKeyHex, keyId } = await this.importKeyToKms(agentContext, privateKey)

    const ethrDid = new EthrDID({
      identifier: '0x' + publicKeyHex,
      chainNameOrId: options.options.network,
    })

    agentContext.config.logger.info(`Creating DID on ledger: ${ethrDid.did}`)

    try {
      // DID Document
      const resolvedDocument = await ledgerService.resolveDID(ethrDid.did)

      // update the context

      const didDocument = JsonTransformer.fromJSON(resolvedDocument.didDocument, DidDocument)

      const didRecord = new DidRecord({
        did: didDocument.id,
        role: DidDocumentRole.Created,
        didDocument,
        // Link the imported KMS key to the DID's verification method so credential
        // signing can resolve it. Matched via `verificationMethod.id.endsWith(...)`.
        keys: didDocument.verificationMethod?.length
          ? [
              {
                kmsKeyId: keyId,
                didDocumentRelativeKeyId: didDocument.verificationMethod[0].id,
              },
            ]
          : undefined,
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
