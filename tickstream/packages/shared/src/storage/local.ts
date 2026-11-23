import { createReadStream, createWriteStream } from 'node:fs'
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { StorageDriver, StoredObject } from './types'

const CONTENT_TYPES: Record<string, string> = {
  '.ts': 'video/mp2t',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
}

export class LocalStorage implements StorageDriver {
  readonly name = 'local' as const

  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    const target = path.resolve(this.baseDir, key)
    if (!target.startsWith(path.resolve(this.baseDir) + path.sep)) throw new Error('Invalid storage key')
    return target
  }

  async putFile(key: string, filePath: string): Promise<void> {
    const target = this.resolve(key)
    await mkdir(path.dirname(target), { recursive: true })
    await copyFile(filePath, target)
  }

  async putBuffer(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, data)
  }

  async getBuffer(key: string): Promise<Buffer> {
    return readFile(this.resolve(key))
  }

  async getObject(key: string): Promise<StoredObject> {
    const target = this.resolve(key)
    const info = await stat(target)
    return {
      stream: createReadStream(target),
      size: info.size,
      contentType: CONTENT_TYPES[path.extname(target)] ?? 'application/octet-stream',
    }
  }

  async downloadTo(key: string, destination: string): Promise<void> {
    await mkdir(path.dirname(destination), { recursive: true })
    await pipeline(createReadStream(this.resolve(key)), createWriteStream(destination))
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key))
      return true
    } catch {
      return false
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true })
  }
}
