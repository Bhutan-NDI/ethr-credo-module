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
import type { ResolverRegistry } from 'did-resolver'
import type { EthereumModuleConfig } from 'src/EthereumModuleConfig'

import { DidRepository, DidRecord, DidDocumentRole, JsonTransformer, DidDocument, CredoError } from '@credo-ts/core'
import { Resolver } from 'did-resolver'
import { SigningKey, Wallet as EtherWallet, JsonRpcProvider } from 'ethers'
import { getResolver } from 'ethr-did-resolver'

import { EthereumLedgerService } from '../ledger'

export class EthereumDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['ethereum']
  private resolver: Resolver
  public constructor(private config: EthereumModuleConfig) {
    this.resolver = new Resolver(getResolver({ options: config.config }) as ResolverRegistry)
  }

  public async create(agentContext: AgentContext, options: EthereumDidCreateOptions): Promise<DidCreateResult> {
    const ledgerService = agentContext.dependencyManager.resolve(EthereumLedgerService)
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    const privateKey = options.secret.privateKey

    const wallet = new EtherWallet(new SigningKey(privateKey))
    const provider = new JsonRpcProvider(ledgerService.rpcUrl)
    const value = await provider.getBalance(wallet.address)

    if (Number(value) == 0) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Insufficient balance in wallet',
        },
      }
    }

    // const key = await agentContext.wallet.createKey({ keyType: KeyType.K256, privateKey })

    // const publicKeyHex = key.publicKey.toString('hex')

    // const did = buildDid(options.method, options.options.network, publicKeyHex)
    // agentContext.config.logger.info(`Creating DID on ledger: ${did}`)

    try {
      // const signingKey = await this.getSigningKey(agentContext.wallet, key.publicKeyBase58)

      const didResult = ledgerService.createDidRegistryInstance(options)

      // DID Document
      const resolvedDocument = await this.resolver.resolve(didResult.did)
      // // Create did document
      // const secpDidDoc = getSecp256k1DidDoc(did, key, options.options.endpoint)

      // const response = await didRegistry.create(did, secpDidDoc)

      // agentContext.config.logger.info(`Published did on ledger: ${did}`)

      // const didDoc = response.didDoc

      const didDocument = JsonTransformer.fromJSON(resolvedDocument.didDocument, DidDocument)

      const didRecord = new DidRecord({
        did: didDocument.id,
        role: DidDocumentRole.Created,
        didDocument,
      })

      agentContext.config.logger.info(`Saving DID record to wallet: ${didResult.did} and did document: ${didDocument}`)

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

  // public async update(agentContext: AgentContext, options: EthereumDidUpdateOptions): Promise<DidUpdateResult> {
  //   const ledgerService = agentContext.dependencyManager.resolve(EthereumLedgerService)
  //   const didRepository = agentContext.dependencyManager.resolve(DidRepository)

  //   let didDocument: DidDocument
  //   let didRecord: DidRecord | null

  //   try {
  //     const isValidDidDoc = validateSpecCompliantPayload(options.didDocument)
  //     if (options.didDocument && isValidDidDoc === null) {
  //       didDocument = options.didDocument
  //       const resolvedDocument = await this.resolver.resolve(didDocument.id)
  //       didRecord = await didRepository.findCreatedDid(agentContext, didDocument.id)
  //       if (!resolvedDocument.didDocument || resolvedDocument.didDocumentMetadata.deactivated || !didRecord) {
  //         return {
  //           didDocumentMetadata: {},
  //           didRegistrationMetadata: {},
  //           didState: {
  //             state: 'failed',
  //             reason: 'Did not found',
  //           },
  //         }
  //       }

  //       if (options?.secret?.privateKey) {
  //         const privateKey = options?.secret?.privateKey
  //         if (privateKey && !isValidPrivateKey(privateKey, KeyType.K256)) {
  //           return {
  //             didDocumentMetadata: {},
  //             didRegistrationMetadata: {},
  //             didState: {
  //               state: 'failed',
  //               reason: 'Invalid private key provided',
  //             },
  //           }
  //         }

  //         const key = await agentContext.wallet.createKey({
  //           keyType: KeyType.K256,
  //           privateKey: privateKey,
  //         })

  //         const verificationMethodCount = didDocument?.verificationMethod?.length ?? 0

  //         const verificationMethod = getEcdsaSecp256k1VerificationKey2019({
  //           id: `${didDocument.id}#key-${verificationMethodCount + 1}`,
  //           key,
  //           controller: didDocument.id,
  //         })

  //         didDocument.verificationMethod = [...(didDocument?.verificationMethod ?? []), verificationMethod]
  //       }
  //     } else {
  //       return {
  //         didDocumentMetadata: {},
  //         didRegistrationMetadata: {},
  //         didState: {
  //           state: 'failed',
  //           reason: isValidDidDoc ?? 'Provide a valid didDocument',
  //         },
  //       }
  //     }

  //     if (!didRecord) {
  //       return {
  //         didDocumentMetadata: {},
  //         didRegistrationMetadata: {},
  //         didState: {
  //           state: 'failed',
  //           reason: 'DidRecord not found in wallet',
  //         },
  //       }
  //     }

  //     const publicKeyBase58 = await this.getPublicKeyFromDid(agentContext, options.did)

  //     if (!publicKeyBase58) {
  //       throw new CredoError('Public Key not found in wallet')
  //     }

  //     const signingKey = await this.getSigningKey(agentContext.wallet, publicKeyBase58)

  //     const didRegistry = ledgerService.createDidRegistryInstance(signingKey)

  //     const response = await didRegistry.update(didDocument.id, didDocument)

  //     if (!response) {
  //       throw new Error('Unable to update did document')
  //     }

  //     // Save the did document
  //     didRecord.didDocument = didDocument
  //     await didRepository.update(agentContext, didRecord)

  //     return {
  //       didDocumentMetadata: {},
  //       didRegistrationMetadata: {
  //         txn: response.txnHash,
  //       },
  //       didState: {
  //         state: 'finished',
  //         did: didDocument.id,
  //         didDocument,
  //       },
  //     }
  //   } catch (error) {
  //     const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  //     agentContext.config.logger.error(`Error Updating DID : ${errorMessage}`)
  //     return {
  //       didDocumentMetadata: {},
  //       didRegistrationMetadata: {},
  //       didState: {
  //         state: 'failed',
  //         reason: `unknownError: ${errorMessage}`,
  //       },
  //     }
  //   }
  // }

  // public async deactivate(agentContext: AgentContext, options: DidDeactivateOptions): Promise<DidDeactivateResult> {
  //   const didRepository = agentContext.dependencyManager.resolve(DidRepository)
  //   const ledgerService = agentContext.dependencyManager.resolve(EthereumLedgerService)

  //   const did = options.did

  //   try {
  //     const { didDocument, didDocumentMetadata } = await this.resolver.resolve(did)

  //     const didRecord = await didRepository.findCreatedDid(agentContext, did)
  //     if (!didDocument || didDocumentMetadata.deactivated || !didRecord) {
  //       return {
  //         didDocumentMetadata: {},
  //         didRegistrationMetadata: {},
  //         didState: {
  //           state: 'failed',
  //           reason: 'Did not found',
  //         },
  //       }
  //     }

  //     const publicKeyBase58 = await this.getPublicKeyFromDid(agentContext, options.did)

  //     if (!publicKeyBase58) {
  //       throw new CredoError('Public Key not found in wallet')
  //     }

  //     const signingKey = await this.getSigningKey(agentContext.wallet, publicKeyBase58)

  //     const didRegistry = ledgerService.createDidRegistryInstance(signingKey)

  //     const updatedDidDocument = new DidDocumentBuilder(options.did).addContext('https://www.w3.org/ns/did/v1').build()

  //     const response = await didRegistry.update(didDocument.id, updatedDidDocument)

  //     if (!response) {
  //       throw new CredoError(`Unable to deactivate did document for did : ${did}`)
  //     }

  //     await didRepository.update(agentContext, didRecord)

  //     return {
  //       didDocumentMetadata: {
  //         deactivated: true,
  //       },
  //       didRegistrationMetadata: {
  //         txn: response.txnHash,
  //       },
  //       didState: {
  //         state: 'finished',
  //         did: didDocument.id,
  //         didDocument: JsonTransformer.fromJSON(didDocument, DidDocument),
  //         secret: options.secret,
  //       },
  //     }
  //   } catch (error) {
  //     const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  //     agentContext.config.logger.error(`Error deactivating DID ${errorMessage}`)
  //     return {
  //       didDocumentMetadata: {},
  //       didRegistrationMetadata: {},
  //       didState: {
  //         state: 'failed',
  //         reason: `unknownError: ${errorMessage}`,
  //       },
  //     }
  //   }
  // }

  // private async getSigningKey(wallet: Wallet, publicKeyBase58: string): Promise<SigningKey> {
  //   if (!(wallet instanceof AskarWallet) && !(wallet instanceof AskarProfileWallet)) {
  //     throw new CredoError('Incorrect wallet type: Ethereum Module currently only supports Askar wallet')
  //   }

  //   const keyEntry = await wallet.withSession(
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //     async (session: { fetchKey: (arg0: { name: string }) => any }) =>
  //       await session.fetchKey({ name: publicKeyBase58 })
  //   )

  //   if (!keyEntry) {
  //     throw new WalletError('Key not found in wallet')
  //   }

  //   const signingKey = new SigningKey(keyEntry.key.secretBytes)

  //   keyEntry.key.handle.free()

  //   return signingKey
  // }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-member-accessibility
  update(agentContext: AgentContext, options: DidUpdateOptions): Promise<DidUpdateResult> {
    throw new Error('Method not implemented.')
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/explicit-member-accessibility
  deactivate(agentContext: AgentContext, options: DidDeactivateOptions): Promise<DidDeactivateResult> {
    throw new Error('Method not implemented.')
  }
  private async getPublicKeyFromDid(agentContext: AgentContext, did: string) {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    const didRecord = await didRepository.findCreatedDid(agentContext, did)
    if (!didRecord) {
      throw new CredoError('DidRecord not found')
    }

    if (!didRecord.didDocument?.verificationMethod) {
      throw new CredoError('VerificationMethod not found cannot get public key')
    }

    const publicKeyBase58 = didRecord.didDocument.verificationMethod[0].publicKeyBase58

    return publicKeyBase58
  }
}

export interface EthereumDidCreateOptions extends DidCreateOptions {
  method: 'ethereum'
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
  method: 'ethereum'
  did: string
  didDocument: DidDocument
  secret?: {
    privateKey: Buffer
  }
}
