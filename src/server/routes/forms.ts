import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import type { UiResponse } from '@devvit/shared';
import { context } from '@devvit/server';
import { reddit } from '@devvit/web/server';
import type { JsonObject } from '@devvit/shared-types/json.js';
import type { PgnPostData, PgnSubmitter } from '../../shared/pgn';
import { validatePgn, normalizePgn, buildTextFallback } from '../pgn';
import {
  generateRedisKey,
  writeRedisPgnRecord,
  updateRedisPgnRecordPostId,
  deleteRedisPgnRecord,
} from '../storage';

type CreatePgnViewerFormValues = {
  title?: string;
  pgn?: string;
  description?: string;
  puzzleMode?: boolean;
};

const MAX_DESCRIPTION_LENGTH = 2000;

function normalizeDescription(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  return trimmed === '' ? undefined : trimmed;
}

function submitterFromContext(): PgnSubmitter | undefined {
  const username =
    typeof context.username === 'string' ? context.username.trim() : '';
  if (!username) return undefined;

  return {
    username,
  };
}

export const forms = new Hono();

forms.post('/create-pgn-viewer', async (c) => {
  const { subredditName } = context;
  if (!subredditName) {
    console.error('Form submit error: subredditName not in context');
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post: subreddit not found',
      },
      200
    );
  }

  const body = await c.req.json<CreatePgnViewerFormValues>();
  const { title, pgn, description } = body;
  const puzzleMode = body.puzzleMode === true;

  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  if (!trimmedTitle) {
    console.error('Form validation failed: title is required');
    return c.json<UiResponse>(
      {
        showToast: 'Title is required.',
      },
      200
    );
  }
  if (trimmedTitle.length > 300) {
    console.error('Form validation failed: title too long');
    return c.json<UiResponse>(
      {
        showToast: 'Title must be 300 characters or fewer.',
      },
      200
    );
  }

  const normalizedDescription = normalizeDescription(description);
  if (
    normalizedDescription &&
    normalizedDescription.length > MAX_DESCRIPTION_LENGTH
  ) {
    return c.json<UiResponse>(
      {
        showToast: `Description must be ${MAX_DESCRIPTION_LENGTH.toLocaleString()} characters or fewer.`,
      },
      200
    );
  }

  const validation = validatePgn(pgn, trimmedTitle);
  const validPgn = validation.valid;

  // If invalid, still create the post but with the error captured so the
  // viewer can display it. Stash the user's raw input so they can see what
  // they pasted and fix it.
  const rawPgn = normalizePgn(pgn);
  const storedPgn = validPgn ? validation.pgn : rawPgn;
  const storedHeaders = validPgn ? validation.headers : {};
  const storedPlyCount = validPgn ? validation.plyCount : 0;
  const storedPgnLength = validPgn ? validation.pgnLength : rawPgn.length;
  const storedPgnSha256 = validPgn
    ? validation.pgnSha256
    : createHash('sha256').update(rawPgn).digest('hex');
  const errorMessage = validPgn ? undefined : validation.message;

  if (!validPgn) {
    console.error(`Form validation failed: ${validation.message}`);
  }

  const redisKey = generateRedisKey();
  const submitter = submitterFromContext();

  try {
    await writeRedisPgnRecord({
      redisKey,
      pgn: storedPgn,
      headers: storedHeaders,
      plyCount: storedPlyCount,
      pgnSha256: storedPgnSha256,
      pgnLength: storedPgnLength,
      description: normalizedDescription,
      errorMessage,
      puzzleMode,
      submitter,
    });

    const postData: PgnPostData = {
      version: 1,
      kind: 'pgn-viewer',
      redisKey,
      headers: storedHeaders,
      plyCount: storedPlyCount,
      pgnLength: storedPgnLength,
      pgnSha256: storedPgnSha256,
      createdAt: new Date().toISOString(),
      ...(puzzleMode ? { puzzleMode: true } : {}),
      ...(submitter ? { submitter } : {}),
    };

    const post = await reddit.submitCustomPost({
      subredditName,
      title: trimmedTitle,
      entry: 'default',
      postData: postData as unknown as JsonObject,
      textFallback: {
        text: validPgn
          ? buildTextFallback(validation.pgn)
          : `**Invalid PGN:** ${validation.message}`,
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
      200
    );
  }
});
