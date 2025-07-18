import type { EthereumModuleConfigOptions } from './EthereumModuleConfig'

import { SignatureSuiteToken, type DependencyManager, type Module, KeyType } from '@credo-ts/core'

import { EthereumApi } from './EthereumApi'
import { EthereumModuleConfig } from './EthereumModuleConfig'
import { EthereumLedgerService } from './ledger'
import { EcdsaSecp256k1RecoverySignature2020 } from './signature-suites'

export class EthereumModule implements Module {
  public readonly config: EthereumModuleConfig
  public readonly api = EthereumApi

  public constructor(options: EthereumModuleConfigOptions) {
    this.config = new EthereumModuleConfig(options)
  }

  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager.registerInstance(EthereumModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(EthereumLedgerService)

    // Api
    dependencyManager.registerContextScoped(EthereumApi)

    // Signature suites.
    dependencyManager.registerInstance(SignatureSuiteToken, {
      suiteClass: EcdsaSecp256k1RecoverySignature2020,
      proofType: 'EcdsaSecp256k1RecoverySignature2020',
      verificationMethodTypes: ['EcdsaSecp256k1RecoveryMethod2020'],
      keyTypes: [KeyType.K256],
    })
  }
}
