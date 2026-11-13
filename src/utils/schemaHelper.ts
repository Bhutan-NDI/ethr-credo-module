// eslint-disable-next-line import/no-extraneous-dependencies
import type { Schema } from '../ledger/EthereumLedgerService.js'

import axios from 'axios'
import canonicalize from 'canonicalize'
import { sha256, toUtf8Bytes } from 'ethers'

export const SCHEMA_CHECKSUM_ALGORITHM = 'sha256-jcs'

/**
 * SHA-256 (hex) of the schema's RFC 8785 canonical JSON, so the checksum is
 * independent of key order and whitespace on the file server.
 */
export function computeSchemaChecksum(schema: object): string {
  const canonicalSchema = canonicalize(schema)
  if (!canonicalSchema) {
    throw new Error('Schema could not be canonicalized for checksum calculation')
  }
  return sha256(toUtf8Bytes(canonicalSchema)).slice(2)
}

/**
 * Build schema JSON.
 * @param did
 * @param schemaId
 * @param name
 * @returns Returns the build schema resource Document.
 */
export async function buildSchemaResource(
  did: string,
  schemaId: string,
  name: string,
  schema: object,
  address: string
) {
  const checksum = computeSchemaChecksum(schema)

  return {
    resourceURI: `${did}/resources/${schemaId}`,
    resourceCollectionId: address,
    resourceId: `${schemaId}`,
    resourceName: `${name}`,
    resourceType: 'W3C-schema',
    mediaType: 'application/schema+json',
    created: new Date().toISOString(),
    checksum,
    checksumAlgorithm: SCHEMA_CHECKSUM_ALGORITHM,
    previousVersionId: '',
    nextVersionId: '',
  }
}

export async function uploadSchemaFile(
  schemaId: string,
  schema: object,
  fileServerUrl: string,
  fileServerToken: string
) {
  try {
    if (!schemaId || Object?.keys(schema)?.length === 0) {
      throw new Error(`Schema resource id and schema are required!`)
    }

    const schemaPayload = {
      schemaId: `${schemaId}`,
      schema,
    }

    const axiosOptions = {
      method: 'post',
      url: `${fileServerUrl}/schemas`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${fileServerToken}`,
      },
      data: JSON.stringify(schemaPayload),
    }
    const response = await axios(axiosOptions)
    return response
  } catch (error) {
    throw new Error(`Error occurred in uploadSchemaFile function ${error} `)
  }
}

export async function getSchemaFile(
  schemaId: string,
  fileServerUrl: string,
  fileServerToken: string
): Promise<Schema | null> {
  if (!schemaId) {
    throw new Error('Schema id is required')
  }

  try {
    const response = await axios.get(`${fileServerUrl}/schemas/${encodeURIComponent(schemaId)}`, {
      headers: {
        Authorization: `Bearer ${fileServerToken}`,
      },
    })

    return response.data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null
    }

    throw new Error(`Failed to get schema ${schemaId} from file server. Error: ${error}`)
  }
}
