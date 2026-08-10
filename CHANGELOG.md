# @bhutan-ndi/ethr-credo-module

## 2.0.0

### Major Changes

- 1c3ac80: Add support for Credo (`@credo-ts/*`) 0.6.x.

  Credo 0.6 removed the `KeyType` enum and the `Wallet` key API in favour of a new KMS
  layer, which caused `EthereumModule` to crash agent startup with
  `CredoError: Cannot register ethereum: TypeError: Cannot read properties of undefined (reading 'K256')`.

  This release migrates the module to the 0.6 APIs, mirroring the approach already
  proven in `@ayanworks/credo-polygon-w3c-module`:

  - `SignatureSuiteToken` now registers `supportedPublicJwkTypes: [Secp256k1PublicJwk]`
    instead of `keyTypes: [KeyType.K256]`.
  - DID key creation imports the private key through `KeyManagementApi.importKey`
    (via `transformPrivateKeyToPrivateJwk`) using the base58 public key as the stable
    key id, and links it to the DID's verification method for credential signing.
  - Ledger signing fetches the key through `AskarStoreManager` instead of the removed
    `agentContext.wallet` API (signing itself still uses ethers `SigningKey`).

  **Breaking:** requires `@credo-ts/core`/`@credo-ts/askar` `^0.6.3` and Node's ESM
  module resolution (the package is now `"type": "module"`). The unused
  `getSecp256k1DidDoc` helper was removed.

### Patch Changes

- ac24b78: Fix `ERR_PACKAGE_PATH_NOT_EXPORTED` crash at agent startup.

  The `EcdsaSecp256k1Signature2019` and `EcdsaSecp256k1RecoveryMethod2020` signature
  suites imported `_includesContext` and the `JsonLdDoc` type from
  `@credo-ts/core/build/modules/vc/data-integrity/jsonldUtil` — a deep build path that
  is not part of `@credo-ts/core`'s public `exports` map. When a consumer resolves a
  Credo version that ships an `exports` map (0.6+), loading either suite throws
  `ERR_PACKAGE_PATH_NOT_EXPORTED`, which crashes the whole agent at startup since these
  suites are wired in unconditionally.

  Both symbols are trivial and dependency-free, so they are now inlined locally,
  removing the dependency on Credo's internal module layout entirely. Behaviour is
  unchanged.

## 1.0.3

### Patch Changes

- f5ce7c6: Refactor publicKeyHex to publicKeyBase58
