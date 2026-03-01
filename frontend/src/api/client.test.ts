import { describe, it, expect, afterEach } from 'vitest'
import { getAccessToken, setAccessToken } from './client'

describe('token management', () => {
  afterEach(() => {
    setAccessToken(null)
  })

  it('getAccessToken returns null by default', () => {
    expect(getAccessToken()).toBeNull()
  })

  it('setAccessToken stores a token', () => {
    setAccessToken('my-token')
    expect(getAccessToken()).toBe('my-token')
  })

  it('setAccessToken null clears the stored token', () => {
    setAccessToken('my-token')
    setAccessToken(null)
    expect(getAccessToken()).toBeNull()
  })

  it('setAccessToken overwrites a previous token', () => {
    setAccessToken('first')
    setAccessToken('second')
    expect(getAccessToken()).toBe('second')
  })
})
