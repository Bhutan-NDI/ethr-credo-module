import type { SchemaRegistryConfig } from './types/EthereumSchemaRegistry.types'
import type { ContractTransactionReceipt } from 'ethers'

import { Contract, isAddress, JsonRpcProvider, Wallet } from 'ethers'

import abi from '../abi/SchemaRegistry.json'

import { ContractError, NetworkError, ValidationError } from './types/EthereumSchemaRegistry.types'

export class EthereumSchemaRegistry {
  private provider: JsonRpcProvider
  private wallet?: Wallet
  private schemaRegistryContract: Contract

  public constructor(config: SchemaRegistryConfig) {
    this.validateConfig(config)

    try {
      this.provider = new JsonRpcProvider(config.rpcUrl)

      if (config.signingKey) {
        this.wallet = new Wallet(config.signingKey, this.provider)
        this.schemaRegistryContract = new Contract(config.contractAddress, abi, this.wallet)
      } else {
        this.schemaRegistryContract = new Contract(config.contractAddress, abi, this.provider)
      }
    } catch (error) {
      throw new NetworkError(
        `Failed to initialize EthereumSchemaManager: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error as Error
      )
    }
  }

  private validateConfig(config: SchemaRegistryConfig): void {
    if (!config.contractAddress || !isAddress(config.contractAddress)) {
      throw new ValidationError('Invalid contract address')
    }
    if (!config.rpcUrl) {
      throw new ValidationError('RPC URL is required')
    }
    if (!config.signingKey) {
      throw new ValidationError('Signing Key is required')
    }
  }

  /**
   * Create a new schema (requires wallet)
   */
  public async createSchema(schemaId: string, json: string): Promise<ContractTransactionReceipt> {
    if (!this.wallet) {
      throw new ValidationError('Wallet is required for transaction operations')
    }
    this.validateSchemaId(schemaId)
    this.validateJson(json)

    try {
      const schemaTxn = await this.schemaRegistryContract.createSchema(schemaId, json)
      const schemaTxnReceipt = await schemaTxn.wait()
      return schemaTxnReceipt
    } catch (error) {
      return await this.handleContractError(error)
    }
  }

  /**
   * Create a schema for another address (admin only, requires wallet)
   */
  public async adminCreateSchema(address: string, schemaId: string, json: string): Promise<ContractTransactionReceipt> {
    if (!this.wallet) {
      throw new ValidationError('Wallet is required for transaction operations')
    }
    this.validateAddress(address)
    this.validateSchemaId(schemaId)
    this.validateJson(json)

    try {
      const schemaTxn = await this.schemaRegistryContract.adminCreateSchema(address, schemaId, json)
      const schemaTxnReceipt = await schemaTxn.wait()
      return schemaTxnReceipt
    } catch (error) {
      return await this.handleContractError(error)
    }
  }

  /**
   * Get a schema by owner address and schema ID
   */
  public async getSchema(address: string, schemaId: string): Promise<string | null> {
    this.validateAddress(address)
    this.validateSchemaId(schemaId)

    try {
      const schema = await this.schemaRegistryContract.schemas(address, schemaId)
      if (!schema || schema.trim().length === 0) {
        return null
      }
      return schema
    } catch (error) {
      return await this.handleContractError(error)
    }
  }

  /**
   * Get list of schema Id by address
   */
  public async getSchemaIds(address: string): Promise<string[]> {
    this.validateAddress(address)

    try {
      const schemaIds = await this.schemaRegistryContract.getSchemaIds(address)
      return schemaIds
    } catch (error) {
      return await this.handleContractError(error)
    }
  }

  /**
   * Get the current contract owner
   */
  public async getOwner(): Promise<string> {
    try {
      const owner = await this.schemaRegistryContract.owner()
      return owner
    } catch (error) {
      return await this.handleContractError(error)
    }
  }

  /**
   * Transfer contract ownership (admin only, requires wallet)
   */
  public async transferOwnership(newOwner: string): Promise<ContractTransactionReceipt> {
    if (!this.wallet) {
      throw new ValidationError('Wallet is required for transaction operations')
    }

    this.validateAddress(newOwner)

    try {
      const tx = await this.schemaRegistryContract.transferOwnership(newOwner)
      const receipt = await tx.wait()

      return receipt
    } catch (error) {
      return await this.handleContractError(error)
    }
  }

  private validateSchemaId(schemaId: string): void {
    if (!schemaId || schemaId.trim().length === 0) {
      throw new ValidationError('Schema ID cannot be empty')
    }
    if (schemaId.length > 256) {
      throw new ValidationError('Schema ID too long (max 256 characters)')
    }
  }

  private validateJson(json: string): void {
    if (!json || json.trim().length === 0) {
      throw new ValidationError('JSON cannot be empty')
    }
    try {
      JSON.parse(json)
    } catch {
      throw new ValidationError('Invalid JSON format')
    }
  }

  private validateAddress(address: string): void {
    if (!address || !isAddress(address)) {
      throw new ValidationError('Invalid address')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleContractError(error: any): Promise<never> {
    if (error.reason) {
      switch (error.reason) {
        case 'SCHEMA_EXISTS':
          throw new ContractError('Schema already exists for this address and schema ID', error.reason, error)
        case 'NOT_OWNER':
          throw new ContractError('Only contract owner can perform this action', error.reason, error)
        default:
          throw new ContractError(`Contract error: ${error.reason}`, error.reason, error)
      }
    }

    if (error.code === 'NETWORK_ERROR') {
      throw new NetworkError(`Network error: ${error.message}`, error)
    }

    throw new ContractError(`Transaction failed: ${error.message}`, undefined, error)
  }
}
