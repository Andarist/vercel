import { FileFsRef } from '@vercel/build-utils';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import type { Files } from '@vercel/build-utils';

export type FsValue = Buffer | string | { copy: string } | { symlink: string };
export type Fs = Record<string, FsValue>;

export type Filesystem = {
  workPath: string;
  repoRootPath: string;
  files: Files;
};

export async function prepareFilesystem(
  files: Fs,
  folderPrefix = 'vercel-node-tests',
  workPathPrefix = ''
): Promise<Filesystem> {
  const directory = join(tmpdir(), `${folderPrefix}-${Date.now()}`);
  const workPath = workPathPrefix ? join(directory, workPathPrefix) : directory;
  await fs.mkdir(workPath, { recursive: true });
  const fileRefs: Files = {};

  for (const [key, value] of Object.entries(files)) {
    const fullPath = join(workPath, key);
    await fs.mkdir(dirname(fullPath), { recursive: true });

    if (typeof value === 'string' || value instanceof Buffer) {
      await fs.writeFile(fullPath, value);
    } else if ('copy' in value) {
      await fs.copyFile(join(workPath, value.copy), fullPath);
    } else if ('symlink' in value) {
      await fs.symlink(value.symlink, fullPath, 'dir');
    }

    fileRefs[key] = await FileFsRef.fromFsPath({
      fsPath: fullPath,
    });
  }

  return {
    workPath,
    repoRootPath: directory,
    files: fileRefs,
  };
}
