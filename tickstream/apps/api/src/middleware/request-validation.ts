import { isAddress } from 'viem'
import { HttpError } from '../http'

export function str(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new HttpError(400, `${field} is required`, 'invalid_request')
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) {
    throw new HttpError(400, `${field} must be between ${min} and ${max} characters`, 'invalid_request')
  }
  return trimmed
}

export function optionalStr(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return str(value, field, 0, max)
}

export function int(value: unknown, field: string, min: number, max: number): number {
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${field} must be a whole number between ${min} and ${max}`, 'invalid_request')
  }
  return parsed
}

export function address(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) {
    throw new HttpError(400, `${field} must be a wallet address`, 'invalid_request')
  }
  return value.toLowerCase()
}

export function uuid(value: string, field = 'id'): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(404, `${field} not found`, 'not_found')
  }
  return value.toLowerCase()
}
