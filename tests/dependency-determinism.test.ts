// The Sep 2 outage was not caused by a code change. The production Dockerfile
// does `rm -f package-lock.json && npm install`, so a rebuild silently resolved
// a newer @aws-sdk minor whose default checksum behaviour broke every installer
// photo upload. Pinning the AWS SDK to exact versions makes that impossible
// even while the Dockerfile keeps deleting the lockfile.
//
// If you need to move the SDK, change these pins deliberately and re-run the
// presigned-URL test in s3-upload-checksum.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lockPath = join(root, 'package-lock.json');

// Every package whose version can change how uploads or e-warranty mail behave.
const MUST_BE_PINNED = [
  '@aws-sdk/client-s3',
  '@aws-sdk/s3-request-presigner',
  '@aws-sdk/client-ses',
];

test('AWS SDK versions are pinned exactly, not ranged', () => {
  for (const name of MUST_BE_PINNED) {
    const spec = pkg.dependencies?.[name];
    assert.ok(spec, `${name} is missing from dependencies`);
    assert.match(
      spec,
      /^\d+\.\d+\.\d+$/,
      `${name} must be an exact version so a Docker rebuild cannot change it, got "${spec}"`
    );
  }
});

test('package-lock.json is committed and matches the pinned specs', () => {
  assert.ok(existsSync(lockPath), 'package-lock.json must be committed for reproducible installs');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  assert.ok(lock.lockfileVersion >= 2, `expected lockfileVersion >= 2, got ${lock.lockfileVersion}`);

  for (const name of MUST_BE_PINNED) {
    const declared = pkg.dependencies[name];
    assert.equal(
      lock.packages['']?.dependencies?.[name],
      declared,
      `lockfile root spec for ${name} is out of sync with package.json — run npm install --package-lock-only`
    );
    assert.equal(
      lock.packages[`node_modules/${name}`]?.version,
      declared,
      `lockfile resolves ${name} to a different version than the pin`
    );
  }
});
