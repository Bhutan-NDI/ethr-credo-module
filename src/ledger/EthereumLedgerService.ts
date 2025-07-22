import type { AgentContext, DidDocument, Wallet } from '@credo-ts/core'

import { AskarProfileWallet, AskarWallet } from '@credo-ts/askar'
import { CredoError, DidRepository, WalletError, injectable } from '@credo-ts/core'
import { Resolver } from 'did-resolver'
import { SigningKey } from 'ethers'
import { getResolver } from 'ethr-did-resolver'

import { EthereumModuleConfig } from '../EthereumModuleConfig'
import { EthrSchema } from '../schema/schemaManager'
import { convertHexToBase58, getPreferredKey } from '../utils/utils'

// interface SchemaRegistryConfig {
//   didRegistrarContractAddress: string
//   rpcUrl: string
//   fileServerToken: string
//   privateKey: string
//   schemaManagerContractAddress: string
//   serverUrl: string
// }

export type CreateDidOperationOptions = {
  operation: DidOperation.Create
  serviceEndpoint?: string
}

export type UpdateDidOperationOptions = {
  operation: DidOperation.Update
  didDocument: DidDocument
  did: string
}

export type DeactivateDidOperationOptions = {
  operation: DidOperation.Deactivate
  did: string
}

export type AddResourceDidOperationOptions = {
  operation: DidOperation.AddResource
  resourceId: string
  resource: object
  did: string
}

export enum DidOperation {
  Create = 'createDID',
  Update = 'updateDIDDoc',
  Deactivate = 'deactivate',
  AddResource = 'addResource',
}

export type DidOperationOptions =
  | CreateDidOperationOptions
  | UpdateDidOperationOptions
  | DeactivateDidOperationOptions
  | AddResourceDidOperationOptions

export type SchemaOperationOptions = CreateSchemaOperationOptions

export type CreateSchemaOperationOptions = {
  operation: SchemaOperation.CreateSchema
  did: string
}

export enum SchemaOperation {
  CreateSchema = 'createSchema',
}

@injectable()
export class EthereumLedgerService {
  public readonly rpcUrl: string
  private readonly schemaManagerContractAddress: string
  private readonly fileServerToken: string
  private readonly fileServerUrl: string
  public readonly resolver: Resolver
  public constructor(config: EthereumModuleConfig) {
    // console.log('************constructor EthereumLedgerService constructor', JSON.stringify(config))
    this.resolver = new Resolver(getResolver(config.config))
    this.rpcUrl = config.rpcUrl
    this.schemaManagerContractAddress = config.schemaManagerContractAddress
    this.fileServerToken = config.fileServerToken
    this.fileServerUrl = config.serverUrl
  }

  public async createSchema(
    agentContext: AgentContext,
    { did, schemaName, schema }: { did: string; schemaName: string; schema: object }
  ) {
    console.log('inside create schema')
    const keyResult = await this.getPublicKeyAndAddressFromDid(agentContext, did)

    // console.log('result of getPublicKeyAndAddressFromDid createSchema------', JSON.stringify(keyResult))

    if (!keyResult.publicKeyBase58) {
      throw new CredoError('Public Key not found in wallet')
    }

    const signingKey = await this.getSigningKey(agentContext.wallet, keyResult.publicKeyBase58)

    const schemaRegistry = this.createSchemaRegistryInstance(signingKey)

    agentContext.config.logger.info(`Creating schema on ledger: ${did}`)

    const response = await schemaRegistry.createSchema(did, schemaName, schema, keyResult.blockchainAccountId)
    console.log('Creating schema on ledger response', JSON.stringify(response))
    if (!response) {
      agentContext.config.logger.error(`Schema creation failed for did: ${did} and schema: ${schema}`)
      throw new CredoError(`Schema creation failed for did: ${did} and schema: ${schema}`)
    }
    agentContext.config.logger.info(`Published schema on ledger: ${did}`)
    return response
  }

  public async getSchemaByDidAndSchemaId(agentContext: AgentContext, did: string, schemaId: string) {
    agentContext.config.logger.info(`Getting schema from ledger: ${did} and schemaId: ${schemaId}`)

    const keyResult = await this.getPublicKeyAndAddressFromDid(agentContext, did)

    if (!keyResult) {
      throw new CredoError('Public Key not found in wallet')
    }

    const signingKey = await this.getSigningKey(agentContext.wallet, keyResult.publicKeyBase58)

    const schemaRegistry = this.createSchemaRegistryInstance(signingKey)

    const response = await schemaRegistry.getSchemaById(did, schemaId, keyResult.blockchainAccountId)

    if (!response) {
      agentContext.config.logger.error(`Schema not found for did: ${did} and schemaId: ${schemaId} Error: ${response}`)
      throw new CredoError(`Schema not found for did: ${did} and schemaId: ${schemaId}`)
    }
    agentContext.config.logger.info(`Got schema from ledger: ${did} and schemaId: ${schemaId}`)
    return response
  }

  // public async estimateFeeForDidOperation(agentContext: AgentContext, options: DidOperationOptions) {
  //   const keyPair = await generateSecp256k1KeyPair()

  //   const didRegistry = this.createDidRegistryInstance(new SigningKey(keyPair.privateKey))

  //   const { operation } = options

  //   if (operation === DidOperation.Create) {
  //     agentContext.config.logger.info(`Getting estimated fee for operation: ${operation} `)
  //     const did = `did:ethereum:testnet${keyPair.address}`
  //     const didDoc = getSecp256k1DidDocWithPublicKey(did, keyPair.publicKeyBase58, options?.serviceEndpoint)

