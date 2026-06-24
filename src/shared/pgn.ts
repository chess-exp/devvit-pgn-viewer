export type PgnHeaders = {
  event?: string;
  site?: string;
  date?: string;
  round?: string;
  white?: string;
  black?: string;
  result?: string;
};

export type PgnSubmitter = {
  username: string;
};

export type PgnPostData = {
  version: 1;
  kind: 'pgn-viewer';
  redisKey: string;
  headers: PgnHeaders;
  plyCount: number;
  pgnLength: number;
  pgnSha256: string;
  createdAt: string;
  puzzleMode?: boolean;
  submitter?: PgnSubmitter;
};

export type RedisPgnRecord = {
  version: 1;
  pgn: string;
  headers: PgnHeaders;
  plyCount: number;
  pgnLength: number;
  pgnSha256: string;
  puzzleMode?: boolean;
  submitter?: PgnSubmitter;
  description?: string;
  postId?: string;
  errorMessage?: string;
  createdAt: string;
};

export type PgnApiResponse =
  | {
      status: 'ok';
      postId: string;
      pgn: string;
      headers: PgnHeaders;
      plyCount: number;
      puzzleMode: boolean;
      submitter?: PgnSubmitter;
      description?: string;
      errorMessage?: string;
    }
  | {
      status: 'error';
      message: string;
      description?: string;
    };

export type ValidationError = {
  valid: false;
  message: string;
};

export type ValidatedPgn = {
  valid: true;
  pgn: string;
  headers: PgnHeaders;
  plyCount: number;
  pgnSha256: string;
  pgnLength: number;
  textFallback: string;
};
