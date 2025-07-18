# Credo did:ethereum W3C Module

- W3C did:ethereum method registry for [credo-ts](https://github.com/openwallet-foundation/credo-ts).

## Usage

```ts
import { EthereumDidResolver, EthereumDidRegistrar, EthereumModule } from 'credo-ethr-module'

const agent = new Agent({
  config: {
    /* agent config */
  },
  dependencies,
  modules: {
    /* ... */
    dids: new DidsModule({
      resolvers: [ /* ... */, new EthereumDidResolver()],
      registrars: [ /* ... */, new EthereumDidRegistrar()],
    }),
    /* ... */
    ethereum: new EthereumModule({
      rpcUrl: 'rpcUrl' // ethereum rpc url,
      didContractAddress: 'didContractAddress' // ethereum did contract address,
      fileServerToken: 'fileServerToken' // ethereum file server token to store schema json,
      schemaManagerContractAddress: 'schemaManagerContractAddress' // ethereum schema manager contract address,
      serverUrl: 'serverUrl' // ethereum file server url,
    }),
})
```
