type Session = {
  sub: string;
  rootRealPath: string;
  workspaceId: string;
};

const sessions = new Map<string, Session>();

export function registerSession(
  sub: string,
  rootRealPath: string,
  workspaceId: string,
): string {
  const token = crypto.randomUUID();
  sessions.set(token, { sub, rootRealPath, workspaceId });
  return token;
}

export function getSession(token: string): Session | null {
  return sessions.get(token) ?? null;
}

export function revokeSession(token: string): void {
  sessions.delete(token);
}
