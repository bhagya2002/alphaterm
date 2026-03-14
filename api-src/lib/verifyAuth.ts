import { SignJWT, jwtVerify } from 'jose'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE_NAME = 'alphaterm_session'
const JWT_TTL = 8 * 60 * 60 // 8 hours

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

export async function createToken(): Promise<string> {
  const secret = getJwtSecret()
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${JWT_TTL}s`)
    .sign(secret)
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = getJwtSecret()
    await jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

function getCookie(req: VercelRequest, name: string): string | undefined {
  const cookie = req.headers.cookie
  if (!cookie) return undefined
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

/**
 * Call from API handlers. Returns true if request has valid JWT cookie; otherwise sends 401 and returns false.
 */
export async function verifyAuth(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const token = getCookie(req, COOKIE_NAME)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  const valid = await verifyToken(token)
  if (!valid) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

function cookieSameSite(): string {
  return process.env.COOKIE_SAMESITE === 'None' ? 'None' : 'Strict'
}

export function setAuthCookie(res: VercelResponse, token: string) {
  const sameSite = cookieSameSite()
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${JWT_TTL}`,
  ])
}

export function clearAuthCookie(res: VercelResponse) {
  const sameSite = cookieSameSite()
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=0`,
  ])
}
