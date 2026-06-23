import { randomUUID } from 'node:crypto';
import { redis } from '@devvit/web/server';
import type { RedisPgnRecord, PgnPostData } from '../shared/pgn';

const REDIS_KEY_PREFIX = 'pgn-viewer:v1:pgn:';

export function generateRedisKey(): string {
  return `${REDIS_KEY_PREFIX}${randomUUID()}`;
}

export async function writeRedisPgnRecord(
  redisKey: string,
  pgn: string,
  headers: PgnPostData['headers'],
  plyCount: number,
  pgnSha256: string,
  pgnLength: number,
  postId?: string
): Promise<void> {
  const record: RedisPgnRecord = {
    version: 1,
    pgn,
    headers,
    plyCount,
    pgnLength,
    pgnSha256,
    postId,
    createdAt: new Date().toISOString(),
  };
  await redis.set(redisKey, JSON.stringify(record));
}

export async function readRedisPgnRecord(
  redisKey: string
): Promise<RedisPgnRecord | null> {
  const raw = await redis.get(redisKey);
  if (!raw) return null;

  try {
    const record = JSON.parse(raw) as RedisPgnRecord;
    if (record.version !== 1 || !record.pgn) {
      console.error(`Invalid Redis record at ${redisKey}`);
      return null;
    }
    return record;
  } catch {
    console.error(`Failed to parse Redis record at ${redisKey}`);
    return null;
  }
}

export async function updateRedisPgnRecordPostId(
  redisKey: string,
  postId: string
): Promise<void> {
  const record = await readRedisPgnRecord(redisKey);
  if (!record) {
    throw new Error(`Cannot update postId: record not found at ${redisKey}`);
  }
  record.postId = postId;
  await redis.set(redisKey, JSON.stringify(record));
}

export async function deleteRedisPgnRecord(redisKey: string): Promise<void> {
  await redis.del(redisKey);
}

export function verifyRedisPgnIntegrity(
  record: RedisPgnRecord,
  postData: PgnPostData
): boolean {
  if (record.pgnSha256 !== postData.pgnSha256) {
    console.error(
      `Hash mismatch: Redis ${record.pgnSha256} vs postData ${postData.pgnSha256}`
    );
    return false;
  }
  if (record.pgnLength !== postData.pgnLength) {
    console.error(
      `Length mismatch: Redis ${record.pgnLength} vs postData ${postData.pgnLength}`
    );
    return false;
  }
  return true;
}
