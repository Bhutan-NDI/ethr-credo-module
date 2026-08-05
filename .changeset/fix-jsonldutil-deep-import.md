---
'@bhutan-ndi/ethr-credo-module': patch
---

Fix `ERR_PACKAGE_PATH_NOT_EXPORTED` crash at agent startup.

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
