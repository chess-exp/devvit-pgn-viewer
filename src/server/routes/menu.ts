import { Hono } from 'hono';
import type { UiResponse } from '@devvit/shared';

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
              label: 'PGN or FEN',
              type: 'paragraph',
              required: true,
              placeholder:
                'Paste a PGN game, or a single FEN position (e.g. "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3")',
            },
            {
              name: 'description',
              label: 'Description (optional)',
              type: 'paragraph',
              required: false,
              placeholder: 'Add a short note shown above the board...',
            },
            {
              name: 'puzzleMode',
              label: 'Puzzle mode',
              type: 'boolean',
              defaultValue: false,
              helpText:
                'Start from the first/FEN position and hide the solution until revealed.',
            },
          ],
          acceptLabel: 'Create',
        },
      },
    },
    200
  );
});
