import { describe, expect, test } from 'vitest';
import { build } from '../../src';
import { prepareFilesystem } from './test-utils';
import { join } from 'path';
import { symlink } from 'fs/promises';

describe.skipIf(process.platform === 'win32')('typescript realpath regression', () => {
  test('should build when a TypeScript module is imported through both real and symlinked paths', async () => {
    const filesystem = await prepareFilesystem({
      'package.json': JSON.stringify({
        private: true,
      }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'es2019',
          module: 'commonjs',
          moduleResolution: 'node',
          strict: true,
          skipLibCheck: true,
        },
      }),
      'api/index.ts': `
        import { createUser as createRealUser } from '../packages/lib/src/user';
        import {
          createUser as createSymlinkedUser,
          User as SymlinkedUser,
        } from '../symlinked-lib/user';

        const realUser: SymlinkedUser = createRealUser('vercel');
        const symlinkedUser: SymlinkedUser = createSymlinkedUser('bot');

        export default function handler(_req: unknown, res: { end(body: string): void }) {
          res.end(\`\${realUser.name}:\${symlinkedUser.name}\`);
        }
      `,
      'packages/lib/src/user.ts': `
        export class User {
          private readonly brand = true;

          constructor(public readonly name: string) {}
        }

        export function createUser(name: string) {
          return new User(name);
        }
      `,
    });

    await symlink(
      join(filesystem.workPath, 'packages/lib/src'),
      join(filesystem.workPath, 'symlinked-lib'),
      'dir'
    );

    const buildResult = await build({
      ...filesystem,
      entrypoint: 'api/index.ts',
      config: {},
      meta: { skipDownload: true },
    });

    expect(buildResult.output).toBeDefined();
    expect(buildResult.output.type).toBe('Lambda');
    if (buildResult.output.type === 'Lambda') {
      expect(buildResult.output.files).toHaveProperty('api/index.js');
    }
  });
});
