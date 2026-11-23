import { env } from '@shared/env'
import { HttpError, requireUser, type Ctx } from '../http'

export function isAdmin(address: string | undefined): boolean {
  return Boolean(address) && env.adminAddresses.includes((address ?? '').toLowerCase())
}

/** Admins are the wallet addresses listed in ADMIN_ADDRESSES. Everyone else gets a 403. */
export function requireAdmin(ctx: Ctx): string {
  const address = requireUser(ctx)
  if (!isAdmin(address)) throw new HttpError(403, 'This area is for administrators', 'forbidden')
  return address
}
