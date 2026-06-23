import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';

export const menu = new Hono();

menu.post('/create-pgn-viewer', async (c) => {
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'createPgnViewer',
        form: {
          fields: [
            {
              name: 'title',
              label: 'Post Title',
              type: 'string',
              required: true,
              placeholder: 'e.g., Kasparov vs. Deep Blue, Game 6',
            },
            {
              name: 'pgn',
              label: 'PGN Text',
              type: 'paragraph',
              required: true,
              placeholder: 'Paste your PGN notation here...',
            },
          ],
          acceptLabel: 'Create',
        },
      },
    },
    200
  );
});
