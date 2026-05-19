/**
 * remote.ts — Remote download from S3 (counterpart of Go remote.go)
 *
 * Downloads libnode_<name>.zip from S3, writes atomically (tmp + rename),
 * then extracts the zip to the local warehouse directory.
 */

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import { toolchain } from "./toolchain";

/** Sentinel error for "tunnel not found on S3" (counterpart of Go ErrTunnelNotExits) */
export class TunnelNotExistError extends Error {
  constructor(message?: string) {
    super(message || "dynamic: tunnel not exists");
    this.name = "TunnelNotExistError";
  }
}

export function isTunnelNotExist(err: unknown): boolean {
  return err instanceof TunnelNotExistError;
}

// ---------------------------------------------------------------------------
// Remote interface (counterpart of Go Remote interface)
// ---------------------------------------------------------------------------

export interface Remote {
  sync(name: string, localBasePath: string): Promise<void>;
  getPath(): string;
}

// ---------------------------------------------------------------------------
// Factory (counterpart of Go NewRemote)
// ---------------------------------------------------------------------------

export function createRemote(remotePath: string): Remote | null {
  if (!remotePath) return null;

  let url: URL;
  try {
    url = new URL(remotePath);
  } catch {
    throw new Error(`dynamic: invalid remote URL: ${remotePath}`);
  }

  switch (url.protocol) {
    case "s3:":
      // s3://bucket  -> hostname = bucket
      return new S3Remote(url.hostname);
    default:
      throw new Error(`dynamic: unknown remote scheme: ${url.protocol}`);
  }
}

// ---------------------------------------------------------------------------
// S3Remote (counterpart of Go S3Remote)
// ---------------------------------------------------------------------------

class S3Remote implements Remote {
  private readonly bucket: string;

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  getPath(): string {
    return `s3://${this.bucket}`;
  }

  /**
   * Downloads the zip file for the named package from S3 into the local warehouse.
   *
   * S3 Key: <toolchain>/<name>/libnode_<name>.zip
   *
   * Steps:
   *   1. Ensure local directory exists
   *   2. Skip if file already exists and is non-zero
   *   3. Download to a temp file, then atomic rename
   *   4. If S3 object not found, throw TunnelNotExistError
   */
  async sync(name: string, localBasePath: string): Promise<void> {
    const dir = path.join(localBasePath, toolchain.toString(), name);

    // Ensure directory
    fs.mkdirSync(dir, { recursive: true });

    const fileName = `libnode_${name}.zip`;
    const localFilePath = path.join(dir, fileName);
    const remoteKey = [toolchain.toString(), name, fileName].join("/");

    // Skip if already exists and non-zero
    try {
      const stat = fs.statSync(localFilePath);
      if (stat.size > 0) {
        console.log(`[dynamic] ${localFilePath} already exists, skipping download`);
        return;
      }
      // File exists but is 0 bytes — remove and re-download
      console.log(`[dynamic] ${localFilePath} is empty, re-downloading`);
      fs.unlinkSync(localFilePath);
    } catch {
      // File does not exist — proceed to download
    }

    console.log(
      `[dynamic] downloading s3://${this.bucket}/${remoteKey} -> ${localFilePath}`
    );

    const startTime = Date.now();

    try {
      await this.downloadFile(remoteKey, localFilePath);
    } catch (err) {
      // Clean up directory on failure
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
      throw err;
    }

    console.log(
      `[dynamic] download completed in ${Date.now() - startTime}ms`
    );
  }

  /**
   * Downloads a single file from S3 with atomic write (tmp + rename).
   */
  private async downloadFile(
    remoteKey: string,
    localFilePath: string
  ): Promise<void> {
    const client = new S3Client({});

    let response;
    try {
      response = await client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: remoteKey,
        })
      );
    } catch (err: unknown) {
      // S3 NoSuchKey or similar -> TunnelNotExistError
      const errAny = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (
        errAny.name === "NoSuchKey" ||
        errAny.$metadata?.httpStatusCode === 404
      ) {
        throw new TunnelNotExistError(
          `dynamic: S3 object not found: s3://${this.bucket}/${remoteKey}`
        );
      }
      throw err;
    }

    if (!response.Body) {
      throw new Error(`dynamic: empty response body for s3://${this.bucket}/${remoteKey}`);
    }

    // Write to temp file first, then atomic rename (R1.5)
    const tmpFile = path.join(
      os.tmpdir(),
      `dynamic-node-${crypto.randomBytes(8).toString("hex")}.tmp`
    );

    try {
      const body = response.Body as Readable;
      const writeStream = fs.createWriteStream(tmpFile);

      await new Promise<void>((resolve, reject) => {
        body.pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        body.on("error", reject);
      });

      // Verify content length if available
      const stat = fs.statSync(tmpFile);
      if (response.ContentLength !== undefined && stat.size !== response.ContentLength) {
        throw new Error(
          `dynamic: size mismatch — expected ${response.ContentLength}, got ${stat.size}`
        );
      }

      // Atomic rename into place
      fs.renameSync(tmpFile, localFilePath);
    } catch (err) {
      // Clean up temp file on failure
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // ignore
      }
      throw err;
    }
  }
}
