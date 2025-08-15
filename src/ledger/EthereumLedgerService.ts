import type { AgentContext, Wallet } from '@credo-ts/core'

import { AskarProfileWallet, AskarWallet } from '@credo-ts/askar'
import { CredoError, DidRepository, TypedArrayEncoder, WalletError, injectable, utils } from '@credo-ts/core'
import { Resolver } from 'did-resolver'
import { SigningKey } from 'ethers'
import { getResolver } from 'ethr-did-resolver'

import { EthereumModuleConfig } from '../EthereumModuleConfig'
import { EthereumSchemaRegistry } from '../schema/EthereumSchemaRegistry'
import { buildSchemaResource, uploadSchemaFile } from '../utils/schemaHelper'
import { getPreferredKey, parseAddress } from '../utils/utils'

/**
 * Custom error classes for better error handling
 */
export class EthereumLedgerError extends CredoError {
  public constructor(message: string, cause?: Error) {
    super(message, { cause })
    this.name = 'EthereumLedgerError'
  }
}

export class SchemaCreationError extends EthereumLedgerError {
  public constructor(reason: string, cause?: Error) {
    super(`Schema creation failed. Reason: ${reason}`, cause)
    this.name = 'SchemaCreationError'
  }
}

export class SchemaRetrievalError extends EthereumLedgerError {
  public constructor(schemaId: string, reason: string, cause?: Error) {
    super(`Schema retrieval failed for Schema ID: ${schemaId}. Reason: ${reason}`, cause)
    this.name = 'SchemaRetrievalError'
  }
}

export interface SchemaCreationResult {
  did: string
  schemaId: string
  schemaTxnHash?: string
}
export interface SchemaCreateOptions {
  did: string
  schemaName: string
  schema: object
}

@injectable()
export class EthereumLedgerService {
  public readonly rpcUrl: string | undefined
  private readonly schemaManagerContractAddress: string | undefined
  private readonly fileServerToken: string | undefined
  private readonly fileServerUrl: string | undefined
  public readonly resolver: Resolver
  public constructor(config: EthereumModuleConfig) {
    this.resolver = new Resolver(getResolver(config.config))
    this.rpcUrl = config.rpcUrl
    this.schemaManagerContractAddress = config.schemaManagerContractAddress
    this.fileServerToken = config.fileServerToken
    this.fileServerUrl = config.serverUrl
  }

