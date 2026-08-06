import type { EthereumAgentModules } from './utils'
import type { EthereumDidCreateOptions } from '../src/dids'
import type { Agent } from '@credo-ts/core'

import { TypedArrayEncoder } from '@credo-ts/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { EthereumLedgerError, SchemaCreationError, SchemaRetrievalError } from '../src/ledger/EthereumLedgerService'

import { testSchemaSample } from './fixtures'
import { getEthereumAgent, hasE2eEnv } from './utils'

// All schema operations write to / read from the Ethereum ledger and the schema file server,
// so the whole suite requires a real RPC (and a funded key). Skipped unless SEPOLIA_RPC_URL is set.
const describeIfE2e = hasE2eEnv ? describe : describe.skip

describeIfE2e('Schema Operations (e2e)', () => {
  let faberAgent: Agent<EthereumAgentModules>
  const privateKey = TypedArrayEncoder.fromHex('89d6e6df0272c4262533f951d0550ecd9f444ec2e13479952e4cc6982febfed6')
  let did: string
  let schemaId: string

  beforeAll(async () => {
    faberAgent = getEthereumAgent('faber')
    await faberAgent.initialize()
    const createdDid = await faberAgent.dids.create<EthereumDidCreateOptions>({
      method: 'ethr',
      options: { network: 'sepolia' },
      secret: { privateKey },
    })
    did =
      createdDid.didState.did || 'did:ethr:sepolia:0x022527341df022c9b898999cf6035ed3addca5d30e703028deeb4408f890f3baca'
  })

  afterAll(async () => {
    if (faberAgent) await faberAgent.shutdown()
  })

  describe('Schema Creation', () => {
    it('should create w3c schema successfully', async () => {
      const response = await faberAgent.modules.ethereum.createSchema({
        did,
        schemaName: 'TestCollegeSchema',
        schema: testSchemaSample,
      })
      schemaId = response.schemaId

      expect(response).toBeDefined()
      expect(response.schemaId).toBeDefined()
      expect(typeof response.schemaId).toBe('string')
      expect(response.schemaTxnHash).toBeDefined()
    })

    it('should handle schema creation with invalid data', async () => {
      await expect(
        faberAgent.modules.ethereum.createSchema({ did, schemaName: '', schema: testSchemaSample })
      ).rejects.toThrow(SchemaCreationError)

      await expect(
        faberAgent.modules.ethereum.createSchema({ did, schemaName: 'InvalidSchema', schema: {} })
      ).rejects.toThrow(SchemaCreationError)
    })

    it('should handle schema creation with invalid DID', async () => {
      const nonExistentDid = 'did:ethr:sepolia:0x1111111111111111111111111111111111111111'
      await expect(
        faberAgent.modules.ethereum.createSchema({
          did: nonExistentDid,
          schemaName: 'TestSchema',
          schema: testSchemaSample,
        })
      ).rejects.toThrow(EthereumLedgerError)
    })
  })

  describe('Create Existing Schema', () => {
    it('should throw if schemaId is empty', async () => {
      await expect(faberAgent.modules.ethereum.createExistingSchema({ did, schemaId: '' })).rejects.toThrow(
        'Schema Id is required'
      )
    })

    it('should throw if DID is empty', async () => {
      await expect(
        faberAgent.modules.ethereum.createExistingSchema({ did: '', schemaId: 'schema:example:1' })
      ).rejects.toThrow('DID is required')
    })

    it('should fail if schema does not exist on file server', async () => {
      await expect(
        faberAgent.modules.ethereum.createExistingSchema({ did, schemaId: 'non-existent-schema-id' })
      ).rejects.toThrow('not found on file server')
    })
  })

  describe('Schema Retrieval', () => {
    it('should retrieve created schemas by ID', async () => {
      const retrievedSchema = await faberAgent.modules.ethereum.getSchemaById(did, schemaId)
      expect(retrievedSchema).toBeDefined()
      expect(typeof JSON.parse(retrievedSchema)).toBe('object')
    })

    it('should handle retrieval of non-existent schema', async () => {
      await expect(faberAgent.modules.ethereum.getSchemaById(did, 'non-existent-schema-id')).rejects.toThrow(
        SchemaRetrievalError
      )
    })
  })
})
