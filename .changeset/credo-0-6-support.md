---
'@bhutan-ndi/ethr-credo-module': major
---

Add support for Credo (`@credo-ts/*`) 0.6.x.

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
