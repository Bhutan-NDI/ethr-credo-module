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

// On-chain WRITE tests (schema create / schema-registry) do real transactions, so they are an
// explicit opt-in. When opted in, each suite `requireEnv(...)`s its specific inputs and fails
// fast (rather than silently using placeholders) if any are missing.
export const runLedgerWriteTests = process.env.RUN_LEDGER_WRITE_TESTS === 'true'

export function requireEnv(...names: string[]): void {
  const missing = names.filter((name) => !process.env[name]?.trim())
  if (missing.length > 0) {
    throw new Error(
      `These on-chain write tests require the following environment variable(s): ${missing.join(', ')}. ` +
        `Set them (see .env) or unset RUN_LEDGER_WRITE_TESTS to skip.`
    )
  }
}

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
      schemaManagerContractAddress:
        process.env.SCHEMA_MANAGER_CONTRACT_ADDRESS ?? '0x70F88e12EaE54548839f320A5958C49421512A84',
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
