# Credo did:ethr Module

- did:ethr method registry for [credo-ts](https://github.com/openwallet-foundation/credo-ts).

## Usage

```ts
import { EthereumDidResolver, EthereumDidRegistrar, EthereumModule } from '@bhutan-ndi/ethr-credo-module'

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
  }
})
```
