import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type { PgnApiResponse, PgnPostData } from '../../shared/pgn';
import {
  readRedisPgnRecord,
  verifyRedisPgnIntegrity,
} from '../storage';

export const api = new Hono();

api.get('/pgn', async (c) => {
  const { postId, postData } = context;

  if (!postId) {
    console.error('API /pgn Error: postId not found in context');
    return c.json<PgnApiResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  if (!postData) {
    console.error(`API /pgn Error: postData not found for post ${postId}`);
    return c.json<PgnApiResponse>(
      {
        status: 'error',
        message: 'Post data not found',
      },
      400
    );
  }

  const parsedPostData = postData as unknown as PgnPostData;

  if (parsedPostData.kind !== 'pgn-viewer' || parsedPostData.version !== 1) {
    console.error(
      `API /pgn Error: invalid postData kind/version for post ${postId}`
    );
    return c.json<PgnApiResponse>(
      {
        status: 'error',
        message: 'This post is not a PGN viewer',
      },
      400
    );
  }

  const record = await readRedisPgnRecord(parsedPostData.redisKey);
  if (!record) {
    console.error(
      `API /pgn Error: Redis record not found at ${parsedPostData.redisKey}`
    );
    return c.json<PgnApiResponse>(
      {
        status: 'error',
        message: 'PGN data not found',
      },
      404
    );
  }

  if (!verifyRedisPgnIntegrity(record, parsedPostData)) {
    console.error(
      `API /pgn Error: integrity check failed for post ${postId}`
    );
    return c.json<PgnApiResponse>(
      {
        status: 'error',
        message: 'PGN data integrity check failed',
        description: record.description,
      },
      500
    );
  }

  return c.json<PgnApiResponse>({
    status: 'ok',
    postId,
    pgn: record.pgn,
    headers: record.headers,
    plyCount: record.plyCount,
    description: record.description,
    errorMessage: record.errorMessage,
  });
});
