import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { App } from 'supertest/types';

describe('Storify (e2e)', () => {
  let app: INestApplication<App>;
  let storage: string;

  beforeAll(async () => {
    storage = fs.mkdtempSync(path.join(os.tmpdir(), 'storify-e2e-'));
    // Configuration is read when AppModule is first imported, so the
    // environment has to be in place before requiring it.
    Object.assign(process.env, {
      STORAGE_PATH: storage,
      JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret!',
      OPENAI_API_KEY: 'sk-e2e-dummy',
      USERS: 'ADMIN,ALICE,INVITADO',
      USER_ADMIN: 'admin-pass',
      USER_ALICE: 'alice-pass',
      USER_INVITADO: 'guest-pass',
    });
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { AppModule } =
      require('../src/app.module') as typeof import('../src/app.module');
    const { configureApp } =
      require('../src/app.setup') as typeof import('../src/app.setup');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    await configureApp(nestApp);
    await nestApp.init();
    app = nestApp as unknown as INestApplication<App>;
  });

  afterAll(async () => {
    await app?.close();
    fs.rmSync(storage, { recursive: true, force: true });
  });

  const login = async (username: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .type('form')
      .send({ username, password });
    const cookies = res.get('Set-Cookie') ?? [];
    return { res, cookie: cookies.find((c) => c.startsWith('jwt=')) };
  };

  it('renders the login page', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.text).toContain('action="/auth/login"');
  });

  it('rejects the file browser without a session', async () => {
    await request(app.getHttpServer()).get('/files/browser').expect(401);
  });

  it('redirects back to login on wrong credentials', async () => {
    const { res, cookie } = await login('ALICE', 'nope');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/?error=invalid');
    expect(cookie).toBeUndefined();
  });

  it('logs in and opens the file browser', async () => {
    const { res, cookie } = await login('ALICE', 'alice-pass');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/files/browser');
    expect(cookie).toBeDefined();

    await request(app.getHttpServer())
      .get('/files/browser')
      .set('Cookie', cookie!)
      .expect(200);
  });

  // S4: backup endpoints are admin-only.
  it.each([
    ['get', '/admin/dashboard'],
    ['get', '/admin/backup/download'],
    ['post', '/admin/backup'],
  ] as const)('forbids %s %s for non-admin users', async (method, url) => {
    for (const [username, password] of [
      ['INVITADO', 'guest-pass'],
      ['ALICE', 'alice-pass'],
    ]) {
      const { cookie } = await login(username, password);
      await request(app.getHttpServer())
        [method](url)
        .set('Cookie', cookie!)
        .expect(403);
    }
  });

  it('opens the dashboard for the admin', async () => {
    const { cookie } = await login('ADMIN', 'admin-pass');
    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Cookie', cookie!)
      .expect(200);
  });

  it('returns 403 (not 500) for a member reaching another user folder', async () => {
    fs.mkdirSync(path.join(storage, 'users', 'ADMIN'), { recursive: true });
    fs.writeFileSync(path.join(storage, 'users', 'ADMIN', 'secret.txt'), 's');
    const { cookie } = await login('ALICE', 'alice-pass');
    await request(app.getHttpServer())
      .get('/files/download')
      .query({ path: 'ALICE/../ADMIN/secret.txt' })
      .set('Cookie', cookie!)
      .expect(403);
  });

  it('does not let the guest write', async () => {
    const { cookie } = await login('INVITADO', 'guest-pass');
    await request(app.getHttpServer())
      .post('/files/mkdir')
      .set('Cookie', cookie!)
      .send({ path: '', name: 'nope' })
      .expect(403);
  });

  it('rejects a login without password field', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .type('form')
      .send({ username: 'ALICE' });
    expect(res.headers.location).toBe('/?error=invalid');
  });
});
