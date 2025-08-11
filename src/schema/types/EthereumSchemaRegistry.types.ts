import type { SigningKey } from 'ethers'

export interface SchemaRegistryConfig {
  contractAddress: string
  rpcUrl: string
  signingKey?: SigningKey
}

// Custom error classes
export class SchemaRegistryError extends Error {
  public constructor(message: string, public code?: string, public originalError?: Error) {
    super(message)
    this.name = 'SchemaRegistryError'
  }
}

export class ContractError extends SchemaRegistryError {
  public constructor(message: string, public revertReason?: string, originalError?: Error) {
    super(message, 'CONTRACT_ERROR', originalError)
    this.name = 'ContractError'
  }
}

export class NetworkError extends SchemaRegistryError {
  public constructor(message: string, originalError?: Error) {
    super(message, 'NETWORK_ERROR', originalError)
    this.name = 'NetworkError'
  }
}

export class ValidationError extends SchemaRegistryError {
  public constructor(message: string, originalError?: Error) {
    super(message, 'VALIDATION_ERROR', originalError)
    this.name = 'ValidationError'
  }
}

export type ResourcePayload = {
  resourceURI: string
  resourceCollectionId: string
  resourceId: string
  resourceName: string
  resourceType: string
  mediaType: string
  created: string
  checksum: string
  previousVersionId: string | null
  nextVersionId: string | null
}
