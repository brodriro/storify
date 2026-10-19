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

  it('disables AI without an API key or base URL', () => {
    expect(loadConfig(base).llm).toMatchObject({
      enabled: false,
      model: 'gpt-5-mini',
    });
  });

  it('enables OpenAI with an API key', () => {
    expect(
      loadConfig({ ...base, OPENAI_API_KEY: 'sk-test' }).llm,
    ).toMatchObject({
      enabled: true,
      apiKey: 'sk-test',
      baseUrl: null,
      providerLabel: 'OpenAI',
    });
  });

  it('supports a local OpenAI-compatible endpoint without a key', () => {
    expect(
      loadConfig({
        ...base,
        LLM_BASE_URL: 'http://nas.local:11434/v1',
        LLM_MODEL: 'qwen3:8b',
      }).llm,
    ).toMatchObject({
      enabled: true,
      apiKey: null,
      model: 'qwen3:8b',
      providerLabel: 'nas.local:11434',
    });
  });

  it('rejects a malformed LLM_BASE_URL', () => {
    expect(() => loadConfig({ ...base, LLM_BASE_URL: 'ftp://x' })).toThrow(
      'LLM_BASE_URL',
    );
  });

  it('limits assistant requests per user (20/min by default)', () => {
    expect(loadConfig(base).chatMessagesPerMinute).toBe(20);
    expect(
      loadConfig({ ...base, CHAT_MESSAGES_PER_MINUTE: '5' })
        .chatMessagesPerMinute,
    ).toBe(5);
    expect(() =>
      loadConfig({ ...base, CHAT_MESSAGES_PER_MINUTE: '0' }),
    ).toThrow('CHAT_MESSAGES_PER_MINUTE');
  });

  it('only limits uploads when TOTAL_STORAGE_GB is set', () => {
    const unset = loadConfig(base);
    expect(unset.totalStorageGb).toBe(10);
    expect(unset.storageLimitBytes).toBeNull();
    expect(
      loadConfig({ ...base, TOTAL_STORAGE_GB: '2' }).storageLimitBytes,
    ).toBe(2 * 1024 ** 3);
  });

  it('only marks cookies secure in production', () => {
    expect(loadConfig(base).cookieSecure).toBe(false);
    expect(loadConfig({ ...base, NODE_ENV: 'production' }).cookieSecure).toBe(
      true,
    );
  });
});
