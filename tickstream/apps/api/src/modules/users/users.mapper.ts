import type { UserProfile } from '@shared/types'

export interface UserRow {
  address: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_updated_at: Date | null
  created_at: Date
}

export function mapUser(row: UserRow): UserProfile {
  return {
    address: row.address,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarVersion: row.avatar_updated_at ? Math.floor(row.avatar_updated_at.getTime() / 1000) : null,
    createdAt: row.created_at.toISOString(),
  }
}
