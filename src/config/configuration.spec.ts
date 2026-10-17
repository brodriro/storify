import { loadConfig } from './configuration';

const base = {
  USERS: 'ADMIN,ALICE,INVITADO',
  USER_ADMIN: 'a',
  USER_ALICE: 'b',
  USER_INVITADO: 'c',
  JWT_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('derives roles from usernames', () => {
    expect(loadConfig(base).users.map((u) => [u.username, u.role])).toEqual([
      ['ADMIN', 'admin'],
      ['ALICE', 'member'],
      ['INVITADO', 'guest'],
    ]);
  });

  it.each([
    [{ JWT_SECRET: undefined }, 'JWT_SECRET'],
    [{ JWT_SECRET: 'secretKey' }, 'JWT_SECRET'],
    // A listed user without password used to accept a login with no password.
    [{ USER_ALICE: undefined }, 'USER_ALICE'],
    [{ USERS: '' }, 'USERS'],
    [{ USERS: 'ADMIN,../evil' }, 'Invalid username'],
    [{ TOTAL_STORAGE_GB: 'lots' }, 'TOTAL_STORAGE_GB'],
  ])('refuses to start with %j', (override, message) => {
    expect(() => loadConfig({ ...base, ...override })).toThrow(message);
  });

  it('disables AI without an API key and enables it with one', () => {
    expect(loadConfig(base).openaiApiKey).toBeNull();
    expect(
      loadConfig({ ...base, OPENAI_API_KEY: 'sk-test' }).openaiApiKey,
    ).toBe('sk-test');
  });

  it('only marks cookies secure in production', () => {
    expect(loadConfig(base).cookieSecure).toBe(false);
    expect(loadConfig({ ...base, NODE_ENV: 'production' }).cookieSecure).toBe(
      true,
    );
  });
});
