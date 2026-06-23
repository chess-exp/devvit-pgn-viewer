import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';
import type { JsonObject } from '@devvit/shared-types/json.js';
import type { PgnPostData } from '../../shared/pgn';
import { validatePgn, buildTextFallback } from '../pgn';
import {
  generateRedisKey,
  writeRedisPgnRecord,
  updateRedisPgnRecordPostId,
  deleteRedisPgnRecord,
} from '../storage';

type CreatePgnViewerFormValues = {
  title?: string;
  pgn?: string;
};

export const forms = new Hono();

forms.post('/create-pgn-viewer', async (c) => {
  const { subredditName } = context;
  if (!subredditName) {
    console.error('Form submit error: subredditName not in context');
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post: subreddit not found',
      },
      400
    );
  }

  const body = await c.req.json<CreatePgnViewerFormValues>();
  const { title, pgn } = body;

  const validation = validatePgn(pgn, title ?? '');
  if (!validation.valid) {
    console.error(`Form validation failed: ${validation.message}`);
    return c.json<UiResponse>(
      {
        showToast: validation.message,
      },
      400
    );
  }

  const redisKey = generateRedisKey();

  try {
    await writeRedisPgnRecord(
      redisKey,
      validation.pgn,
      validation.headers,
      validation.plyCount,
      validation.pgnSha256,
      validation.pgnLength
    );

    const postData: PgnPostData = {
      version: 1,
      kind: 'pgn-viewer',
      redisKey,
      headers: validation.headers,
      plyCount: validation.plyCount,
      pgnLength: validation.pgnLength,
      pgnSha256: validation.pgnSha256,
      createdAt: new Date().toISOString(),
    };

    const post = await reddit.submitCustomPost({
      subredditName,
      title: title ?? 'Chess Game',
      entry: 'default',
      postData: postData as unknown as JsonObject,
      textFallback: {
        text: buildTextFallback(validation.pgn),
      },
      styles: {
        heightPixels: 600,
        backgroundColor: '#FFFFFFFF',
        backgroundColorDark: '#111111FF',
      },
    });

    await updateRedisPgnRecordPostId(redisKey, post.id);

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Failed to create post:`, error);
    await deleteRedisPgnRecord(redisKey);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post. Please try again.',
      },
      500
    );
  }
});
