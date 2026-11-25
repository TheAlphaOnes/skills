#!/usr/bin/env python3
"""Transcribe an audio file with a local Hugging Face Whisper model.

Usage:
  python3 transcribe.py audio.wav transcript.json \
    --model openai/whisper-base --language en

The output is JSON with a full transcript and timestamped segments, matching
the shape the ingestion workflow expects.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local Whisper transcription")
    parser.add_argument("audio", help="Input audio file (WAV recommended)")
    parser.add_argument("output", help="Output JSON path")
    parser.add_argument("--model", default="openai/whisper-base", help="Hugging Face model id")
    parser.add_argument("--language", default="en", help="Language code, for example en or hi")
    parser.add_argument("--device", default="auto", help="auto, mps, cuda, or cpu")
    parser.add_argument("--chunk-seconds", type=int, default=30, help="Chunk length for long audio")
    parser.add_argument("--stride-seconds", type=int, default=5, help="Chunk stride")
    return parser.parse_args()


def choose_device(requested: str) -> str:
    if requested != "auto":
        return requested
    try:
        import torch

        if torch.backends.mps.is_available():
            return "mps"
        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    return "cpu"


def main() -> int:
    args = parse_args()
    audio = Path(args.audio)
    output = Path(args.output)

    if not audio.is_file():
        print(f"Audio file not found: {audio}", file=sys.stderr)
        return 2

    try:
        from transformers import pipeline
    except ImportError:
        print(
            "transformers is not installed. Run: pip3 install transformers torch",
            file=sys.stderr,
        )
        return 2

    device = choose_device(args.device)
    print(f"Loading {args.model} on {device}...", file=sys.stderr)
    started = time.time()

    asr = pipeline(
        "automatic-speech-recognition",
        model=args.model,
        device=device,
    )

    generate_kwargs = {"language": args.language} if args.language else {}
    result = asr(
        str(audio),
        return_timestamps=True,
        chunk_length_s=args.chunk_seconds,
        stride_length_s=args.stride_seconds,
        generate_kwargs=generate_kwargs,
    )

    text = (result.get("text") or "").strip()
    segments = []
    for chunk in result.get("chunks") or []:
        timestamp = chunk.get("timestamp") or [0, 0]
        start = timestamp[0] if timestamp[0] is not None else 0
        end = timestamp[1] if timestamp[1] is not None else start
        chunk_text = (chunk.get("text") or "").strip()
        if not chunk_text:
            continue
        segments.append(
            {
                "start": round(float(start), 2),
                "end": round(float(end), 2),
                "text": chunk_text,
            }
        )

    if not segments and text:
        segments.append({"start": 0, "end": 0, "text": text})

    payload = {
        "transcript": text,
        "segments": segments,
        "language": args.language,
        "model": args.model,
        "device": device,
        "elapsedSeconds": round(time.time() - started, 1),
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(
        f"Transcribed {len(text)} characters in {len(segments)} segments -> {output}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
