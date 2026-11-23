import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface EncryptionMaterial {
  keyHex: string
  ivHex: string
  keyInfoFile: string
}

/**
 * Creates a fresh AES-128 key and IV for one video and writes the key-info file ffmpeg reads.
 * The key is only ever served to a paying session by the API.
 */
export async function createEncryption(dir: string): Promise<EncryptionMaterial> {
  const key = randomBytes(16)
  const iv = randomBytes(16)
  const keyFile = path.join(dir, 'video.key')
  const keyInfoFile = path.join(dir, 'video.keyinfo')
  await writeFile(keyFile, key)
  await writeFile(keyInfoFile, `key\n${keyFile}\n${iv.toString('hex')}\n`)
  return { keyHex: key.toString('hex'), ivHex: iv.toString('hex'), keyInfoFile }
}
