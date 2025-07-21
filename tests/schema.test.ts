import type { EthereumDidCreateOptions } from '../src/dids'
import type { EncryptedMessage } from '@credo-ts/core'

import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, DidsModule, LogLevel, TypedArrayEncoder, utils } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { Subject } from 'rxjs'

import { EthereumModule } from '../src/EthereumModule'
import { EthereumDidRegistrar, EthereumDidResolver } from '../src/dids'

import { SubjectInboundTransport } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from './transport/SubjectOutboundTransport'

const logger = new ConsoleLogger(LogLevel.info)

export type SubjectMessage = { message: EncryptedMessage; replySubject?: Subject<SubjectMessage> }

const privateKey = TypedArrayEncoder.fromHex('89d6e6df0272c4262533f951d0550ecd9f444ec2e13479952e4cc6982febfed6')
let did: string
let schemaId: string

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const testSchema = {
  '@context': [
    {
      '@version': 1.1,
    },
    'https://www.w3.org/ns/odrl.jsonld',
    {
      ex: 'https://example.org/examples#',
      schema: 'http://schema.org/',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      '3rdPartyCorrelation': 'ex:3rdPartyCorrelation',
      AllVerifiers: 'ex:AllVerifiers',
      Archival: 'ex:Archival',
      BachelorDegree: 'ex:BachelorDegree',
      Child: 'ex:Child',
      CLCredentialDefinition2019: 'ex:CLCredentialDefinition2019',
      CLSignature2019: 'ex:CLSignature2019',
      IssuerPolicy: 'ex:IssuerPolicy',
      HolderPolicy: 'ex:HolderPolicy',
      Mother: 'ex:Mother',
      RelationshipCredential: 'ex:RelationshipCredential',
      UniversityDegreeCredential: 'ex:UniversityDegreeCredential',
      AlumniCredential: 'ex:AlumniCredential',
      DisputeCredential: 'ex:DisputeCredential',
      PrescriptionCredential: 'ex:PrescriptionCredential',
      ZkpExampleSchema2018: 'ex:ZkpExampleSchema2018',
      issuerData: 'ex:issuerData',
      attributes: 'ex:attributes',
      signature: 'ex:signature',
      signatureCorrectnessProof: 'ex:signatureCorrectnessProof',
      primaryProof: 'ex:primaryProof',
      nonRevocationProof: 'ex:nonRevocationProof',
      alumniOf: { '@id': 'schema:alumniOf', '@type': 'rdf:HTML' },
      child: { '@id': 'ex:child', '@type': '@id' },
      degree: 'ex:degree',
      degreeType: 'ex:degreeType',
      degreeSchool: 'ex:degreeSchool',
      college: 'ex:college',
      name: { '@id': 'schema:name', '@type': 'rdf:HTML' },
      givenName: 'schema:givenName',
      familyName: 'schema:familyName',
      parent: { '@id': 'ex:parent', '@type': '@id' },
      referenceId: 'ex:referenceId',
      documentPresence: 'ex:documentPresence',
      evidenceDocument: 'ex:evidenceDocument',
      spouse: 'schema:spouse',
      subjectPresence: 'ex:subjectPresence',
      verifier: { '@id': 'ex:verifier', '@type': '@id' },
      currentStatus: 'ex:currentStatus',
      statusReason: 'ex:statusReason',
      prescription: 'ex:prescription',
    },
  ],
}

describe('Ethereum Module did resolver', () => {
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
                rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/m0SEA2hYFe149nEdKYMPao8Uv_ZrPqeM',
                registry: '0x485cFb9cdB84c0a5AfE69b75E2e79497Fc2256Fc',
              },
            ],
          },
          schemaManagerContractAddress: '0x1930977f040844021f5C13b42AA8b296f0cb52DB',
          serverUrl: 'http://localhost:4000/',
          fileServerToken:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJBeWFuV29ya3MiLCJpZCI6ImU3NGFkMWQyLTY5NGYtNGI3Ny05Mjk2LWY5NTdhY2YxNGE4NSJ9.wNd6OUveLZlJoN5ys68lPOX8aSY1HwVJaMW4K36sY4k',
          rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/m0SEA2hYFe149nEdKYMPao8Uv_ZrPqeM',
        }),
      },
    })

    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    await faberAgent.initialize()
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

  describe('EthereumSchema', () => {
    it('EthereumSchema ---- create and resolve a did:ethr did', async () => {
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
        createdDid.didState.did ||
        'did:ethr:sepolia:0x022527341df022c9b898999cf6035ed3addca5d30e703028deeb4408f890f3baca'
    })

    it('should create w3c schema', async () => {
      const response = await faberAgent.modules.ethereum.createSchema({
        did,
        schemaName: 'TestCollegeSchema',
        schema: testSchema,
      })
      schemaId = response.schemaId
      console.log('EthereumSchema --- Created Schema Response', JSON.stringify(response))
    })

    it('should resolve a schema by Id', async () => {
      const schema = await faberAgent.modules.ethereum.getSchemaById(did, schemaId)
      console.log('EthereumSchema --- Get schema By id', schema)
    })

    it('should resolve a ethereum did with metadata', async () => {
      const resolvedDIDDoc = await faberAgent.dids.resolve(did)
      faberAgent.config.logger.info('resolvedDIDDoc', resolvedDIDDoc)
    })
  })
})
