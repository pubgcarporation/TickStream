import { env } from '../env'
import { LocalStorage } from './local'
import { R2Storage } from './r2'
import type { StorageDriver } from './types'

export type { StorageDriver, StoredObject } from './types'

let driver: StorageDriver | undefined

export function getStorage(): StorageDriver {
  if (driver) return driver
  if (env.storageDriver === 'r2') {
    const { accountId, accessKeyId, secretAccessKey, bucket } = env.r2
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error('STORAGE_DRIVER=r2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET')
    }
    driver = new R2Storage({ accountId, accessKeyId, secretAccessKey, bucket })
  } else {
    driver = new LocalStorage(env.storageDir)
  }
  return driver
}

export const storageKeys = {
  source: (videoId: string) => `sources/${videoId}/original`,
  segment: (videoId: string, name: string) => `videos/${videoId}/${name}`,
  thumbnail: (videoId: string) => `videos/${videoId}/thumbnail.jpg`,
}
