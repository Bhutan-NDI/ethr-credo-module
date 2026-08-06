import type { EthereumModuleConfigOptions } from './EthereumModuleConfig.js'

import {
  SignatureSuiteToken,
  type DependencyManager,
  type Module,
  type SuiteInfo,
  VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
} from '@credo-ts/core'
import { Secp256k1PublicJwk } from '@credo-ts/core/kms'

import { EthereumApi } from './EthereumApi.js'
import { EthereumModuleConfig } from './EthereumModuleConfig.js'
import { EthereumLedgerService } from './ledger/index.js'
import { EcdsaSecp256k1Signature2019 } from './signature-suites/index.js'

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
      suiteClass: EcdsaSecp256k1Signature2019,
      proofType: 'EcdsaSecp256k1Signature2019',
      verificationMethodTypes: [VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019],
      supportedPublicJwkTypes: [Secp256k1PublicJwk],
    } satisfies SuiteInfo)
  }
}
