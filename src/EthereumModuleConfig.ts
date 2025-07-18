import type { ConfigurationOptions } from 'ethr-did-resolver/lib/configuration'

/**
 * EthereumModuleConfigOptions defines the interface for the options of the EthereumModuleConfig class.
 */
export interface EthereumModuleConfigOptions {
  config: ConfigurationOptions
  // rpcUrl?: string
  // didContractAddress?: string
  // fileServerToken?: string
  // schemaManagerContractAddress?: string
  // serverUrl?: string
  // chainNameOrId?: string
}

export class EthereumModuleConfig {
  // public readonly rpcUrl: string | undefined
  // public readonly didContractAddress: string | undefined
  // public readonly fileServerToken: string | undefined
  // public readonly schemaManagerContractAddress: string | undefined
  // public readonly serverUrl: string | undefined
  // public readonly chainNameOrId: string | undefined
  public readonly config: ConfigurationOptions

  public constructor({
    // didContractAddress,
    // fileServerToken,
    // rpcUrl,
    // schemaManagerContractAddress,
    // serverUrl,
    // chainNameOrId,
    config,
  }: EthereumModuleConfigOptions) {
    this.config = config
    // this.rpcUrl = rpcUrl
    // this.didContractAddress = didContractAddress
    // this.fileServerToken = fileServerToken
    // this.schemaManagerContractAddress = schemaManagerContractAddress
    // this.serverUrl = serverUrl
    // this.chainNameOrId = chainNameOrId
  }
}
