import type { EthereumDidCreateOptions } from '../src/dids'
import type { EncryptedMessage } from '@credo-ts/core'

import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, DidsModule, LogLevel, TypedArrayEncoder, utils } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { Subject } from 'rxjs'

import { EthereumModule } from '../src/EthereumModule'
import { EthereumDidRegistrar, EthereumDidResolver } from '../src/dids'
import { EthereumLedgerError, SchemaCreationError, SchemaRetrievalError } from '../src/ledger/EthereumLedgerService'

import { testSchemaSample } from './fixtures'
import { SubjectInboundTransport } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from './transport/SubjectOutboundTransport'

const logger = new ConsoleLogger(LogLevel.info)

export type SubjectMessage = { message: EncryptedMessage; replySubject?: Subject<SubjectMessage> }

const privateKey = TypedArrayEncoder.fromHex('89d6e6df0272c4262533f951d0550ecd9f444ec2e13479952e4cc6982febfed6')
let did: string
let schemaId: string

describe('Schema Operations', () => {
  let faberAgent: Agent<{ askar: AskarModule; ethereum: EthereumModule; dids: DidsModule }>
  let faberWalletId: string
  let faberWalletKey: string

  beforeAll(async () => {
    faberWalletId = utils.uuid()
    faberWalletKey = utils.uuid()

    const faberMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:faber': faberMessages,
    }

    // Initialize faber
    faberAgent = new Agent({
      config: {
        label: 'faber',
        endpoints: ['rxjs:faber'],
        walletConfig: { id: faberWalletId, key: faberWalletKey },
        logger,
      },
      dependencies: agentDependencies,
      modules: {
        askar: new AskarModule({ ariesAskar }),
        dids: new DidsModule({
          resolvers: [new EthereumDidResolver()],
          registrars: [new EthereumDidRegistrar()],
        }),
        ethereum: new EthereumModule({
          config: {
            networks: [
              {
                name: 'sepolia',
                chainId: 11155111,
                rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/API-KEY',
                registry: '0x485cFb9cdB84c0a5AfE69b75E2e79497Fc2256Fc',
              },
            ],
          },
          schemaManagerContractAddress: '0x70F88e12EaE54548839f320A5958C49421512A84',
          serverUrl: 'FILE-SERVER-URL',
          fileServerToken: 'FILE-SERVER-TOKEN',
          rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/API-KEY',
        }),
      },
    })

    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    await faberAgent.initialize()

    const createdDid = await faberAgent.dids.create<EthereumDidCreateOptions>({
      method: 'ethr',
      options: {
        network: 'sepolia',
      },
      secret: {
        privateKey,
      },
    })
    did =
      createdDid.didState.did || 'did:ethr:sepolia:0x022527341df022c9b898999cf6035ed3addca5d30e703028deeb4408f890f3baca'
  })

  afterAll(async () => {
    // Wait for messages to flush out
    await new Promise((r) => setTimeout(r, 1000))

    if (faberAgent) {
      await faberAgent.shutdown()

      if (faberAgent.wallet.isInitialized && faberAgent.wallet.isProvisioned) {
        await faberAgent.wallet.delete()
      }
    }
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
      // Test with empty schema name
      await expect(
        faberAgent.modules.ethereum.createSchema({
          did,
          schemaName: '',
          schema: testSchemaSample,
        })
      ).rejects.toThrow(SchemaCreationError)

      // Test with invalid schema structure
      await expect(
        faberAgent.modules.ethereum.createSchema({
          did,
          schemaName: 'InvalidSchema',
          schema: {},
        })
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

  describe('Schema Retrieval', () => {
    it('should retrieve created schemas by ID', async () => {
      const retrievedSchema = await faberAgent.modules.ethereum.getSchemaById(did, schemaId)
      expect(retrievedSchema).toBeDefined()
      expect(typeof JSON.parse(retrievedSchema)).toBe('object')
    })

    it('should handle retrieval of non-existent schema', async () => {
      const nonExistentSchemaId = 'non-existent-schema-id'
      await expect(faberAgent.modules.ethereum.getSchemaById(did, nonExistentSchemaId)).rejects.toThrow(
        SchemaRetrievalError
      )
    })
  })
})
