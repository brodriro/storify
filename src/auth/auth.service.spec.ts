import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { AppConfig } from '../config/configuration';
import { AuthService, isBcryptHash } from './auth.service';

describe('AuthService', () => {
  const hash = bcrypt.hashSync('s3creta', 4);
  const service = new AuthService(
    new ConfigService({
      users: [
        { username: 'ADMIN', password: hash, role: 'admin' },
        { username: 'ALICE', password: 'plain-pass', role: 'member' },
      ],
    }) as unknown as ConfigService<AppConfig, true>,
    new JwtService({ secret: 'x'.repeat(32) }),
  );

  it.each([
    ['ADMIN', 's3creta', 'admin'],
    ['ALICE', 'plain-pass', 'member'],
  ])('accepts %s with the right password', async (username, password, role) => {
    await expect(service.validateUser(username, password)).resolves.toEqual({
      username,
      role,
    });
  });

  it.each([
    ['ADMIN', 'wrong'],
    ['ADMIN', hash], // the stored hash itself is not a password
    ['ALICE', 'plain-pas'],
    ['MALLORY', 's3creta'],
    ['ALICE', undefined],
    [undefined, 'plain-pass'],
  ])('rejects %s / %s', async (username, password) => {
    await expect(service.validateUser(username, password)).resolves.toBeNull();
  });

  it('recognizes bcrypt hashes', () => {
    expect(isBcryptHash(hash)).toBe(true);
    expect(isBcryptHash('plain-pass')).toBe(false);
    expect(isBcryptHash('$2b$-not-a-hash')).toBe(false);
  });

  it('issues tokens that resolve back to the configured user', () => {
    const { access_token } = service.login({
      username: 'ALICE',
      role: 'member',
    });
    expect(service.verifyToken(access_token)).toEqual({
      username: 'ALICE',
      role: 'member',
    });
    expect(service.verifyToken(`${access_token}x`)).toBeNull();
  });
});
