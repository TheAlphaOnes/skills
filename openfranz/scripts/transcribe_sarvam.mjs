#!/usr/bin/env node
/**
 * Transcribe audio with Sarvam saaras:v3.
 *
 * Mirrors the OpenFranz worker: clips of 30 seconds or less use the REST
 * endpoint; longer clips use the batch job API. Requires SARVAM_API_KEY.
 *
 * Usage:
 *   node transcribe_sarvam.mjs audio.wav transcript.json <duration-seconds>
 */

import { readFile, writeFile } from "node:fs/promises";

const REST_LIMIT_SECONDS = 30;

const [audioPath, outputPath, durationArg] = process.argv.slice(2);
if (!audioPath || !outputPath) {
  console.error(
    "Usage: node transcribe_sarvam.mjs <audio> <out.json> <duration-seconds>",
  );
  process.exit(1);
}

const durationSeconds = Number(durationArg) || 0;
const apiKey = process.env.SARVAM_API_KEY;
if (!apiKey) {
  console.error(
    "SARVAM_API_KEY is not set. Set it in your shell or in the workspace .env, or use --stt local.",
  );
  process.exit(2);
}

const baseUrl = (process.env.SARVAM_BASE_URL ?? "https://api.sarvam.ai").replace(
  /\/$/,
  "",
);

const audio = await readFile(audioPath);
const arrayBuffer = audio.buffer.slice(
  audio.byteOffset,
  audio.byteOffset + audio.byteLength,
);

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "api-subscription-key": apiKey,
      ...(init.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init.headers,
    },
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(`Sarvam request failed (${response.status}): ${detail}`);
  }

  return response.json();
}

function groupWords(words, starts, ends) {
  const segments = [];
  let current = null;

  for (let index = 0; index < words.length; index += 1) {
    const start = starts[index] ?? 0;
    const end = ends[index] ?? start;
    const word = words[index]?.trim();
    if (!word) continue;

    if (!current || start - current.start >= 4) {
      if (current) segments.push(current);
      current = { start, end, text: word };
    } else {
      current.end = end;
      current.text += ` ${word}`;
    }
  }

  if (current) segments.push(current);
  return segments;
}

function parsePayload(payload, offsetSeconds, duration) {
  const transcript = (payload.transcript ?? payload.text ?? "").trim();
  const segments = [];
  const timestamps = payload.timestamps;

  if (timestamps?.chunks && timestamps.start_time_seconds) {
    for (let index = 0; index < timestamps.chunks.length; index += 1) {
      const text = timestamps.chunks[index]?.trim();
      if (!text) continue;
      const start = timestamps.start_time_seconds[index] ?? 0;
      const end = timestamps.end_time_seconds?.[index] ?? start;
      segments.push({
        start: start + offsetSeconds,
        end: end + offsetSeconds,
        text,
      });
    }
  }

  for (const chunk of payload.chunks ?? []) {
    const start =
      chunk.start ?? chunk.start_time ?? chunk.start_time_seconds ?? 0;
    const end = chunk.end ?? chunk.end_time ?? chunk.end_time_seconds ?? start;
    const text = chunk.text?.trim();
    if (text) {
      segments.push({
        start: start + offsetSeconds,
        end: end + offsetSeconds,
        text,
      });
    }
  }

  if (segments.length === 0 && timestamps?.words) {
    const grouped = groupWords(
      timestamps.words,
      timestamps.start_time_seconds ?? [],
      timestamps.end_time_seconds ?? [],
    );
    segments.push(
      ...grouped.map((segment) => ({
        start: segment.start + offsetSeconds,
        end: segment.end + offsetSeconds,
        text: segment.text,
      })),
    );
  }

  if (segments.length === 0 && transcript) {
    segments.push({
      start: offsetSeconds,
      end: offsetSeconds + duration,
      text: transcript,
    });
  }

  return {
    transcript: transcript || segments.map((segment) => segment.text).join(" "),
    segments,
  };
}

async function transcribeRest(audioBuffer, duration) {
  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: "audio/wav" }), "audio.wav");
  form.append("model", "saaras:v3");
  form.append("with_timestamps", "true");
  form.append("language_code", "en-IN");

  const payload = await request("/speech-to-text", {
    method: "POST",
    body: form,
  });

  return parsePayload(payload, 0, duration);
}

async function transcribeBatch(audioBuffer, duration) {
  const init = await request("/speech-to-text/job/v1", {
    method: "POST",
    body: JSON.stringify({
      job_parameters: {
        model: "saaras:v3",
        mode: "transcribe",
        language_code: "en-IN",
        with_timestamps: true,
      },
    }),
  });

  const upload = await request("/speech-to-text/job/v1/upload-files", {
    method: "POST",
    body: JSON.stringify({ job_id: init.job_id, files: ["audio.wav"] }),
  });

  const uploadUrl = upload.upload_urls?.["audio.wav"]?.file_url;
  if (!uploadUrl) throw new Error("Sarvam did not return an upload URL.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: audioBuffer,
    headers: {
      "Content-Type": "audio/wav",
      "x-ms-blob-type": "BlockBlob",
    },
    signal: AbortSignal.timeout(180_000),
  });
  if (!uploadResponse.ok) {
    throw new Error(`Sarvam audio upload failed (${uploadResponse.status}).`);
  }

  await request(`/speech-to-text/job/v1/${init.job_id}/start`, {
    method: "POST",
  });

  let status = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    status = await request(`/speech-to-text/job/v1/${init.job_id}/status`);
    if (status.job_state === "Completed") break;
    if (status.job_state === "Failed") {
      throw new Error(
        status.error_message || "Sarvam batch transcription failed.",
      );
    }
  }

  if (!status || status.job_state !== "Completed") {
    throw new Error("Sarvam batch transcription timed out.");
  }

  const outputs = (status.job_details ?? []).flatMap(
    (detail) => detail.outputs ?? [],
  );
  if (outputs.length === 0) {
    throw new Error("Sarvam batch job returned no output files.");
  }

  const download = await request("/speech-to-text/job/v1/download-files", {
    method: "POST",
    body: JSON.stringify({
      job_id: init.job_id,
      files: outputs.map((output) => output.file_name),
    }),
  });

  const transcripts = [];
  const segments = [];

  for (const output of outputs) {
    const url = download.download_urls?.[output.file_name]?.file_url;
    if (!url) continue;
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) continue;
    const payload = await response.json();
    const parsed = parsePayload(payload, 0, duration);
    if (parsed.transcript) transcripts.push(parsed.transcript);
    segments.push(...parsed.segments);
  }

  return {
    transcript: transcripts.join(" ").trim(),
    segments,
  };
}

try {
  const result =
    durationSeconds <= REST_LIMIT_SECONDS
      ? await transcribeRest(arrayBuffer, durationSeconds)
      : await transcribeBatch(arrayBuffer, durationSeconds);

  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        ...result,
        provider: "sarvam",
        model: "saaras:v3",
        language: "en-IN",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    `Transcribed ${result.transcript.length} characters in ${result.segments.length} segments -> ${outputPath}`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
