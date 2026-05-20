import { describe, expect, test } from 'vitest';
import { build } from '../../src';
import { prepareFilesystem } from './test-utils';
import { lstat, readlink } from 'fs/promises';
import { createRequire } from 'module';
import { join } from 'path';

describe.skipIf(process.platform === 'win32')('typescript realpath regression', () => {
  test('should build when a pnpm-style symlinked package is imported through both symlinked and real paths', async () => {
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
        import {
          createUser as createSymlinkedUser,
          User as SymlinkedUser,
        } from 'workspace-lib';
        import {
          createUser as createRealUser,
          User as RealUser,
        } from '../node_modules/.pnpm/workspace-lib@1.0.0/node_modules/workspace-lib';

        const realUser: SymlinkedUser = createRealUser('vercel');
        const symlinkedUser: RealUser = createSymlinkedUser('bot');

        export default function handler(_req: unknown, res: { end(body: string): void }) {
          res.end(\`\${realUser.name}:\${symlinkedUser.name}\`);
        }
      `,
      'node_modules/.pnpm/workspace-lib@1.0.0/node_modules/workspace-lib/package.json': JSON.stringify({
        name: 'workspace-lib',
        version: '1.0.0',
        main: 'index.js',
        types: 'index.d.ts',
      }),
      'node_modules/.pnpm/workspace-lib@1.0.0/node_modules/workspace-lib/index.js': `
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
      'node_modules/.pnpm/workspace-lib@1.0.0/node_modules/workspace-lib/index.d.ts': `
        export declare class User {
          private readonly brand;
          readonly name: string;
          constructor(name: string);
        }

        export declare function createUser(name: string): User;
      `,
      'node_modules/workspace-lib': {
        symlink: '.pnpm/workspace-lib@1.0.0/node_modules/workspace-lib',
      },
    });

    const workspaceLibPath = join(filesystem.workPath, 'node_modules/workspace-lib');
    const workspaceLibStat = await lstat(workspaceLibPath);
    expect(workspaceLibStat.isSymbolicLink()).toBe(true);
    expect(await readlink(workspaceLibPath)).toBe(
      '.pnpm/workspace-lib@1.0.0/node_modules/workspace-lib'
    );

    const requireFromWorkPath = createRequire(
      join(filesystem.workPath, 'package.json')
    );
    expect(
      requireFromWorkPath.resolve('workspace-lib/package.json')
    ).toBe(
      join(
        filesystem.workPath,
        'node_modules/.pnpm/workspace-lib@1.0.0/node_modules/workspace-lib/package.json'
      )
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
