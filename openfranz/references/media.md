# Media: download, transcribe, and sample frames

This reference covers everything between a source URL and a `context.md` the agent can analyze. The scripts implement these limits and frame logic with standard command-line tools.

## Supported sources

- Public Instagram post URLs: `https://www.instagram.com/p/<shortcode>/`
- Public Instagram Reel URLs: `https://www.instagram.com/reel/<shortcode>/`
- `/reels/` and `/tv/` variants
- Comment permalinks: `/reel/<shortcode>/c/<id>/`
- Share links: `https://www.instagram.com/share/<id>/`
- Local video files: `.mp4`, `.mov`, `.webm`, `.mkv`
- Local image files: `.jpg`, `.jpeg`, `.png`, `.webp`

Private posts, stories, profiles, and anything behind a login are out of scope. Do not use cookies to bypass a private account.

## URL handling

The ingest script accepts the URL forms people actually paste:

- clean links;
- app-copied links with `?igsh=...`, `?hl=...`, or `?img_index=...`;
- comment permalinks;
- `/reels/` and `/tv/` variants;
- `/share/` links.

It canonicalizes the URL to `https://www.instagram.com/<kind>/<shortcode>/` before downloading. Query strings and fragments are stripped. `/reels/` is folded to `/reel/`.

## Download

`yt-dlp` is the primary downloader:

```bash
yt-dlp --no-playlist --write-info-json --write-thumbnail \
  -o "$DIR/source.%(ext)s" "$URL"
```

Why `yt-dlp`:

- It handles public Instagram posts and Reels, redirects, and metadata.
- It writes an info JSON with the title, description, duration, and media type.
- It is a single binary, already installed on this machine.

If `yt-dlp` fails:

- Confirm the post is public and is a post or Reel, not a profile or story.
- Try `yt-dlp --cookies-from-browser safari "<url>"` only for public, age-gated content. Do not use cookies to access private content.
- If Instagram is rate-limiting, wait and retry. Do not hammer the endpoint.
- If the post is a carousel and `yt-dlp` downloads only one image, use the optional `@jerrycoder/instagram-api` fallback described below.

### Optional metadata fallback

If `yt-dlp` cannot enumerate a carousel, install `@jerrycoder/instagram-api` in a scratch directory and use it:

```bash
mkdir -p /tmp/openfranz-media && cd /tmp/openfranz-media
npm init -y >/dev/null 2>&1
npm install @jerrycoder/instagram-api
node -e 'import("@jerrycoder/instagram-api").then(async ({instagram}) => {
  const payload = await instagram(process.argv[1], {timeout: 20000});
  console.log(JSON.stringify(payload, null, 2));
})' "<url>"
```

Then download the `url` and `media_url_<n>` fields with `curl` or `fetch`. This is a fallback, not the default.

## Reel pipeline

For a video source, `ingest.sh` runs:

1. **Probe the duration**

   ```bash
   ffprobe -v error -show_entries format=duration \
     -of default=noprint_wrappers=1:nokey=1 source.mp4
   ```

2. **Extract audio**

   ```bash
   ffmpeg -y -i source.mp4 -vn -ac 1 -ar 16000 -f wav audio.wav
   ```

   16 kHz mono WAV is what Whisper and Sarvam expect.

3. **Transcribe**

   Local Whisper:

   ```bash
   python3 scripts/transcribe.py audio.wav transcript.json \
     --model openai/whisper-base --language en
   ```

   Sarvam, when the user explicitly chooses `--stt sarvam` and `SARVAM_API_KEY` is set:

   ```bash
   node scripts/transcribe_sarvam.mjs audio.wav transcript.json "$DURATION"
   ```

4. **Plan frames**

   ```bash
   node scripts/frame_plan.mjs \
     --transcript transcript.json \
     --duration "$DURATION" \
     --max 24 \
     --out frames.json
   ```

5. **Extract frames**

   ```bash
   ffmpeg -y -ss "$TIME" -i source.mp4 -frames:v 1 \
     -vf scale=768:-1 -q:v 3 "frames/frame-$INDEX.jpg"
   ```

6. **Write `context.md`** with the source, duration, transcript, frame paths, source metadata (caption, creator, title), and the next step.

## Post pipeline

For an image source, `ingest.sh`:

1. Collects up to 12 images.
2. Rejects any image over 15 MB.
3. Writes `context.md` with the image paths and the instruction to transcribe visible text and describe the layout, examples, hooks, and teaching techniques.

There is no audio, duration, or frame planning for a post.

## Transcription

### Local Whisper

`transcribe.py` uses Hugging Face `transformers` with a Whisper model. It returns:

```json
{
  "transcript": "full text",
  "segments": [
    { "start": 0.0, "end": 3.28, "text": "first chunk" }
  ],
  "language": "en",
  "model": "openai/whisper-base"
}
```

Defaults:

