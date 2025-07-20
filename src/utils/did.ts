export function getNetworkFromDid(did: string) {
  const network = did.split(':')[2]
  if (network === 'ethr') {
    return 'testnet'
  }

  return 'mainnet'
}

type DIDNetworkInfo = {
  type: 'mainnet' | 'testnet'
  network: string
}

function parseDIDNetwork(did: string): DIDNetworkInfo {
  const parts = did.split(':')
  if (parts.length < 3 || parts[0] !== 'did' || parts[1] !== 'ethr') {
    throw new Error('Invalid DID format')
  }

  if (parts.length === 3) {
    return { type: 'mainnet', network: 'mainnet' }
  }

  if (parts.length === 4) {
    const network = parts[2]
    return { type: 'testnet', network }
  }

  throw new Error('Unexpected DID format')
}

export function parseDid(did: string) {
  const network = parseDIDNetwork(did).network
  const didAddress = network === 'testnet' ? did.split(':')[3] : did.split(':')[2]
  return {
    network,
    didAddress,
  }
}
