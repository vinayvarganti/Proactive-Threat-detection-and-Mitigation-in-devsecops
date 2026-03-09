export interface AccessToken {
  token: string;
  expiresAt: Date;
  refreshToken: string;
}

export interface EncryptedTokenData {
  encryptedToken: string;
  encryptedRefreshToken: string;
  expiresAt: Date;
}
