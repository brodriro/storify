export type Role = 'admin' | 'member' | 'guest';

export interface UserConfig {
  username: string;
  password: string;
  role: Role;
}

export interface AppConfig {
  port: number;
  storagePath: string;
  totalStorageGb: number;
  adminEmail: string;
  jwtSecret: string;
  cookieSecure: boolean;
  openaiApiKey: string | null;
  upload: { maxFileSizeMb: number; maxFiles: number };
  users: UserConfig[];
}

const MIN_JWT_SECRET_LENGTH = 32;

/** Role is derived from the username by convention: ADMIN and INVITADO are reserved. */
export function roleForUsername(username: string): Role {
  switch (username.toUpperCase()) {
    case 'ADMIN':
      return 'admin';
    case 'INVITADO':
      return 'guest';
    default:
      return 'member';
  }
}

function parsePositiveInt(
  name: string,
  raw: string | undefined,
  fallback: number,
  errors: string[],
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${name} must be a positive integer (got "${raw}")`);
    return fallback;
  }
  return value;
}

/**
 * Builds and validates the application configuration from the environment.
 * Throws on invalid configuration so the app refuses to start instead of
 * running with insecure fallbacks.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const errors: string[] = [];

  const usernames = (env.USERS ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  if (usernames.length === 0) {
    errors.push('USERS must list at least one user (e.g. USERS="ADMIN,ALICE")');
  }
  for (const username of usernames) {
    if (!/^[A-Za-z0-9_-]+$/.test(username)) {
      errors.push(
        `Invalid username "${username}": only letters, digits, "_" and "-" are allowed`,
      );
    }
  }
  const users: UserConfig[] = usernames.map((username) => {
    const password = env[`USER_${username}`] ?? '';
    if (password === '') {
      errors.push(`USER_${username} must be set (password for ${username})`);
    }
    return { username, password, role: roleForUsername(username) };
  });

  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters (generate one with: openssl rand -hex 32)`,
    );
  }

  const config: AppConfig = {
    port: parsePositiveInt('PORT', env.PORT, 3000, errors),
    storagePath: env.STORAGE_PATH?.trim() || './public_storage',
    totalStorageGb: parsePositiveInt(
      'TOTAL_STORAGE_GB',
      env.TOTAL_STORAGE_GB,
      10,
      errors,
    ),
    adminEmail: env.ADMIN_EMAIL?.trim() || 'admin@storify.local',
    jwtSecret,
    cookieSecure: env.NODE_ENV === 'production',
    openaiApiKey: env.OPENAI_API_KEY?.trim() || null,
    upload: {
      maxFileSizeMb: parsePositiveInt(
        'UPLOAD_MAX_FILE_SIZE_MB',
        env.UPLOAD_MAX_FILE_SIZE_MB,
        2048,
        errors,
      ),
      maxFiles: parsePositiveInt(
        'UPLOAD_MAX_FILES',
        env.UPLOAD_MAX_FILES,
        10,
        errors,
      ),
    },
    users,
  };

  if (errors.length > 0) {
    throw new Error(
      `Invalid configuration:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }
  return config;
}

export default () => loadConfig();
