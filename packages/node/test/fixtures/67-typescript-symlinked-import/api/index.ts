import { createUser as createRealUser } from '../packages/lib/src/user';
import {
  createUser as createSymlinkedUser,
  User as SymlinkedUser,
} from '../symlinked-lib/user';

const realUser: SymlinkedUser = createRealUser('vercel');
const symlinkedUser: SymlinkedUser = createSymlinkedUser('bot');

export default function handler(_req: unknown, res: { end(body: string): void }) {
  res.end(`${realUser.name}:${symlinkedUser.name}`);
}
