export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  email: string
}

export interface AuthTokens {
  access_token: string
  token_type: string
}
