import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, DidsModule, LogLevel, utils, W3cCredentialsModule } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { askar } from '@openwallet-foundation/askar-nodejs'

import { EthereumModule } from '../src/EthereumModule'
import { EthereumDidRegistrar, EthereumDidResolver } from '../src/dids'

// Read-only ledger tests (did:ethr create/resolve) only need a Sepolia RPC.
// They are skipped unless `SEPOLIA_RPC_URL` is provided so unit/CI runs stay offline.
export const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com'
export const hasE2eEnv = Boolean(process.env.SEPOLIA_RPC_URL)

// On-chain WRITE tests (schema create / schema-registry) additionally need a funded key,
// the schema file server, and the deployed contracts — so they require an explicit opt-in.
export const hasLedgerWriteEnv = hasE2eEnv && process.env.RUN_LEDGER_WRITE_TESTS === 'true'

export type EthereumAgentModules = ReturnType<typeof getEthereumModules>

export function getEthereumModules() {
  return {
    askar: new AskarModule({ askar, store: { id: `ethr-test-${utils.uuid()}`, key: 'insecure-test-key' } }),
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
            rpcUrl: SEPOLIA_RPC_URL,
            registry: '0x485cFb9cdB84c0a5AfE69b75E2e79497Fc2256Fc',
          },
        ],
      },
      schemaManagerContractAddress: '0x1930977f040844021f5C13b42AA8b296f0cb52DB',
      serverUrl: process.env.SCHEMA_SERVER_URL ?? 'https://dev-schema.ngotag.com',
      fileServerToken: process.env.SCHEMA_FILE_SERVER_TOKEN ?? '',
      rpcUrl: SEPOLIA_RPC_URL,
    }),
    w3c: new W3cCredentialsModule(),
  }
}

export function getEthereumAgent(name: string): Agent<EthereumAgentModules> {
  return new Agent({
    config: { label: `Agent: ${name} - ${utils.uuid().slice(0, 4)}`, logger: new ConsoleLogger(LogLevel.off) },
    dependencies: agentDependencies,
    modules: getEthereumModules(),
  })
}
