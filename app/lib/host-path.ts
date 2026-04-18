import os from "node:os";

const CONTAINER_HOME = "/root";

export function translateToHostPath(backendPath: string): string {
  const hostHome = process.env.HOST_HOME;
  if (!hostHome) return backendPath;
  if (backendPath === CONTAINER_HOME) return hostHome;
  if (backendPath.startsWith(CONTAINER_HOME + "/")) {
    return hostHome + backendPath.slice(CONTAINER_HOME.length);
  }
  return backendPath;
}

export function canOpenLocally(): boolean {
  if (process.env.HOST_HOME) return false;
  if (os.homedir() !== CONTAINER_HOME) return process.platform === "darwin";
  return false;
}
