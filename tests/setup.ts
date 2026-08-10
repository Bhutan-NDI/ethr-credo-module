import 'reflect-metadata'
// Registers the global Askar instance (via askar-nodejs' self-registration) before any test
// module imports `@credo-ts/askar`, so the Askar KMS `sign`/`getPublicKey` operations work.
import '@openwallet-foundation/askar-nodejs'
