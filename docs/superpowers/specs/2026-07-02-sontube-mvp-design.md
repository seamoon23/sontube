# SonTube MVP Design

## Goal

Build the first commit-ready SonTube MVP in `C:\codex\app\sontube`: a Next.js PWA where parents manually register safe YouTube videos and children browse only approved internal records.

## Architecture

The app is a single Next.js App Router project. Prisma stores videos, tags, video-tag links, and settings in SQLite. Server actions own all writes and validate input with Zod. Client forms use React Hook Form for immediate feedback, but server validation remains authoritative.

## Core Flows

Parents use `/admin` routes to create tags, register videos, edit videos, choose safety status, publish videos, and upload optional custom thumbnails. The app parses `videoId` from individual YouTube video URLs only and rejects channel, playlist, search, malformed, and non-YouTube URLs.

Children use `/kids` routes. The list query only returns videos where `isPublished = true` and `safetyStatus = PARENT_CHECKED`. Search is internal title/description search. Tag filters only use local tags attached to approved videos. Playback uses YouTube iframe embed.

## Recommendation Tags

Recommendations use local signals only:

- recently used active tags
- frequently used active tags
- tag name/slug/keyword matches in title and description
- tags from existing videos sharing title/description tokens

The recommendation function never writes tags automatically. Parents choose suggested tags manually.

## Thumbnail Policy

Thumbnail priority is custom upload, YouTube thumbnail URL pattern, then local placeholder. The app does not call YouTube APIs to check thumbnail existence.

## Explicit Exclusions

No YouTube Data API, Google API Key, whole-YouTube search, comments, subtitles, channel import, playlist import, AI tagging API, video upload, ad blocking, downloading, offline storage, or background playback.

## Testing

Automated tests cover YouTube URL parsing, embed/thumbnail URL generation, and tag recommendation ranking. Build verification covers Prisma generation and Next.js compilation.
