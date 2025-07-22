import type { AgentDependencies, InitConfig, InjectionToken, Wallet, WalletConfig } from '@credo-ts/core'
import type { AgentModulesInput, EmptyModuleMap } from '@credo-ts/core/build/agent/AgentModules'

import {
  AgentConfig,
  AgentContext,
  ConnectionsModule,
  ConsoleLogger,
  DependencyManager,
  DidsModule,
  InjectionSymbols,
  LogLevel,
  utils,
} from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'

import { EthereumModule } from '../src/EthereumModule'
import { EthereumDidRegistrar, EthereumDidResolver } from '../src/dids'

const testLogger = new ConsoleLogger(LogLevel.off)

export function getAgentOptions<AgentModules extends AgentModulesInput | EmptyModuleMap>(
  name: string,
  extraConfig: Partial<InitConfig> = {},
  inputModules?: AgentModules
): { config: InitConfig; modules: AgentModules; dependencies: AgentDependencies } {
  const random = utils.uuid().slice(0, 4)
  const config: InitConfig = {
    label: `Agent: ${name} - ${random}`,
    walletConfig: {
      id: `Wallet: ${name} - ${random}`,
      key: `Key${name}`,
    },
    // TODO: determine the log level based on an environment variable. This will make it
    // possible to run e.g. failed github actions in debug mode for extra logs
    logger: testLogger,
    ...extraConfig,
  }

  const m = (inputModules ?? {}) as AgentModulesInput
  const modules = {
    ...m,
    // Make sure connections module is always defined so we can set autoAcceptConnections
    connections:
      m.connections ??
      new ConnectionsModule({
        autoAcceptConnections: true,
      }),
  }

  return { config, modules: modules as AgentModules, dependencies: agentDependencies } as const
}

export function getAgentConfig(
  name: string,
  extraConfig: Partial<InitConfig> = {}
): AgentConfig & { walletConfig: WalletConfig } {
  const { config, dependencies } = getAgentOptions(name, extraConfig, {
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
      schemaManagerContractAddress: '0x1930977f040844021f5C13b42AA8b296f0cb52DB',
      serverUrl: 'https://dev-schema.ngotag.com',
      fileServerToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJBeWFuV29ya3MiLCJpZCI6ImU3NGFkMWQyLTY5NGYtNGI3Ny05Mjk2LWY5NTdhY2YxNGE4NSJ9.wNd6OUveLZlJoN5ys68lPOX8aSY1HwVJaMW4K36sY4k',
      rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/m0SEA2hYFe149nEdKYMPao8Uv_ZrPqeM',
    }),
    dids: new DidsModule({
      resolvers: [new EthereumDidResolver()],
      registrars: [new EthereumDidRegistrar()],
    }),
  })
  return new AgentConfig(config, dependencies) as AgentConfig & { walletConfig: WalletConfig }
}

export function getAgentContext({
  dependencyManager = new DependencyManager(),
  wallet,
  agentConfig,
  contextCorrelationId = 'mock',
  registerInstances = [],
}: {
  dependencyManager?: DependencyManager
  wallet?: Wallet
  agentConfig?: AgentConfig
  contextCorrelationId?: string
  // Must be an array of arrays as objects can't have injection tokens
  // as keys (it must be number, string or symbol)
  registerInstances?: Array<[InjectionToken, unknown]>
} = {}) {
  if (wallet) dependencyManager.registerInstance(InjectionSymbols.Wallet, wallet)
  if (agentConfig) dependencyManager.registerInstance(AgentConfig, agentConfig)

  // Register custom instances on the dependency manager
  for (const [token, instance] of registerInstances.values()) {
    dependencyManager.registerInstance(token, instance)
  }

  return new AgentContext({ dependencyManager, contextCorrelationId })
}
