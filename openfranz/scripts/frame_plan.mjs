#!/usr/bin/env node
/**
 * Plan frame timestamps for a Reel.
 *
 * Uses frameTarget and selectFrameTimes:
 * roughly one frame every two seconds, at least six, at most the cap,
 * anchored to a scene cut, then a speech midpoint, then the slot centre.
 *
 * Usage:
 *   node frame_plan.mjs --transcript transcript.json --duration 12.3 \
 *     --max 24 --out frames.json [--scenes "1.2,4.5,8.0"]
 */

import { readFileSync, writeFileSync } from "node:fs";

const MIN_FRAMES = 6;
const SECONDS_PER_FRAME = 2;
const MIN_FRAME_GAP_SECONDS = 0.5;

function parseArgs(argv) {
  const args = { max: 24, scenes: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--transcript") args.transcript = argv[++index];
    else if (arg === "--duration") args.duration = Number(argv[++index]);
    else if (arg === "--max") args.max = Number(argv[++index]);
    else if (arg === "--out") args.out = argv[++index];
    else if (arg === "--scenes") {
      const value = argv[++index] ?? "";
      args.scenes = value
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item));
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node frame_plan.mjs --transcript <json> --duration <sec> --max <n> --out <json> [--scenes \"1,2,3\"]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.transcript) throw new Error("--transcript is required");
  if (!Number.isFinite(args.duration)) throw new Error("--duration is required");
  if (!args.out) throw new Error("--out is required");
  return args;
}

export function frameTarget(durationSeconds, maxFrames) {
  const limit = Math.max(Math.floor(maxFrames), 1);
  const duration = Math.max(durationSeconds, 0);
  const desired = Math.ceil(duration / SECONDS_PER_FRAME);
  return Math.min(Math.max(desired, Math.min(MIN_FRAMES, limit)), limit);
}

function closestTo(times, centre) {
  if (times.length === 0) return null;
  return times.reduce((best, time) =>
    Math.abs(time - centre) < Math.abs(best - centre) ? time : best,
  );
}

export function selectFrameTimes(
  segments,
  durationSeconds,
  maxFrames = 24,
  sceneTimes = [],
) {
  const duration = Math.max(durationSeconds, 0);
  if (duration <= 0) return [];

  const target = frameTarget(duration, maxFrames);
  const slotSize = duration / target;
  const clamp = (time) =>
    Math.min(Math.max(time, 0), Math.max(duration - 0.05, 0));
  const isInside = (time) =>
    Number.isFinite(time) && time >= 0 && time <= duration;

  const speech = segments
    .map((segment) => (Number(segment.start) + Number(segment.end)) / 2)
    .filter(isInside)
    .sort((left, right) => left - right);

  const scenes = sceneTimes
    .filter(isInside)
    .sort((left, right) => left - right);

  const selected = [];
  for (let index = 0; index < target; index += 1) {
    const start = index * slotSize;
    const end = start + slotSize;
    const centre = (start + end) / 2;
    const inSlot = (time) => time >= start && time < end;

    const scenePick = closestTo(scenes.filter(inSlot), centre);
    const speechPick = closestTo(speech.filter(inSlot), centre);
    const pick = scenePick ?? speechPick ?? centre;
    selected.push(Number(clamp(pick).toFixed(2)));
  }

  const unique = [];
  for (const time of selected) {
    if (
      unique.every(
        (existing) => Math.abs(existing - time) >= MIN_FRAME_GAP_SECONDS,
      )
    ) {
      unique.push(time);
    }
  }
  return unique;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(readFileSync(args.transcript, "utf8"));
  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  const times = selectFrameTimes(segments, args.duration, args.max, args.scenes);

  writeFileSync(args.out, `${JSON.stringify(times, null, 2)}\n`, "utf8");
  console.log(
    `Planned ${times.length} frames for ${args.duration.toFixed(2)}s: ${times.join(", ")}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
