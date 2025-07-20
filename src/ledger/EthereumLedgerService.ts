import type { AgentContext, DidDocument, Wallet } from '@credo-ts/core'

import { AskarProfileWallet, AskarWallet } from '@credo-ts/askar'
import { CredoError, DidRepository, WalletError, injectable } from '@credo-ts/core'
import { Resolver } from 'did-resolver'
import { SigningKey } from 'ethers'
import { getResolver } from 'ethr-did-resolver'

import { EthereumModuleConfig } from '../EthereumModuleConfig'

import { PolygonSchema } from 'src/schema/schemaManager'

interface SchemaRegistryConfig {
  didRegistrarContractAddress: string
  rpcUrl: string
  fileServerToken: string
  privateKey: string
  schemaManagerContractAddress: string
  serverUrl: string
}

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
  public rpcUrl: string | undefined
  private didContractAddress: string | undefined
  private schemaManagerContractAddress: string | undefined
  private fileServerToken: string | undefined
  private fileServerUrl: string | undefined
  public readonly resolver: Resolver
  public constructor({ config }: EthereumModuleConfig) {
    this.resolver = new Resolver(getResolver(config))
  }

  public async createSchema(
    agentContext: AgentContext,
    { did, schemaName, schema }: { did: string; schemaName: string; schema: object }
  ) {
    const publicKeyBase = await this.getPublicKeyFromDid(agentContext, did)

    if (!publicKeyBase) {
      throw new CredoError('Public Key not found in wallet')
    }

    const signingKey = await this.getSigningKey(agentContext.wallet, publicKeyBase)

    const schemaRegistry = this.createSchemaRegistryInstance(signingKey)

    agentContext.config.logger.info(`Creating schema on ledger: ${did}`)

    const response = await schemaRegistry.createSchema(did, schemaName, schema)
    if (!response) {
      agentContext.config.logger.error(`Schema creation failed for did: ${did} and schema: ${schema}`)
      throw new CredoError(`Schema creation failed for did: ${did} and schema: ${schema}`)
    }
    agentContext.config.logger.info(`Published schema on ledger: ${did}`)
    return response
  }

  public async getSchemaByDidAndSchemaId(agentContext: AgentContext, did: string, schemaId: string) {
    agentContext.config.logger.info(`Getting schema from ledger: ${did} and schemaId: ${schemaId}`)

    const publicKeyBase58 = await this.getPublicKeyFromDid(agentContext, did)

    if (!publicKeyBase58) {
      throw new CredoError('Public Key not found in wallet')
    }

    const signingKey = await this.getSigningKey(agentContext.wallet, publicKeyBase58)

    const schemaRegistry = this.createSchemaRegistryInstance(signingKey)

    const response = await schemaRegistry.getSchemaById(did, schemaId)

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
    if (
      !this.rpcUrl ||
      !this.schemaManagerContractAddress ||
      !this.fileServerToken ||
      !this.fileServerUrl ||
      !this.didContractAddress
    ) {
      throw new CredoError('Ethereum schema module config not found')
    }

    return new PolygonSchema({
      rpcUrl: this.rpcUrl,
      didRegistrarContractAddress: this.didContractAddress,
      schemaManagerContractAddress: this.schemaManagerContractAddress,
      fileServerToken: this.fileServerToken,
      serverUrl: this.fileServerUrl,
      signingKey,
    })
  }

  private async getSigningKey(wallet: Wallet, publicKey: string): Promise<SigningKey> {
    if (!(wallet instanceof AskarWallet) && !(wallet instanceof AskarProfileWallet)) {
      throw new CredoError('Incorrect wallet type: Ethereum Module currently only supports Askar wallet')
    }

    const keyEntry = await wallet.withSession(async (session) => await session.fetchKey({ name: publicKey }))

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

    // eslint-disable-next-line no-prototype-builtins
    const keyObj = didRecord.didDocument.verificationMethod.find((obj) => obj.hasOwnProperty('publicKeyHex'))
    const publicKey = keyObj ? keyObj.publicKeyHex : undefined

    // const publicKeyBase58 = didRecord.didDocument.verificationMethod[0].publicKeyBase58

    return publicKey
  }

  public updateModuleConfig({
    didRegistrarContractAddress,
    fileServerToken,
    rpcUrl,
    schemaManagerContractAddress,
    serverUrl,
  }: SchemaRegistryConfig) {
    this.rpcUrl = rpcUrl
    this.didContractAddress = didRegistrarContractAddress
    this.schemaManagerContractAddress = schemaManagerContractAddress
    this.fileServerToken = fileServerToken
    this.fileServerUrl = serverUrl
  }

  public async resolveDID(did: string) {
    return await this.resolver.resolve(did)
  }
}
