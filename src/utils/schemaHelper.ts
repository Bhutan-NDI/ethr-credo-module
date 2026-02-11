// eslint-disable-next-line import/no-extraneous-dependencies
import type { Schema } from 'src/ledger/EthereumLedgerService'

import axios from 'axios'
import keccak256 from 'keccak256'

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
  const checksum = await keccak256(String(schema)).toString('hex')
  if (!checksum) {
    throw new Error(`Error while calculating checksum!`)
  }

  return {
    resourceURI: `${did}/resources/${schemaId}`,
    resourceCollectionId: address,
    resourceId: `${schemaId}`,
    resourceName: `${name}`,
    resourceType: 'W3C-schema',
    mediaType: '',
    created: new Date().toISOString(),
    checksum,
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
