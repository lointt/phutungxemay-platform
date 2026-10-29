// ============================================================
// lib/server-admin-store.ts — Quản lý token Admin phía Server Node.js
// ============================================================

import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), '.admin_token_cache.json');

export interface TokenPayload {
  idToken: string;
  email?: string;
  savedAt: number;
}

let inMemoryToken: TokenPayload | null = null;

export function readTokenFromFile(): TokenPayload | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(data) as TokenPayload;
    }
  } catch {}
  return null;
}

export function writeTokenToFile(payload: TokenPayload): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch {}
}

export function getServerAdminToken(): string | null {
  if (inMemoryToken?.idToken) return inMemoryToken.idToken;
  const fromFile = readTokenFromFile();
  if (fromFile?.idToken) {
    inMemoryToken = fromFile;
    return fromFile.idToken;
  }
  return null;
}

export function setServerAdminToken(idToken: string, email?: string): void {
  const payload: TokenPayload = {
    idToken,
    email,
    savedAt: Date.now(),
  };
  inMemoryToken = payload;
  writeTokenToFile(payload);
}
