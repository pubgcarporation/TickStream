import type { Readable } from 'node:stream'

export interface StoredObject {
  stream: Readable
  size: number
  contentType: string
}

/**
 * Private object storage. Nothing stored through this interface is publicly addressable:
 * every read goes through the API after a payment and session check.
 */
export interface StorageDriver {
  readonly name: 'local' | 'r2'
  putFile(key: string, filePath: string, contentType: string): Promise<void>
  putBuffer(key: string, data: Buffer, contentType: string): Promise<void>
  getBuffer(key: string): Promise<Buffer>
  getObject(key: string): Promise<StoredObject>
  downloadTo(key: string, destination: string): Promise<void>
  exists(key: string): Promise<boolean>
  remove(key: string): Promise<void>
}
