import type { ContractTransactionReceipt } from 'ethers'

import { utils } from '@credo-ts/core'
import { ethers, SigningKey, Wallet } from 'ethers'
import { beforeAll, describe, expect, it } from 'vitest'

import { EthereumSchemaRegistry } from '../src/schema/EthereumSchemaRegistry'
import { ContractError, ValidationError } from '../src/schema/types/EthereumSchemaRegistry.types'

import { testSchemaSample } from './fixtures'
import { requireEnv, runLedgerWriteTests, SEPOLIA_RPC_URL } from './utils'

const SCHEMA_CONTRACT_ADDRESS =
  process.env.SCHEMA_MANAGER_CONTRACT_ADDRESS ?? '0x70F88e12EaE54548839f320A5958C49421512A84'
const schemaJSON = JSON.stringify(testSchemaSample)
const SAMPLE_ADDRESS = '0x4A09b8CB511cca4Ca1c5dB0475D0e07bFc96EF49'

// ---- Offline: input validation / error paths (always run; no ledger transaction needed) ----
describe('EthereumSchemaRegistry input validation', () => {
  let client: EthereumSchemaRegistry

  beforeAll(() => {
    // Ephemeral random key + a valid-format address. No RPC call happens on these paths —
    // each method validates its arguments before touching the contract.
    client = new EthereumSchemaRegistry({
      signingKey: new SigningKey(Wallet.createRandom().privateKey),
      rpcUrl: 'http://localhost:8545',
      contractAddress: SCHEMA_CONTRACT_ADDRESS,
    })
  })

  it('throws ValidationError for an invalid schema ID', async () => {
    await expect(client.createSchema('', schemaJSON)).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for invalid JSON', async () => {
    await expect(client.createSchema(utils.uuid(), 'invalid-json')).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an invalid owner address on lookup', async () => {
    await expect(client.getSchemaById('invalid-address', utils.uuid())).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an empty schema ID on lookup', async () => {
    await expect(client.getSchemaById(SAMPLE_ADDRESS, '')).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an invalid target address on adminCreateSchema', async () => {
    await expect(client.adminCreateSchema('invalid-address', utils.uuid(), schemaJSON)).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError for an invalid new owner on transferOwnership', async () => {
    await expect(client.transferOwnership('invalid-address')).rejects.toThrow(ValidationError)
  })
})

// ---- On-chain (opt-in): real Sepolia transactions with a funded key ----
const describeIfWrite = runLedgerWriteTests ? describe : describe.skip

describeIfWrite('EthereumSchemaRegistry on-chain (e2e)', () => {
  let client: EthereumSchemaRegistry
  let wallet: ethers.Wallet
  let testSchemaId: string

  const expectValidReceipt = (receipt: ContractTransactionReceipt) =>
    expect(receipt).toEqual(expect.objectContaining({ hash: expect.any(String), status: 1 }))

  beforeAll(() => {
    requireEnv('SEPOLIA_RPC_URL', 'SCHEMA_TEST_PRIVATE_KEY')
    const signingKey = new SigningKey(process.env.SCHEMA_TEST_PRIVATE_KEY as string)
    client = new EthereumSchemaRegistry({
      signingKey,
      rpcUrl: SEPOLIA_RPC_URL,
      contractAddress: SCHEMA_CONTRACT_ADDRESS,
    })
    wallet = new ethers.Wallet(signingKey, new ethers.JsonRpcProvider(SEPOLIA_RPC_URL))
    testSchemaId = utils.uuid()
  })

  it('creates a new schema', async () => {
    expectValidReceipt(await client.createSchema(testSchemaId, schemaJSON))
  })

  it('throws ContractError when the schema already exists', async () => {
    await expect(client.createSchema(testSchemaId, schemaJSON)).rejects.toThrow(ContractError)
  })

  it('retrieves the created schema by id', async () => {
    expect(await client.getSchemaById(wallet.address, testSchemaId)).toBe(schemaJSON)
  })

  it('lists the schema ids for an address', async () => {
    const ids = await client.getSchemaIds(wallet.address)
    expect(Array.isArray(ids)).toBe(true)
    expect(ids.every((id) => typeof id === 'string')).toBe(true)
  })

  it('returns null for a non-existent schema', async () => {
    expect(await client.getSchemaById(wallet.address, utils.uuid())).toBeNull()
  })
})

// ---- Admin / owner (opt-in): requires the deployed contract's OWNER key ----
const describeIfAdmin = runLedgerWriteTests ? describe : describe.skip

describeIfAdmin('EthereumSchemaRegistry admin (e2e, contract owner)', () => {
  let admin: EthereumSchemaRegistry
  let ownerWallet: ethers.Wallet

  beforeAll(() => {
    requireEnv('SEPOLIA_RPC_URL', 'SCHEMA_ADMIN_PRIVATE_KEY')
    const signingKey = new SigningKey(process.env.SCHEMA_ADMIN_PRIVATE_KEY as string)
    admin = new EthereumSchemaRegistry({
      signingKey,
      rpcUrl: SEPOLIA_RPC_URL,
      contractAddress: SCHEMA_CONTRACT_ADDRESS,
    })
    ownerWallet = new ethers.Wallet(signingKey, new ethers.JsonRpcProvider(SEPOLIA_RPC_URL))
  })

  it('returns the contract owner address', async () => {
    expect(await admin.getOwner()).toBe(ownerWallet.address)
  })

  it('admin creates a schema for another address', async () => {
    const other = ethers.Wallet.createRandom()
    expect(await admin.adminCreateSchema(other.address, utils.uuid(), schemaJSON)).toEqual(
      expect.objectContaining({ status: 1 })
    )
  })
})
