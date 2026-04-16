const sessions = new Map<string, string>();

export function registerSession(rootRealPath: string): string {
  const token = crypto.randomUUID();
  sessions.set(token, rootRealPath);
  return token;
}

export function getSessionRoot(token: string): string | null {
  return sessions.get(token) ?? null;
}
