import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import sharp from 'sharp';
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
      // bcrypt hash of 'admin-pass' (cost 4): exercises hashed passwords end to end
      USER_ADMIN: bcrypt.hashSync('admin-pass', 4),
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
    app = nestApp;
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

  it('sends a strict CSP and serves the client libraries locally', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.headers['content-security-policy']).toContain(
      "script-src 'self'",
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    // No inline scripts and no chat (and no socket) on the login page.
    expect(res.text).not.toMatch(/<script>|onclick=/);
    expect(res.text).not.toContain('chat.js');

    // Works without Internet access: no third-party origins at all (U8).
    expect(res.headers['content-security-policy']).not.toMatch(/https?:/);
    expect(res.text).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);

    for (const url of [
      '/vendor/marked/marked.umd.js',
      '/vendor/dompurify/purify.min.js',
      '/js/browser.js',
      '/css/fonts.css',
      '/favicon.svg',
      '/vendor/fira-sans/fira-sans-latin-400-normal.woff2',
      '/vendor/fira-code/fira-code-latin-600-normal.woff2',
    ]) {
      await request(app.getHttpServer()).get(url).expect(200);
    }
    // Every font the stylesheet references exists.
    const fontsCss = (
      await request(app.getHttpServer()).get('/css/fonts.css').expect(200)
    ).text;
    for (const [, url] of fontsCss.matchAll(/url\((\/vendor\/[^)]+)\)/g)) {
      await request(app.getHttpServer()).get(url).expect(200);
    }
  });

  it('renders accessible pages without inline styles (U2, U11)', async () => {
    const { cookie } = await login('ADMIN', 'admin-pass');
    const pages = [
      await request(app.getHttpServer()).get('/').expect(200),
      await request(app.getHttpServer())
        .get('/files/browser')
        .set('Cookie', cookie!)
        .expect(200),
      await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Cookie', cookie!)
        .expect(200),
    ];
    for (const res of pages) {
      expect(res.headers['content-security-policy']).toContain(
        "style-src 'self';",
      );
      expect(res.text).not.toMatch(/\sstyle="|<style[\s>]/);
      expect(res.text.match(/<h1[\s>]/g)).toHaveLength(1);
      expect(res.text).toContain('<main id="main"');
    }
  });

  it('renders hostile file names as inert data (S7)', async () => {
    const hostile = [`x');alert(1);x`, '<img src=x onerror=alert(1)>'];
    fs.mkdirSync(path.join(storage, 'users', 'ALICE'), { recursive: true });
    for (const name of hostile) {
      fs.writeFileSync(path.join(storage, 'users', 'ALICE', name), 'x');
    }
    const { cookie } = await login('ALICE', 'alice-pass');
    const res = await request(app.getHttpServer())
      .get('/files/browser')
      .query({ path: 'ALICE' })
      .set('Cookie', cookie!)
      .expect(200);

    expect(res.text).not.toContain('<img src=x onerror');
    // No event-handler attributes at all (names may appear only as escaped text).
    expect(res.text).not.toMatch(/\son[a-z]+="/);
    const json =
      /<script type="application\/json" id="browserData">(.*?)<\/script>/s.exec(
        res.text,
      )?.[1];
    const data = JSON.parse(json!) as { files: { name: string }[] };
    expect(data.files.map((f) => f.name)).toEqual(
      expect.arrayContaining(hostile),
    );
  });

  it('paginates big folders', async () => {
    const dir = path.join(storage, 'users', 'ALICE', 'fotos');
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 201; i++) {
      fs.writeFileSync(
        path.join(dir, `f${String(i).padStart(3, '0')}.txt`),
        '',
      );
    }
    const { cookie } = await login('ADMIN', 'admin-pass');
    const page = (query: Record<string, string>) =>
      request(app.getHttpServer())
        .get('/files/browser')
        .query({ path: 'ALICE/fotos', ...query })
        .set('Cookie', cookie!)
        .expect(200);
    const names = (html: string) =>
      (
        JSON.parse(/id="browserData">(.*?)<\/script>/s.exec(html)![1]) as {
          files: { name: string }[];
        }
      ).files.map((f) => f.name);

    const first = await page({});
    expect(names(first.text)).toHaveLength(200);
    expect(first.text).toContain('Página 1 de 2');
    // hbs escapes '=' too; browsers decode it back.
    expect(first.text).toMatch(
      /href="\/files\/browser\?path(=|&#x3D;)ALICE%2Ffotos&amp;page(=|&#x3D;)2" rel="next"/,
    );

    // Out-of-range pages show the last one instead of an empty folder.
    const last = await page({ page: '9' });
    expect(names(last.text)).toEqual(['f200.txt']);
    expect(last.text).toContain('Página 2 de 2');
  });

  it('serves cached WebP thumbnails with ETag revalidation (C3)', async () => {
    await sharp({
      create: { width: 640, height: 480, channels: 3, background: '#888' },
    })
      .jpeg()
      .toFile(path.join(storage, 'users', 'ADMIN', 'foto.jpg'));
    const { cookie } = await login('ADMIN', 'admin-pass');
    const get = () =>
      request(app.getHttpServer())
        .get('/files/thumbnail')
        .query({ path: 'ADMIN/foto.jpg' })
        .set('Cookie', cookie!);

    const first = await get().expect(200);
    expect(first.headers['content-type']).toBe('image/webp');
    const etag = first.headers.etag;
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/);

    await get().set('If-None-Match', etag).expect(304);
  });

  it('lists folders for the move picker', async () => {
    fs.mkdirSync(path.join(storage, 'users', 'ADMIN', 'Destino', 'Sub'), {
      recursive: true,
    });
    const { cookie } = await login('ADMIN', 'admin-pass');
    const res = await request(app.getHttpServer())
      .get('/files/folders')
      .query({ path: 'ADMIN' })
      .set('Cookie', cookie!)
      .expect(200);
    expect(res.body).toMatchObject({
      path: 'ADMIN',
      parentPath: '',
      canWrite: true,
      folders: expect.arrayContaining([
        { name: 'Destino', path: 'ADMIN/Destino' },
      ]) as unknown,
    });
    await request(app.getHttpServer())
      .get('/files/folders')
      .query({ path: '../..' })
      .set('Cookie', cookie!)
      .expect(403);
  });

  it('rate-limits repeated logins for one account', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .type('form')
        .send({ username: 'MALLORY', password: `guess-${i}` });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 302)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('lets the admin create and download a backup', async () => {
    fs.mkdirSync(path.join(storage, 'users', 'ALICE'), { recursive: true });
    fs.writeFileSync(path.join(storage, 'users', 'ALICE', 'b.txt'), 'b');
    const { cookie } = await login('ADMIN', 'admin-pass');
    const server = app.getHttpServer();

    await request(server)
      .post('/admin/backup')
      .set('Cookie', cookie!)
      .expect(201, { success: true, inProgress: false });

    for (let i = 0; i < 200; i++) {
      const res = await request(server)
        .get('/admin/backup/in-progress')
        .set('Cookie', cookie!);
      if (!(res.body as { inProgress: boolean }).inProgress) break;
      await new Promise((r) => setTimeout(r, 25));
    }

    const list = await request(server)
      .get('/admin/backup/list')
      .set('Cookie', cookie!)
      .expect(200);
    expect((list.body as { backups: { kind: string }[] }).backups[0].kind).toBe(
      'full',
    );

    const zip = await request(server)
      .get('/admin/backup/download')
      .set('Cookie', cookie!)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(zip.headers['content-type']).toBe('application/zip');
    // ZIP local file header signature "PK\x03\x04"
    expect((zip.body as Buffer).subarray(0, 4)).toEqual(
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    );
  });

  describe('page navigations get redirects, API calls get JSON (A7)', () => {
    it('sends an anonymous visitor to the login page', async () => {
      const res = await request(app.getHttpServer())
        .get('/files/browser')
        .set('Accept', 'text/html')
        .expect(302);
      expect(res.headers.location).toBe('/');
    });

    it('sends a member who opens the dashboard back to the browser', async () => {
      const { cookie } = await login('ALICE', 'alice-pass');
      const res = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Accept', 'text/html')
        .set('Cookie', cookie!)
        .expect(302);
      expect(res.headers.location).toBe('/files/browser');
    });

    it('keeps JSON errors for fetch calls', async () => {
      await request(app.getHttpServer())
        .get('/files/recent')
        .set('Accept', 'application/json')
        .expect(401);
    });
  });

  describe('input validation (C8)', () => {
    let cookie: string;
    beforeAll(async () => {
      cookie = (await login('ALICE', 'alice-pass')).cookie!;
    });

    it.each([
      ['post', '/files/bulk-delete', { paths: 'ALICE/a.txt' }],
      ['post', '/files/bulk-delete', { paths: [1, 2] }],
      ['post', '/files/rename', { path: 'ALICE/a.txt' }],
      ['post', '/files/mkdir', { name: 'x', admin: true }],
      ['delete', '/files/delete', {}],
    ] as const)('rejects %s %s %j with 400', async (method, url, body) => {
      await request(app.getHttpServer())
        [method](url)
        .set('Cookie', cookie)
        .send(body)
        .expect(400);
    });

    it.each(['/files/browser?sort=evil', '/files/recent?days=-1'])(
      'rejects bad query %s',
      async (url) => {
        await request(app.getHttpServer())
          .get(url)
          .set('Cookie', cookie)
          .expect(400);
      },
    );
  });
});
