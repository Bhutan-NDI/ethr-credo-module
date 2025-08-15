import type { ConfigurationOptions } from 'ethr-did-resolver/lib/configuration'

/**
 * EthereumModuleConfigOptions defines the interface for the options of the EthereumModuleConfig class.
 */
export interface EthereumModuleConfigOptions {
  config: ConfigurationOptions
  rpcUrl?: string
  fileServerToken?: string
  schemaManagerContractAddress?: string
  serverUrl?: string
}

export class EthereumModuleConfig {
  public rpcUrl: string | undefined
  public fileServerToken: string | undefined
  public schemaManagerContractAddress: string | undefined
  public serverUrl: string | undefined
  public readonly config: ConfigurationOptions

  public constructor({
    fileServerToken,
    rpcUrl,
    schemaManagerContractAddress,
    serverUrl,
    config,
  }: EthereumModuleConfigOptions) {
    this.config = config
    this.rpcUrl = rpcUrl
    this.fileServerToken = fileServerToken
    this.schemaManagerContractAddress = schemaManagerContractAddress
    this.serverUrl = serverUrl
  }
}
