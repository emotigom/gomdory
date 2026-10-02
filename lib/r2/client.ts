import { AwsClient } from "aws4fetch";

import { getRuntimeEnv } from "@/lib/server/runtimeEnv";

type RequiredEnvKey =
  | "R2_ACCOUNT_ID"
  | "R2_BUCKET"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY";

type R2Config = {
  endpoint: string;
  bucket: string;
  accountId: string;
  client: AwsClient;
};

export type R2TargetMeta = {
  r2TargetKind: "rest";
  bucketName: string;
  endpoint: string;
  accountId: string;
};

let cachedConfig: R2Config | null = null;

function getEnvValue(key: RequiredEnvKey): string {
  const value = getRuntimeEnv()[key];

  if (!value || typeof value !== "string") {
    throw new Error(`Missing R2 env var: ${key}`);
  }

  return value;
}

function encodeR2Key(key: string): string {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function getR2Config(): R2Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const accountId = getEnvValue("R2_ACCOUNT_ID");
  const bucket = getEnvValue("R2_BUCKET");
  const accessKeyId = getEnvValue("R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnvValue("R2_SECRET_ACCESS_KEY");

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  cachedConfig = {
    endpoint,
    bucket,
    accountId,
    client: new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    }),
  };

  return cachedConfig;
}

export function getR2TargetMeta(): R2TargetMeta {
  const config = getR2Config();

  return {
    r2TargetKind: "rest",
    bucketName: config.bucket,
    endpoint: config.endpoint,
    accountId: config.accountId,
  };
}

function validateExpires(expiresSeconds: number): void {
  if (!Number.isFinite(expiresSeconds) || expiresSeconds <= 0) {
    throw new Error("expiresSeconds must be a positive number");
  }
}

export async function presignPutUrl(input: {
  key: string;
  contentType: string;
  expiresSeconds: number;
}): Promise<string> {
  validateExpires(input.expiresSeconds);

  const { endpoint, bucket, client } = getR2Config();
  const objectUrl = new URL(`${endpoint}/${bucket}/${encodeR2Key(input.key)}`);
  objectUrl.searchParams.set("X-Amz-Expires", `${input.expiresSeconds}`);

  const signed = await client.sign(objectUrl, {
    method: "PUT",
    headers: {
      "Content-Type": input.contentType,
    },
    aws: { signQuery: true },
  });

  return signed.url;
}

export async function presignGetUrl(input: {
  key: string;
  expiresSeconds: number;
}): Promise<string> {
  validateExpires(input.expiresSeconds);

  const { endpoint, bucket, client } = getR2Config();
  const objectUrl = new URL(`${endpoint}/${bucket}/${encodeR2Key(input.key)}`);
  objectUrl.searchParams.set("X-Amz-Expires", `${input.expiresSeconds}`);

  const signed = await client.sign(objectUrl, {
    method: "GET",
    aws: { signQuery: true },
  });

  return signed.url;
}

export async function getObject(key: string): Promise<Response> {
  const { endpoint, bucket, client } = getR2Config();
  const objectUrl = `${endpoint}/${bucket}/${encodeR2Key(key)}`;
  const signed = await client.sign(objectUrl, { method: "GET" });
  return fetch(signed);
}

export async function headObject(key: string): Promise<{
  exists: boolean;
  contentLength?: number;
}> {
  const { endpoint, bucket, client } = getR2Config();
  const objectUrl = `${endpoint}/${bucket}/${encodeR2Key(key)}`;
  const signed = await client.sign(objectUrl, { method: "HEAD" });
  const response = await fetch(signed);

  if (response.status === 404) {
    return { exists: false };
  }

  if (!response.ok) {
    throw new Error(`Failed to check object: ${response.statusText}`);
  }

  const lengthHeader = response.headers.get("content-length");
  const parsedLength = lengthHeader ? Number.parseInt(lengthHeader, 10) : Number.NaN;

  return {
    exists: true,
    contentLength: Number.isFinite(parsedLength) ? parsedLength : undefined,
  };
}