  /**
   * Creates a schema on the Ethereum ledger
   */
  public async createSchema(
    agentContext: AgentContext,
    { did, schemaName, schema }: SchemaCreateOptions
  ): Promise<SchemaCreationResult> {
    if (!this.schemaManagerContractAddress || !this.rpcUrl || !this.fileServerUrl || !this.fileServerToken) {
      throw new SchemaCreationError(
        'schemaManagerContractAddress, rpcUrl, fileServeUrl and fileServerToken must be defined and not empty'
      )
    }
    // Validate inputs
    if (!did?.trim()) {
      throw new SchemaCreationError('DID is required and cannot be empty')
    }
    if (!schemaName?.trim()) {
      throw new SchemaCreationError('Schema name is required and cannot be empty')
    }
    if (!schema || Object.keys(schema).length === 0) {
      throw new SchemaCreationError('Schema must be a valid object and not empty')
    }

    agentContext.config.logger.info(`Creating schema on ledger: ${did}`)

    try {
      const keyResult = await this.getPublicKeyFromDid(agentContext, did)

      if (!keyResult.publicKeyBase58) {
        throw new CredoError('Public Key not found in wallet')
      }

      const signingKey = await this.getSigningKey(agentContext.wallet, keyResult.publicKeyBase58)

      const ethSchemaRegistry = new EthereumSchemaRegistry({
        contractAddress: this.schemaManagerContractAddress,
        rpcUrl: this.rpcUrl,
        signingKey: signingKey,
      })

      const schemaId = utils.uuid()
      const address = parseAddress(keyResult.blockchainAccountId)
      const schemaResource = await buildSchemaResource(did, schemaId, schemaName, schema, address)

      // Create schema on blockchain and upload to file server in parallel
      const [blockchainResponse, uploadResponse] = await Promise.allSettled([
        ethSchemaRegistry.createSchema(schemaId, JSON.stringify(schemaResource)),
        uploadSchemaFile(schemaId, schema, this.fileServerUrl, this.fileServerToken),
      ])

      // Handle blockchain response
      if (blockchainResponse.status === 'rejected') {
        // Detect insufficient funds error
        const reason = blockchainResponse.reason
        const errMsg = (reason?.message || reason?.toString() || '').toLowerCase()
        if (errMsg.includes('insufficient funds') || errMsg.includes('insufficient balance')) {
          throw new SchemaCreationError('Insufficient funds to pay for gas fees', reason)
        }
        throw new SchemaCreationError('Blockchain transaction failed', blockchainResponse.reason)
      }

      // Handle file server response
      if (uploadResponse.status === 'rejected') {
        agentContext.config.logger.warn(
          `File server upload failed for schema ${schemaId}: ${uploadResponse.reason?.message || 'Unknown error'}`
        )
        // Continue execution as file server upload is not critical
      }

      const result = blockchainResponse.value
      if (!result.hash) {
        throw new SchemaCreationError('Invalid response from blockchain')
      }

      const response: SchemaCreationResult = {
        did,
        schemaId,
        schemaTxnHash: result.hash,
      }

      agentContext.config.logger.info(`Successfully created schema on ledger for DID: ${did}`)

      return response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error instanceof EthereumLedgerError) {
        throw error
      }

      // Wrap other errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      agentContext.config.logger.error(`Schema creation failed for DID: ${did}`, error)
      throw new SchemaCreationError(errorMessage, error instanceof Error ? error : undefined)
    }
  }

  public async getSchemaByDidAndSchemaId(agentContext: AgentContext, did: string, schemaId: string) {
    // Validate inputs
    if (!did?.trim()) {
      throw new SchemaRetrievalError(schemaId, 'DID is required and cannot be empty')
    }
    if (!schemaId?.trim()) {
      throw new SchemaRetrievalError(schemaId, 'Schema ID is required and cannot be empty')
    }

    agentContext.config.logger.info(`Getting schema from ledger: ${did} and schemaId: ${schemaId}`)
    try {
      if (!this.schemaManagerContractAddress || !this.rpcUrl) {
        throw new SchemaCreationError('schemaManagerContractAddress and rpcUrl must be defined and not empty')
      }
      const ethSchemaRegistry = new EthereumSchemaRegistry({
        contractAddress: this.schemaManagerContractAddress,
        rpcUrl: this.rpcUrl,
      })

      const keyResult = await this.getPublicKeyFromDid(agentContext, did)
      const address = parseAddress(keyResult.blockchainAccountId)
      const response = await ethSchemaRegistry.getSchemaById(address, schemaId)

      if (!response) {
        throw new SchemaRetrievalError(schemaId, 'Schema not found on ledger')
      }
      return response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error instanceof EthereumLedgerError) {
        throw error
      }
      // Wrap other errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      agentContext.config.logger.error(`Schema retrieval failed for DID: ${did}, Schema ID: ${schemaId}`, error)
      throw new SchemaRetrievalError(schemaId, errorMessage, error instanceof Error ? error : undefined)
    }
  }

  private async getSigningKey(wallet: Wallet, publicKeyBase58: string): Promise<SigningKey> {
    if (!(wallet instanceof AskarWallet) && !(wallet instanceof AskarProfileWallet)) {
      throw new CredoError('Incorrect wallet type: Ethereum Module currently only supports Askar wallet')
    }

    const keyEntry = await wallet.withSession(async (session) => await session.fetchKey({ name: publicKeyBase58 }))

    if (!keyEntry) {
      throw new WalletError('Key not found in wallet')
    }

    const signingKey = new SigningKey(keyEntry.key.secretBytes)

    keyEntry.key.handle.free()

    return signingKey
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

    const blockchainAccountId = getPreferredKey(didRecord.didDocument.verificationMethod)

    const keyObj = didRecord.didDocument.verificationMethod.find((obj) => obj.publicKeyHex)

    if (!keyObj || !keyObj.publicKeyHex) {
      throw new CredoError('Public Key hex not found in wallet for did: ' + did)
    }

    const publicKey = TypedArrayEncoder.fromHex(keyObj.publicKeyHex)

    const publicKeyBase58 = TypedArrayEncoder.toBase58(publicKey)

    return { publicKeyBase58, blockchainAccountId }
  }

  public async resolveDID(did: string) {
    return await this.resolver.resolve(did)
  }
}