- Model: `openai/whisper-base` (fast, good enough for hooks and structure).
- Language: `en`. Pass `--language hi` or another code for other languages.
- Device: `mps` when available, otherwise `cpu`.
- Long audio: chunked at 30 seconds with a 5-second stride.

The first run downloads the model. After that it is cached locally.

If `transformers` or `torch` is missing:

```bash
pip3 install transformers torch
```

If the machine has no PyTorch build, use Sarvam instead.

### Sarvam

`transcribe_sarvam.mjs` uses the Sarvam API:

- Clips of 30 seconds or less use `POST /speech-to-text` with `saaras:v3`, `with_timestamps=true`, and `language_code=en-IN`.
- Longer clips use the batch job API: create, upload, start, poll every 5 seconds for up to 10 minutes, download, and parse.
- The API key is read from `SARVAM_API_KEY`.
- The base URL is `SARVAM_BASE_URL` or `https://api.sarvam.ai`.

Sarvam is the better choice for Indic languages and for long Reels. Local Whisper is the better default when no key is configured.

## Frame planning

The frame planner uses `frameTarget` and `selectFrameTimes`:

- Roughly one frame every two seconds.
- At least six frames, unless the cap is lower.
- At most 24 frames by default.
- Each frame is anchored to a visual scene cut if scene times are provided, otherwise to a speech segment midpoint, otherwise to the slot centre.
- Frames closer than 0.5 seconds are removed.

The production ingest script does not pass scene times, because scene detection is not implemented. Frames are anchored to speech or slot centres. If you want scene cuts, pass `--scenes` with a JSON array of times.

## Vision

The agent should view the extracted frames directly. This is the most accurate and cheapest path: the agent already has the images, and it can connect what it sees to the transcript.

Use the caption for the creator's exact wording and framing. The caption is evidence; engagement counts are context, not proof that the technique works.

Write a visual analysis that covers:

- visible text and on-screen titles;
- demonstrations and physical actions;
- editing patterns, cuts, transitions, and overlays;
- the opening frame and the first three seconds;
- how the visuals connect to the spoken lines;
- anything that is visible but not said.

Do not invent details that are not visible. If a frame is too dark or blurry to read, say so. If the agent has no image tool, say so and work from the transcript alone.

## Provider configuration

The skill always prefers local tools. Local is the default; cloud is opt-in.

| Capability | Local (preferred, default) | Cloud (opt-in) | Key |
|------------|----------------------------|----------------|-----|
| Speech to text | Local Whisper | Sarvam `saaras:v3` | `SARVAM_API_KEY` |
| Instagram download | `yt-dlp` | `@jerrycoder/instagram-api` fallback | none |

Vision and web research use the agent itself. They have no separate provider and no key.

Check the current state:

```bash
"$OPENFRANZ_SKILL/scripts/configure.sh" "$OPENFRANZ_WORKSPACE"
```

Use local by default. Do not ask for a key unless the user explicitly asks for a cloud provider or the local option is unavailable. Set a key in the shell or in `$OPENFRANZ_WORKSPACE/.env` (the workspace `.gitignore` excludes it). Never write a key into the skill, a library document, or a commit. If a cloud option is selected without its key, the script exits with instructions and the local option remains available.

## Limits

| Limit | Value |
|-------|-------|
| Video download | 100 MB |
| Image download | 15 MB per image |
| Post images | 12 |
| Reel frames | 24 |
| Frame width | 768 px |
| Frame JPEG quality | 3 |
| Sarvam REST threshold | 30 seconds |
| Sarvam batch poll | 120 attempts x 5 seconds |

The skill does not enforce the video size cap during `yt-dlp` download; check the file size before processing and stop if it is over 100 MB.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `yt-dlp` says "Unsupported URL" | Profile, story, or private post | Use a public post or Reel URL |
| `yt-dlp` says "Login required" | Age-gated or private | Do not bypass; ask for a public source |
| No audio stream | Music-only or silent Reel | Work from frames; state the limitation |
| Empty transcript | Silence, music, or a bad audio extraction | Check `ffprobe`; try `--stt sarvam` |
| Whisper is very slow | First model download or CPU fallback | Use `openai/whisper-base`; check `mps` |
| Frames are black | Seeking before the first keyframe | The script clamps to 0; try a later time |
| `ffmpeg` not found | Missing dependency | `brew install ffmpeg` |
| `yt-dlp` not found | Missing dependency | `brew install yt-dlp` |
| Sarvam 401 | Missing or invalid key | Set `SARVAM_API_KEY` |
| Sarvam 504 | Batch job exceeded 10 minutes | Retry with a shorter clip or local Whisper |

## Privacy and ethics

- Public content only. Do not use cookies or credentials to access private accounts.
- Do not mass-scrape. One source at a time, with a human in the loop.
- Do not republish the source media. The library stores extracted craft, not the video.
- Respect the platform's terms and the creator's rights. Quote short lines for analysis; do not reproduce an entire script as your own.
