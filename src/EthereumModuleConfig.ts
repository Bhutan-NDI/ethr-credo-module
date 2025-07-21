import type { ConfigurationOptions } from 'ethr-did-resolver/lib/configuration'

/**
 * EthereumModuleConfigOptions defines the interface for the options of the EthereumModuleConfig class.
 */
export interface EthereumModuleConfigOptions {
  config: ConfigurationOptions
  rpcUrl: string
  fileServerToken: string
  schemaManagerContractAddress: string
  serverUrl: string
}

export class EthereumModuleConfig {
  public rpcUrl: string
  public fileServerToken: string
  public schemaManagerContractAddress: string
  public serverUrl: string
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
