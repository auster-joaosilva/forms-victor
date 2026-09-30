export interface ObjectStorage {
  ensureBucket(): Promise<void>
  put(key: string, body: Uint8Array, contentType: string): Promise<void>
  get(key: string): Promise<Uint8Array | null>
}
