/**
 * remote.js — Remote download from S3
 *
 * Downloads libnode_<name>.zip from S3, writes atomically (tmp + rename),
 * then extracts the zip to the local warehouse directory.
 */

"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { toolchain } = require("./toolchain");

/** Sentinel error for "package not found on S3" */
class PackageNotExistError extends Error {
  constructor(message) {
    super(message || "dynamic: package not exists");
    this.name = "PackageNotExistError";
  }
}

function isPackageNotExist(err) {
  return err instanceof PackageNotExistError;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createRemote(remotePath) {
  if (!remotePath) return null;

  let url;
  try {
    url = new URL(remotePath);
  } catch {
    throw new Error(`dynamic: invalid remote URL: ${remotePath}`);
  }

  switch (url.protocol) {
    case "s3:":
      return new S3Remote(url.hostname, normalizePrefix(url.pathname));
    default:
      throw new Error(`dynamic: unknown remote scheme: ${url.protocol}`);
  }
}

// ---------------------------------------------------------------------------
// S3Remote
// ---------------------------------------------------------------------------

class S3Remote {
  constructor(bucket, prefix = "") {
    this._bucket = bucket;
    this._prefix = prefix;
  }

  getPath() {
    return this._prefix ? `s3://${this._bucket}/${this._prefix}` : `s3://${this._bucket}`;
  }

  keyFor(name) {
    return posixJoin(toolchain.toString(), name, `libnode_${name}.zip`);
  }

  /**
   * Downloads the zip file for the named package from S3 into the local warehouse.
   *
   * S3 Key: <toolchain>/<name>/libnode_<name>.zip
   */
  async sync(name, localBasePath) {
    const dir = path.join(localBasePath, toolchain.toString(), name);

    // Ensure directory
    fs.mkdirSync(dir, { recursive: true });

    const fileName = `libnode_${name}.zip`;
    const localFilePath = path.join(dir, fileName);
    const remoteKey = this.keyFor(name);

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
      `[dynamic] downloading s3://${this._bucket}/${this._fullKey(remoteKey)} -> ${localFilePath}`
    );

    const startTime = Date.now();

    try {
      await this._downloadFile(remoteKey, localFilePath);
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
  async _downloadFile(remoteKey, localFilePath) {
    const client = new S3Client(createS3ClientConfig());
    const key = this._fullKey(remoteKey);

    let response;
    try {
      response = await client.send(
        new GetObjectCommand({
          Bucket: this._bucket,
          Key: key,
        })
      );
    } catch (err) {
      // S3 NoSuchKey or similar -> PackageNotExistError
      if (
        err.name === "NoSuchKey" ||
        (err.$metadata && err.$metadata.httpStatusCode === 404)
      ) {
        throw new PackageNotExistError(
          `dynamic: S3 object not found: s3://${this._bucket}/${key}`
        );
      }
      throw err;
    }

    if (!response.Body) {
      throw new Error(`dynamic: empty response body for s3://${this._bucket}/${key}`);
    }

    // Write to temp file first, then atomic rename
    const tmpFile = path.join(
      path.dirname(localFilePath),
      `.dynamic-node-${crypto.randomBytes(8).toString("hex")}.tmp`
    );

    try {
      const body = response.Body;
      const writeStream = fs.createWriteStream(tmpFile);

      await new Promise((resolve, reject) => {
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

  _fullKey(key) {
    return this._prefix ? posixJoin(this._prefix, key) : key;
  }
}

function normalizePrefix(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function posixJoin(...parts) {
  return parts
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function createS3ClientConfig() {
  const endpoint =
    process.env.AWS_ENDPOINT_URL_S3 ||
    process.env.AWS_ENDPOINT_URL ||
    process.env.DYNAMIC_NODE_S3_ENDPOINT ||
    "";
  const region = process.env.AWS_REGION || "us-east-1";
  const forcePathStyle = parseBool(
    process.env.AWS_S3_FORCE_PATH_STYLE ||
      process.env.S3_FORCE_PATH_STYLE ||
      process.env.DYNAMIC_NODE_S3_FORCE_PATH_STYLE ||
      endpoint
  );

  return {
    region,
    ...(endpoint ? { endpoint } : {}),
    ...(forcePathStyle ? { forcePathStyle: true } : {}),
  };
}

function parseBool(value) {
  if (!value) {
    return false;
  }
  const normalized = String(value).toLowerCase().trim();
  return !["0", "false", "no", "off"].includes(normalized);
}

module.exports = { PackageNotExistError, isPackageNotExist, createRemote, S3Remote };
