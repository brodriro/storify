#!/usr/bin/env node
// Prints a bcrypt hash for USER_<NAME> in .env. Reads the password from stdin
// so it doesn't end up in the shell history:
//   pnpm hash-password            (type it, then Enter)
//   printf '%s' "$PW" | pnpm hash-password
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline';

const COST = 12;

async function readPassword() {
  if (!process.stdin.isTTY) {
    let data = '';
    for await (const chunk of process.stdin) data += chunk;
    return data.replace(/\r?\n$/, '');
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  // Hide typed characters.
  rl._writeToOutput = () => {};
  process.stderr.write('Password: ');
  const answer = await new Promise((resolve) => rl.question('', resolve));
  rl.close();
  process.stderr.write('\n');
  return answer;
}

const password = await readPassword();
if (!password) {
  console.error('Empty password');
  process.exit(1);
}
const hash = await bcrypt.hash(password, COST);
// Single quotes keep "$" literal in .env files and most shells.
console.log(`'${hash}'`);
