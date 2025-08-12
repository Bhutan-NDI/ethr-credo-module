// eslint-disable-next-line import/no-extraneous-dependencies
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
    throw error
  }
}