export async function deleteObject(
  key: string,
): Promise<{ existed: boolean }> {
  const { endpoint, bucket, client } = getR2Config();
  const objectUrl = `${endpoint}/${bucket}/${encodeR2Key(key)}`;
  const signed = await client.sign(objectUrl, { method: "DELETE" });
  const response = await fetch(signed);

  if (response.status === 404) {
    return { existed: false };
  }

  if (!response.ok) {
    throw new Error(`Failed to delete object: ${response.statusText}`);
  }

  return { existed: true };
}

type ListObjectsInput = {
  prefix?: string;
  continuationToken?: string;
  maxKeys?: number;
};

type ListObjectsResult = {
  bytes: number;
  count: number;
  isTruncated: boolean;
  nextContinuationToken?: string;
};

type ListObjectKeysResult = {
  keys: string[];
  isTruncated: boolean;
  nextContinuationToken?: string;
};

function parseListObjectsResponse(xml: string): ListObjectsResult {
  const contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
  const sizeRegex = /<Size>(\d+)<\/Size>/;
  let bytes = 0;
  let count = 0;

  for (const match of xml.matchAll(contentsRegex)) {
    const content = match[1] ?? "";
    const sizeMatch = content.match(sizeRegex);
    if (!sizeMatch) continue;
    const size = Number.parseInt(sizeMatch[1] ?? "0", 10);
    if (Number.isFinite(size)) {
      bytes += size;
      count += 1;
    }
  }

  const isTruncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);

  return {
    bytes,
    count,
    isTruncated,
    nextContinuationToken: tokenMatch?.[1],
  };
}

function parseListObjectKeysResponse(xml: string): ListObjectKeysResult {
  const keyRegex = /<Key>([^<]+)<\/Key>/g;
  const keys: string[] = [];

  for (const match of xml.matchAll(keyRegex)) {
    const key = match[1];
    if (key) {
      keys.push(key);
    }
  }

  const isTruncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);

  return {
    keys,
    isTruncated,
    nextContinuationToken: tokenMatch?.[1],
  };
}

export async function listObjectsV2(input: ListObjectsInput = {}): Promise<ListObjectsResult> {
  const { endpoint, bucket, client } = getR2Config();
  const url = new URL(`${endpoint}/${bucket}`);
  url.searchParams.set("list-type", "2");

  if (input.prefix) {
    url.searchParams.set("prefix", input.prefix);
  }
  if (input.continuationToken) {
    url.searchParams.set("continuation-token", input.continuationToken);
  }
  if (input.maxKeys) {
    url.searchParams.set("max-keys", `${input.maxKeys}`);
  }

  const signed = await client.sign(url, { method: "GET" });
  const response = await fetch(signed);

  if (!response.ok) {
    throw new Error(`Failed to list objects: ${response.statusText}`);
  }

  const xml = await response.text();
  return parseListObjectsResponse(xml);
}

export async function listObjectKeysV2(input: ListObjectsInput = {}): Promise<ListObjectKeysResult> {
  const { endpoint, bucket, client } = getR2Config();
  const url = new URL(`${endpoint}/${bucket}`);
  url.searchParams.set("list-type", "2");

  if (input.prefix) {
    url.searchParams.set("prefix", input.prefix);
  }
  if (input.continuationToken) {
    url.searchParams.set("continuation-token", input.continuationToken);
  }
  if (input.maxKeys) {
    url.searchParams.set("max-keys", `${input.maxKeys}`);
  }

  const signed = await client.sign(url, { method: "GET" });
  const response = await fetch(signed);

  if (!response.ok) {
    throw new Error(`Failed to list objects: ${response.statusText}`);
  }

  const xml = await response.text();
  return parseListObjectKeysResponse(xml);
}

export async function prefixExists(prefix: string): Promise<boolean> {
  const result = await listObjectsV2({ prefix, maxKeys: 1 });
  return result.count > 0;
}
