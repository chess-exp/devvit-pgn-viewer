# Submission, Approval, And Subreddit Use

## Short Answer

You can build and playtest the app without formal Reddit App Review.

You need Reddit review/approval when you publish a launch version, list the app publicly in the App Directory, or use higher-risk capabilities that Reddit treats as approval-gated. For this PGN viewer, the likely path is:

1. Build locally.
2. Playtest in a private/small subreddit.
3. Publish as an unlisted app.
4. Install it in your own subreddit.
5. Only request public listing if you want other moderators to discover and install it.

## What Each Stage Means

### Local Development

Use this stage while the app is still changing quickly.

Expected commands:

```bash
npx devvit login
npx devvit playtest
```

Notes:

- `devvit playtest` creates or uses a playtest subreddit.
- Playtest subreddits must have fewer than 200 subscribers.
- Logs stream in the terminal while playtest is running.
- This is enough to test core behavior before submitting anything.

### Playtest In A Chosen Subreddit

If you want to test in a specific small subreddit:

```bash
npx devvit playtest your_test_subreddit
```

The subreddit must be under the playtest subscriber limit. Use this for validating mod permissions, menu actions, custom post creation, and mobile/desktop rendering.

### Upload

When the app is stable enough to create an installable build:

```bash
npx devvit upload
```

Use upload when you are satisfied with a playtest build and want an installable version. This is not the same as broad public listing.

### Publish For Review

When the app is launch-ready:

```bash
npx devvit publish
```

Optional version control:

```bash
npx devvit publish --bump patch
npx devvit publish --bump minor
npx devvit publish --bump major
npx devvit publish --version 1.0.0
```

Publishing submits the app to Reddit's review queue. Reddit may evaluate the code, example posts, and app documentation.

## Public Listing

By default, published apps are unlisted. That is usually correct for a subreddit-specific tool.

If the app should be installable by any subreddit from the Apps Directory:

```bash
npx devvit publish --public
```

Only use `--public` if the app is general-purpose and has installer-facing documentation. A PGN renderer could eventually make sense as public, but the first version should probably stay unlisted until it has been tested in your subreddit.

## Expected Review Requirements

Before publishing, prepare:

- A clear `README.md` explaining what the app does.
- Screenshots or example posts showing the PGN viewer.
- A stable test subreddit with example content.
- A short support/contact section.
- A changelog for major updates.
- Notes about data storage:
  - PGN text is stored in post data or Redis.
  - No external account linking.
  - No external analytics.
  - No user profiling.
  - No off-platform navigation.

For this app, avoid external fetch entirely in the first release. Keep dependencies bundled in the client/server build.

## Approval Risks For This App

### Free-Form Text Input

The app accepts PGN text. PGN is user-provided content, so the implementation must:

- Validate PGN before creating a viewer post.
- Escape all metadata before display.
- Avoid rendering PGN comments as raw HTML.
- Provide a clear way for moderators to remove bad posts using normal Reddit moderation.

### Existing Post Conversion

If the app copies PGN from an existing Reddit post into a custom post, it is reusing user content. The safest initial version should only let moderators run this action manually. Later, if normal users can trigger conversion, the UI should make it explicit that a new viewer post will be created from the source content.

### Redis Retention

If Redis stores large PGNs, add deletion handling later:

- On post deletion, remove Redis data for that post.
- Use Redis expiration if long-term storage is not needed.
- Do not store author profile data unless necessary.

### Inline Webview Quality

Inline mode should load quickly, avoid scroll traps, and work on mobile. For the first release:

- Keep the bundle small.
- Use only tap/click controls.
- Avoid external client requests.
- Use a simple responsive layout.

## How To Use In Your Subreddit

### Recommended First Workflow

1. Install the app in your subreddit.
2. Open the subreddit menu.
3. Choose `Create PGN Viewer`.
4. Paste PGN and submit.
5. The app creates a Devvit custom post with the interactive chess viewer.

This workflow is better for the first release than automatic conversion because it is explicit, easier to moderate, and easier to pass review.

### Later Workflow

After the manual flow is stable:

1. A user makes a normal text post containing PGN.
2. A moderator opens the post menu.
3. The moderator selects `Render PGN`.
4. The app extracts the PGN and creates a viewer post.
5. Optionally, the app comments on the original post with a link to the viewer.

### Optional Automation

Automation should wait until the app is proven manually. If added, use conservative rules:

- Only auto-render posts with a specific flair, for example `PGN`.
- Or only auto-render posts with a title marker, for example `[PGN]`.
- Do not auto-render every post in the subreddit.
- Add duplicate protection keyed by source post ID.

## Pre-Submission Checklist

- Manual PGN creation works.
- Invalid PGN shows a helpful error.
- The viewer works on Reddit web and mobile.
- The post has useful text fallback.
- The app README explains install and usage.
- No raw HTML from PGN is rendered.
- No external network calls are made from the client.
- Redis data is documented if Redis is used.
- App name and branding do not imply Reddit endorsement.
- The app does not use Reddit logos or protected brand assets.

## Suggested First Release Scope

Ship only:

- Manual `Create PGN Viewer` subreddit menu action.
- One-game PGN rendering.
- Board controls.
- Text fallback.
- Redis for long PGNs if needed.

Defer:

- Automatic post scanning.
- Comment scanning.
- Multi-game PGN files.
- Public App Directory listing.
- Expanded analytics or external services.
