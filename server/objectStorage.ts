import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as presignS3Url } from "@aws-sdk/s3-request-presigner";
import { Response } from "express";
import { randomUUID } from "crypto";

// Shared bucket across P91 apps (marketing brochures live under their own
// prefixes: just-signs/, p91-car-care/, stek/). This app's objects live under
// setuppf-uploads/ — the same prefix the historical Replit/GCS objects were
// migrated into, so existing job-card records keep resolving to real files.
const S3_BUCKET = process.env.AWS_S3_BUCKET || "";
const S3_PREFIX = process.env.AWS_S3_PREFIX || "setuppf-uploads";
const AWS_REGION = process.env.AWS_REGION || "ap-south-1";

export const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

function assertBucketConfigured(): void {
  if (!S3_BUCKET) {
    throw new Error(
      "AWS_S3_BUCKET not set. Set it to the S3 bucket used for file storage (e.g. p91-brochures)."
    );
  }
}

// entityId is the app-facing id with no leading slash, e.g. "uploads/<uuid>.jpg"
// (the "/objects/" route/path convention keeps that "uploads/" segment for
// compatibility with existing DB records, but the bucket itself is flat —
// setuppf-uploads/<uuid>.jpg, no nested "uploads/" folder — so strip it here).
function keyForEntity(entityId: string): string {
  const id = entityId.startsWith("uploads/") ? entityId.slice("uploads/".length) : entityId;
  return `${S3_PREFIX}/${id}`;
}

// Reference to an object that has been confirmed to exist in S3.
export interface ObjectRef {
  key: string;
}

// The object storage service is used to interact with S3.
export class ObjectStorageService {
  constructor() {}

  // Gets a presigned PUT URL the client can upload a file directly to.
  async getObjectEntityUploadURL(): Promise<string> {
    assertBucketConfigured();
    const objectId = randomUUID();
    const key = keyForEntity(`uploads/${objectId}`);
    const command = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key });
    return presignS3Url(s3Client, command, { expiresIn: 900 });
  }

  // Normalizes a raw presigned PUT URL (or an already-normalized "/objects/..."
  // path) into the stable, storage-backend-agnostic path used everywhere else
  // in the app and persisted to the DB: "/objects/uploads/<id>".
  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }
    if (!rawPath.startsWith("http://") && !rawPath.startsWith("https://")) {
      return rawPath;
    }

    try {
      const url = new URL(rawPath);
      // Virtual-hosted-style (<bucket>.s3.<region>.amazonaws.com/<key>) or
      // path-style (s3.<region>.amazonaws.com/<bucket>/<key>) — either way the
      // key always ends in "<S3_PREFIX>/<id>" (flat, no nested folder).
      const marker = `/${S3_PREFIX}/`;
      const idx = url.pathname.indexOf(marker);
      if (idx === -1) {
        return rawPath;
      }
      const id = url.pathname.slice(idx + marker.length);
      return `/objects/uploads/${id}`;
    } catch {
      return rawPath;
    }
  }

  // Resolves an app-facing "/objects/..." path to an S3 object, confirming it
  // actually exists (throws ObjectNotFoundError otherwise).
  async getObjectEntityFile(objectPath: string): Promise<ObjectRef> {
    assertBucketConfigured();
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const entityId = objectPath.slice("/objects/".length);
    const key = keyForEntity(entityId);
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    } catch {
      throw new ObjectNotFoundError();
    }
    return { key };
  }

  // Kept for call-site compatibility with the old GCS ACL flow. S3 access
  // control here is presigned-URL-only (the bucket blocks all public access
  // and has no bucket policy) — there is no per-object ACL to set. This just
  // normalizes the path and confirms the upload actually landed in S3.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    _aclPolicy?: unknown
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/objects/")) {
      return normalizedPath;
    }
    await this.getObjectEntityFile(normalizedPath);
    return normalizedPath;
  }

  // Generates a presigned GET URL for displaying/downloading a stored object.
  // Accepts either a normalized "/objects/..." path or a raw URL from an
  // older/foreign storage backend — returns null if it can't be resolved.
  async getSignedUrl(objectPath: string, ttlSec: number = 3600): Promise<string | null> {
    try {
      assertBucketConfigured();
      const normalized = this.normalizeObjectEntityPath(objectPath);
      if (!normalized.startsWith("/objects/")) {
        return null;
      }
      const entityId = normalized.slice("/objects/".length);
      const key = keyForEntity(entityId);
      const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
      return await presignS3Url(s3Client, command, { expiresIn: ttlSec });
    } catch (error) {
      console.error("Error generating signed URL:", error);
      return null;
    }
  }

  // Streams an object to the response (used by GET /objects/*).
  async downloadObject(objectRef: ObjectRef, res: Response, cacheTtlSec: number = 3600): Promise<void> {
    try {
      const result = await s3Client.send(
        new GetObjectCommand({ Bucket: S3_BUCKET, Key: objectRef.key })
      );
      res.set({
        "Content-Type": result.ContentType || "application/octet-stream",
        ...(result.ContentLength != null ? { "Content-Length": String(result.ContentLength) } : {}),
        "Cache-Control": `private, max-age=${cacheTtlSec}`,
      });

      const stream = result.Body as unknown as NodeJS.ReadableStream;
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Server-side buffer upload (e.g. multer writes a temp file, the route reads
  // it back into a buffer and calls this to push it to S3).
  async uploadBuffer(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    assertBucketConfigured();
    const objectId = randomUUID();
    const extension = filename.split(".").pop() || "jpg";
    const entityId = `uploads/${objectId}.${extension}`;
    const key = keyForEntity(entityId);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: { originalFilename: filename },
      })
    );

    return `/objects/${entityId}`;
  }
}
