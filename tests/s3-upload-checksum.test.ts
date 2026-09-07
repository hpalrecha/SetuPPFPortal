// Regression guard for the Sep 2 outage (commit 3f451b6).
//
// aws-sdk-js-v3 >= 3.729 folds an x-amz-checksum-crc32 into presigned PUT URLs
// by default. getObjectEntityUploadURL() builds its PutObjectCommand with no
// Body, so that checksum described an EMPTY payload while the browser then PUT
// real image bytes — S3 rejected every installer photo upload for ~7 weeks.
// The fix is `requestChecksumCalculation: "WHEN_REQUIRED"` on the S3 client.
//
// This asserts the OUTCOME (the generated URL), not the setting, so it also
// catches an SDK upgrade that reintroduces the behaviour by another route.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.AWS_S3_BUCKET ||= 'test-bucket';
process.env.AWS_REGION ||= 'ap-south-1';
process.env.AWS_ACCESS_KEY_ID ||= 'AKIAIOSFODNN7EXAMPLE';
process.env.AWS_SECRET_ACCESS_KEY ||= 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

const { ObjectStorageService } = await import('../server/objectStorage.js');

test('presigned upload URL carries no empty-body checksum', async () => {
  const url = await new ObjectStorageService().getObjectEntityUploadURL();
  const params = new URL(url).searchParams;

  for (const [key, value] of params) {
    const k = key.toLowerCase();
    assert.ok(
      !k.includes('checksum'),
      `presigned PUT URL must not pin a checksum, found ${key}=${value}. ` +
      `Check requestChecksumCalculation on the S3 client in server/objectStorage.ts.`
    );
  }

  const signedHeaders = (params.get('X-Amz-SignedHeaders') || '').toLowerCase();
  assert.ok(
    !signedHeaders.includes('checksum'),
    `presigned PUT URL must not sign a checksum header, got "${signedHeaders}"`
  );
});

test('presigned upload URL is cross-origin S3, which the client guard must ignore', async () => {
  const url = await new ObjectStorageService().getObjectEntityUploadURL();
  const host = new URL(url).host;
  assert.ok(
    host.includes('amazonaws.com'),
    `expected an S3 host so the browser session guard treats it as external, got ${host}`
  );
  assert.match(url, /^https:\/\//);
});
