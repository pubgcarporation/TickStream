import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { StorageDriver, StoredObject } from './types'

export interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

/** Cloudflare R2 through its S3-compatible API. The bucket must stay private (no public access, no r2.dev URL). */
export class R2Storage implements StorageDriver {
  readonly name = 'r2' as const
  private readonly client: S3Client
  private readonly bucket: string

  constructor(config: R2Config) {
    this.bucket = config.bucket
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    })
  }

  async putFile(key: string, filePath: string, contentType: string): Promise<void> {
    const info = await stat(filePath)
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: info.size,
        ContentType: contentType,
      }),
    )
  }

  async putBuffer(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }),
    )
  }

  async getObject(key: string): Promise<StoredObject> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    if (!(result.Body instanceof Readable)) throw new Error('Unexpected R2 response body')
    return {
      stream: result.Body,
      size: result.ContentLength ?? 0,
      contentType: result.ContentType ?? 'application/octet-stream',
    }
  }

  async getBuffer(key: string): Promise<Buffer> {
    const object = await this.getObject(key)
    const chunks: Buffer[] = []
    for await (const chunk of object.stream) chunks.push(Buffer.from(chunk as Uint8Array))
    return Buffer.concat(chunks)
  }

  async downloadTo(key: string, destination: string): Promise<void> {
    await mkdir(path.dirname(destination), { recursive: true })
    const object = await this.getObject(key)
    await pipeline(object.stream, createWriteStream(destination))
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch {
      return false
    }
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}
