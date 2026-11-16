---
'@bhutan-ndi/ethr-credo-module': minor
---

Compute schema checksums from the schema's content.

The checksum written to the schema registry hashed `String(schema)`, which is
`"[object Object]"` for every schema, so all records carried the same constant
(`7bc087f4…0877`) and could not detect a changed schema file.

- Checksum is now SHA-256 (hex) of the schema's RFC 8785 (JCS) canonical JSON.
- Schema resources record `checksumAlgorithm: "sha256-jcs"`; records without it
  predate this fix and their checksum carries no integrity.
- `mediaType` is set to `application/schema+json`.
- `computeSchemaChecksum` and `SCHEMA_CHECKSUM_ALGORITHM` are exported so
  verifiers use the same algorithm.
- Replaced the `keccak256` dependency with `canonicalize`.
