import type { SchemaRegistryConfig } from '../src/schema/types/EthereumSchemaRegistry.types'
import type { ContractTransactionReceipt } from 'ethers'

import { utils } from '@credo-ts/core'
import { ethers, SigningKey } from 'ethers'
import { beforeAll, describe, expect, it } from 'vitest'

import { EthereumSchemaRegistry } from '../src/schema/EthereumSchemaRegistry'
import { ContractError, ValidationError } from '../src/schema/types/EthereumSchemaRegistry.types'

import { testSchemaSample } from './fixtures'
import { hasE2eEnv, SEPOLIA_RPC_URL } from './utils'

// These talk to a live schema-registry contract on Sepolia and need funded signing keys,
// so they only run when SEPOLIA_RPC_URL is provided.
const describeIfE2e = hasE2eEnv ? describe : describe.skip

const SCHEMA_CONTRACT_ADDRESS =
  process.env.SCHEMA_MANAGER_CONTRACT_ADDRESS ?? '0x70F88e12EaE54548839f320A5958C49421512A84'

let schemaJSON: string
let provider: ethers.JsonRpcProvider
let wallet: ethers.Wallet

const expectValidTransactionReceipt = (receipt: ContractTransactionReceipt, expectedStatus: number = 1) => {
  expect(receipt).toEqual(
    expect.objectContaining({
      hash: expect.any(String),
      blockNumber: expect.any(Number),
      blockHash: expect.any(String),
      gasUsed: expect.any(BigInt),
      gasPrice: expect.any(BigInt),
      status: expectedStatus,
    })
  )
}

describeIfE2e('Client Schema Management (e2e):', () => {
  let client: EthereumSchemaRegistry
  let testSchemaId: string
  beforeAll(async () => {
    schemaJSON = JSON.stringify(testSchemaSample)
    const schemaRegistryConfig: SchemaRegistryConfig = {
      signingKey: new SigningKey(
        process.env.SCHEMA_TEST_PRIVATE_KEY ?? '0x3f6254328fa58202094c954d89964119830f85e2f4bfdbabb1d8bcfc008d2fdd'
      ),
      rpcUrl: SEPOLIA_RPC_URL,
      contractAddress: SCHEMA_CONTRACT_ADDRESS,
    }
    client = new EthereumSchemaRegistry(schemaRegistryConfig)

    testSchemaId = utils.uuid()
    provider = new ethers.JsonRpcProvider(schemaRegistryConfig.rpcUrl)

    if (schemaRegistryConfig.signingKey) {
      wallet = new ethers.Wallet(schemaRegistryConfig.signingKey, provider)
    }
  })
  it('client should successfully create a new schema', async () => {
    const tx = await client.createSchema(testSchemaId, schemaJSON)
    expectValidTransactionReceipt(tx, 1)
  })

  it('should throw ValidationError for invalid schema ID', async () => {
    await expect(client.createSchema('', schemaJSON)).rejects.toThrow(ValidationError)
  })

  it('should throw ValidationError for invalid JSON', async () => {
    const newSchemaId = utils.uuid()
    await expect(client.createSchema(newSchemaId, 'invalid-json')).rejects.toThrow(ValidationError)
  })

  it('should throw ContractError when schema already exists', async () => {
    await expect(client.createSchema(testSchemaId, schemaJSON)).rejects.toThrow(ContractError)
  })

  it('should retrieve the schema by id', async () => {
    const retrieved = await client.getSchemaById(wallet.address, testSchemaId)
    expect(retrieved).toBe(schemaJSON)
  })

  it('should retrieve the list of schema Id', async () => {
    const result = await client.getSchemaIds(wallet.address)
    expect(Array.isArray(result)).toBe(true)
    expect(result.every((id) => typeof id === 'string')).toBe(true)
  })

  it('should return null when schema does not exist', async () => {
    const newSchemaId = utils.uuid()
    const result = await client.getSchemaById(wallet.address, newSchemaId)
    expect(result).toBeNull()
  })

  it('should throw ValidationError for invalid address', async () => {
    await expect(client.getSchemaById('invalid-address', testSchemaId)).rejects.toThrow(ValidationError)
  })

  it('should throw ValidationError for empty schema ID', async () => {
    await expect(client.getSchemaById(wallet.address, '')).rejects.toThrow(ValidationError)
  })

  it('should throw ContractError when not owner', async () => {
    const newSchemaId = utils.uuid()
    await expect(client.adminCreateSchema(wallet.address, newSchemaId, schemaJSON)).rejects.toThrow(ContractError)
  })
})

describeIfE2e('Admin Schema Management (e2e):', () => {
  let admin: EthereumSchemaRegistry
  let testSchemaId: string
  const otherWallet = ethers.Wallet.createRandom().connect(provider)

  beforeAll(async () => {
    schemaJSON = JSON.stringify(testSchemaSample)
    const schemaRegistryAdminConfig = {
      signingKey: new SigningKey(
        process.env.SCHEMA_ADMIN_PRIVATE_KEY ?? '0xc0fe3af6dc7188d1badd556303c8e3f1d60c19df3d84a380a16335a2d9a9c65e'
      ),
      rpcUrl: SEPOLIA_RPC_URL,
      contractAddress: SCHEMA_CONTRACT_ADDRESS,
    }
    admin = new EthereumSchemaRegistry(schemaRegistryAdminConfig)
    testSchemaId = utils.uuid()
    provider = new ethers.JsonRpcProvider(schemaRegistryAdminConfig.rpcUrl)
    if (schemaRegistryAdminConfig.signingKey) {
      wallet = new ethers.Wallet(schemaRegistryAdminConfig.signingKey, provider)
    }
  })

  it('should allow admin to create schema for other addresses', async () => {
    const tx = await admin.adminCreateSchema(otherWallet.address, testSchemaId, schemaJSON)
    expectValidTransactionReceipt(tx, 1)
  })

  it('should allow admin to retrieve the schema by id for other address', async () => {
    const retrieved = await admin.getSchemaById(otherWallet.address, testSchemaId)
    expect(retrieved).toBe(schemaJSON)
  })

  it('should throw ContractError when schema already exists for the address', async () => {
    await expect(admin.adminCreateSchema(otherWallet.address, testSchemaId, schemaJSON)).rejects.toThrow(ContractError)
  })

  it('should throw ValidationError for invalid target address', async () => {
    const newSchemaId = utils.uuid()
    await expect(admin.adminCreateSchema('invalid-address', newSchemaId, schemaJSON)).rejects.toThrow(ValidationError)
  })

  it('should throw ValidationError for invalid new owner address', async () => {
    await expect(admin.transferOwnership('invalid-address')).rejects.toThrow(ValidationError)
  })

  it('should return contract owner address', async () => {
    const owner = await admin.getOwner()
    expect(owner).toBe(wallet.address)
  })
})
