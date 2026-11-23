import type { UserProfile } from '@shared/types'

export interface UserRow {
  address: string
  username: string
  display_name: string | null
  bio: string | null
  created_at: Date
}

export function mapUser(row: UserRow): UserProfile {
  return {
    address: row.address,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    createdAt: row.created_at.toISOString(),
  }
}