  //     const response = await didRegistry.estimateTxFee(DidOperation.Create, [keyPair.address, JSON.stringify(didDoc)])
  //     return response
  //   }

  //   if (operation === DidOperation.Update) {
  //     agentContext.config.logger.info(`Getting estimated fee for operation: ${operation} `)
  //     const parsedDid = parseDid(options.did)

  //     const response = await didRegistry.estimateTxFee(
  //       DidOperation.Update,
  //       [parsedDid.didAddress, JSON.stringify(options.didDocument)],
  //       parsedDid.didAddress
  //     )
  //     return response
  //   }

  //   if (operation === DidOperation.Deactivate) {
  //     agentContext.config.logger.info(`Getting estimated fee for operation: ${operation} `)
  //     const parsedDid = parseDid(options.did)
  //     const deactivatedDidDocument = new DidDocumentBuilder(options.did)
  //       .addContext('https://www.w3.org/ns/did/v1')
  //       .build()
  //     const response = await didRegistry.estimateTxFee(
  //       DidOperation.Update,
  //       [parsedDid.didAddress, JSON.stringify(deactivatedDidDocument)],
  //       parsedDid.didAddress
  //     )
  //     return response
  //   }

  //   if (operation === DidOperation.AddResource) {
  //     agentContext.config.logger.info(`Getting estimated fee for operation: ${operation} `)
  //     const parsedDid = parseDid(options.did)
  //     const response = await didRegistry.estimateTxFee(
  //       DidOperation.AddResource,
  //       [parsedDid.didAddress, options.resourceId, JSON.stringify(options.resource)],
  //       parsedDid.didAddress
  //     )
  //     return response
  //   }
  // }

  private createSchemaRegistryInstance(signingKey: SigningKey) {
    // console.log('inside createSchemaRegistryInstance')
    // console.log('this.rpcUrl in createSchemaRegistryInstance------', this.rpcUrl)
    // console.log(
    //   'this.schemaManagerContractAddress in createSchemaRegistryInstance------',
    //   this.schemaManagerContractAddress
    // )
    // console.log('this.fileServerToken in createSchemaRegistryInstance------', this.fileServerToken)
    // console.log('this.fileServerUrl in createSchemaRegistryInstance------', this.fileServerUrl)
    if (!this.rpcUrl || !this.schemaManagerContractAddress || !this.fileServerToken || !this.fileServerUrl) {
      throw new CredoError('Ethereum schema module config not found')
    }

    return new EthrSchema({
      rpcUrl: this.rpcUrl,
      schemaManagerContractAddress: this.schemaManagerContractAddress,
      fileServerToken: this.fileServerToken,
      serverUrl: this.fileServerUrl,
      signingKey,
    })
  }

  private async getSigningKey(wallet: Wallet, publicKey?: string): Promise<SigningKey> {
    if (!(wallet instanceof AskarWallet) && !(wallet instanceof AskarProfileWallet)) {
      throw new CredoError('Incorrect wallet type: Ethereum Module currently only supports Askar wallet')
    }

    const keys = await wallet.withSession(async (session) => await session.fetchAllKeys({ limit: 3 }))

    const keyEntry = keys.find((item) => item.name === publicKey)

    // const keyEntry = await wallet.withSession(async (session) => await session.fetchKey({ name: publicKey }))

    if (!keyEntry) {
      throw new WalletError('Key not found in wallet')
    }

    const signingKey = new SigningKey(keyEntry.key.secretBytes)

    keyEntry.key.handle.free()

    return signingKey
  }

  private async getPublicKeyAndAddressFromDid(agentContext: AgentContext, did: string) {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    const didRecord = await didRepository.findCreatedDid(agentContext, did)
    if (!didRecord) {
      throw new CredoError('DidRecord not found')
    }

    if (!didRecord.didDocument?.verificationMethod) {
      throw new CredoError('VerificationMethod not found cannot get public key')
    }

    console.log('In getPublicKeyAndAddressFromDid verificationMethod------', JSON.stringify(didRecord.didDocument))
    const blockchainAccountId = getPreferredKey(didRecord.didDocument.verificationMethod)

    // eslint-disable-next-line no-prototype-builtins
    const keyObj = didRecord.didDocument.verificationMethod.find((obj) => obj.hasOwnProperty('publicKeyHex'))
    const publicKey = keyObj ? keyObj.publicKeyHex : undefined

    // console.log('publicKey------', publicKey)

    // const publicKeyBase58 = didRecord.didDocument.verificationMethod[0].publicKeyBase58

    const publicKeyBase58 = publicKey ? convertHexToBase58(publicKey) : undefined
    // console.log('publicKeyBase58 in getPublicKeyFromDid------', publicKeyBase58)

    return { publicKeyBase58, blockchainAccountId }
  }

  // public updateModuleConfig({
  //   didRegistrarContractAddress,
  //   fileServerToken,
  //   rpcUrl,
  //   schemaManagerContractAddress,
  //   serverUrl,
  // }: SchemaRegistryConfig) {
  //   this.rpcUrl = rpcUrl
  //   this.didContractAddress = didRegistrarContractAddress
  //   this.schemaManagerContractAddress = schemaManagerContractAddress
  //   this.fileServerToken = fileServerToken
  //   this.fileServerUrl = serverUrl
  // }

  public async resolveDID(did: string) {
    return await this.resolver.resolve(did)
  }
}
