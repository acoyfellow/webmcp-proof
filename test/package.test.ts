import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runWebMcpProof } from '../src/index';

describe('package surface', () => {
  test('exports the native proof runner', () => {
    expect(typeof runWebMcpProof).toBe('function');
  });

  test('rejects a missing browser and removes its profile', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'webmcp-proof-test-'));
    const previous = process.cwd();
    process.chdir(directory);
    try {
      await expect(
        runWebMcpProof({
          browserPath: join(directory, 'missing-browser'),
          url: 'https://example.com',
          calls: [],
          timeoutMs: 100,
        }),
      ).rejects.toThrow();
      expect(readdirSync(directory)).toEqual([]);
    } finally {
      process.chdir(previous);
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
