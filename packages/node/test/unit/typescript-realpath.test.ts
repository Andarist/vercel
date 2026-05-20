import { describe, expect, test } from 'vitest';
import { build } from '../../src';
import { prepareFilesystem } from './test-utils';
import { join } from 'path';
import { mkdir, symlink } from 'fs/promises';

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
          noEmitOnError: true,
          skipLibCheck: true,
        },
      }),
      'api/index.ts': `
        import { createUser as createRealUser, User as RealUser } from '../packages/lib';
        import {
          createUser as createSymlinkedUser,
          User as SymlinkedUser,
        } from 'workspace-lib';

        const realUser: SymlinkedUser = createRealUser('vercel');
        const symlinkedUser: RealUser = createSymlinkedUser('bot');

        export default function handler(_req: unknown, res: { end(body: string): void }) {
          res.end(\`\${realUser.name}:\${symlinkedUser.name}\`);
        }
      `,
      'packages/lib/package.json': JSON.stringify({
        name: 'workspace-lib',
        main: 'index.js',
        types: 'index.d.ts',
      }),
      'packages/lib/index.js': `
        class User {
          #brand = true;

          constructor(name) {
            this.name = name;
          }
        }

        function createUser(name) {
          return new User(name);
        }

        module.exports = {
          User,
          createUser,
        };
      `,
      'packages/lib/index.d.ts': `
        export declare class User {
          private readonly brand;
          readonly name: string;
          constructor(name: string);
        }

        export declare function createUser(name: string): User;
      `,
    });

    await mkdir(join(filesystem.workPath, 'node_modules'), { recursive: true });
    await symlink(
      join(filesystem.workPath, 'packages/lib'),
      join(filesystem.workPath, 'node_modules/workspace-lib'),
      'dir'
    );

    const buildResult = await expect(
      build({
        ...filesystem,
        entrypoint: 'api/index.ts',
        config: {},
        meta: { skipDownload: true },
      })
    ).resolves.toBeDefined();

    expect(buildResult.output).toBeDefined();
    expect(buildResult.output.type).toBe('Lambda');
    if (buildResult.output.type === 'Lambda') {
      expect(buildResult.output.files).toHaveProperty('api/index.js');
    }
  });
});
