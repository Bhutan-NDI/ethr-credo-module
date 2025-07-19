/* eslint-disable no-console */
import type { EthereumDidCreateOptions } from '../src/dids'
import type { EncryptedMessage } from '@credo-ts/core'

import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, DidsModule, LogLevel, TypedArrayEncoder, utils } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { Subject } from 'rxjs'

import { EthereumModule } from '../src/EthereumModule'
import { EthereumDidRegistrar, EthereumDidResolver } from '../src/dids'

import { EthereumDIDFixtures } from './fixtures'
import { SubjectInboundTransport } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from './transport/SubjectOutboundTransport'

const logger = new ConsoleLogger(LogLevel.info)

export type SubjectMessage = { message: EncryptedMessage; replySubject?: Subject<SubjectMessage> }

const did = 'did:ethr:sepolia:0x022527341df022c9b898999cf6035ed3addca5d30e703028deeb4408f890f3baca'

describe('Ethereum Module did resolver', () => {
  let aliceAgent: Agent<{ askar: AskarModule; ethr: EthereumModule; dids: DidsModule }>
  let aliceWalletId: string
  let aliceWalletKey: string

  beforeAll(async () => {
    aliceWalletId = utils.uuid()
    aliceWalletKey = utils.uuid()

    const aliceMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:alice': aliceMessages,
    }

    // Initialize alice
    aliceAgent = new Agent({
      config: {
        label: 'alice',
        endpoints: ['rxjs:alice'],
        walletConfig: { id: aliceWalletId, key: aliceWalletKey },
        logger,
      },
      dependencies: agentDependencies,
      modules: {
        askar: new AskarModule({ ariesAskar }),
        dids: new DidsModule({
          resolvers: [new EthereumDidResolver()],
          registrars: [new EthereumDidRegistrar()],
        }),
        ethr: new EthereumModule({
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
        }),
      },
    })

    // console.log('Initialized aliceAgent-----', JSON.stringify(aliceAgent))

    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    await aliceAgent.initialize()

    // await aliceAgent.dids.import({
    //   did,
    //   overwrite: true,
    //   privateKeys: [
    //     {
    //       keyType: KeyType.K256,
    //       privateKey: TypedArrayEncoder.fromHex('5a4a2c79f4bceb4976dde41897b2607e01e6b74a42bc854a7a20059cfa99a095'),
    //     },
    //   ],
    // })
  })

  afterAll(async () => {
    // Wait for messages to flush out
    await new Promise((r) => setTimeout(r, 1000))

    if (aliceAgent) {
      await aliceAgent.shutdown()

      if (aliceAgent.wallet.isInitialized && aliceAgent.wallet.isProvisioned) {
        await aliceAgent.wallet.delete()
      }
    }
  })

  it('create and resolve a did:ethr did', async () => {
    const createdDid = await aliceAgent.dids.create<EthereumDidCreateOptions>({
      method: 'ethr',
      options: {
        network: 'sepolia',
      },
      secret: {
        privateKey: TypedArrayEncoder.fromHex('89d6e6df0272c4262533f951d0550ecd9f444ec2e13479952e4cc6982febfed6'),
      },
    })

    console.log('createdDid--------', JSON.stringify(createdDid))
  })

  describe('EthereumDidResolver', () => {
    it('should resolve a ethereum did when valid did is passed', async () => {
      const resolvedDIDDoc = await aliceAgent.dids.resolve(did)

      console.log('resolvedDIDDoc--------', JSON.stringify(resolvedDIDDoc))
      expect(resolvedDIDDoc.didDocument?.context).toEqual(
        EthereumDIDFixtures.VALID_DID_DOCUMENT.didDocument['@context']
      )
      expect(resolvedDIDDoc.didDocument?.id).toBe(EthereumDIDFixtures.VALID_DID_DOCUMENT.didDocument.id)
      expect(resolvedDIDDoc.didDocument?.verificationMethod).toEqual(
        EthereumDIDFixtures.VALID_DID_DOCUMENT.didDocument.verificationMethod
      )
      expect(resolvedDIDDoc.didDocument?.authentication).toEqual(
        EthereumDIDFixtures.VALID_DID_DOCUMENT.didDocument.authentication
      )
      expect(resolvedDIDDoc.didDocument?.assertionMethod).toEqual(
        EthereumDIDFixtures.VALID_DID_DOCUMENT.didDocument.assertionMethod
      )
    })

    it("should fail with 'Invalid DID' message when invalid ethereum did is passed", async () => {
      const did = 'did:ethr:testnet:0x525D4605f4EE59e1149987F59668D4f272359093'

      const result = await aliceAgent.dids.resolve(did)

      expect(result.didResolutionMetadata.error).toBe('notFound')
      expect(result.didResolutionMetadata.message).toContain('resolver_error: Unable to resolve did')
    })

    it('should fail after resolution invalid ethereum did is passed', async () => {
      const did = 'did:ethr:testnet:0x525D4605f4EE59e1149987F59668D4f272359093'

      const result = await aliceAgent.dids.resolve(did)

      expect(result.didDocument).toEqual(null)
      expect(result.didResolutionMetadata.error).toEqual('notFound')
    })
  })
})
