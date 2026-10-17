import type { Role } from '../config/configuration';

/** The authenticated principal attached to requests and sockets. */
export interface AuthUser {
  username: string;
  role: Role;
}
