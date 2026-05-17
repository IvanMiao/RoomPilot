export function getOptionalEnv(name: string): string | null {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
}

export function getRequiredEnv(name: string): string {
  const value = getOptionalEnv(name);

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}
