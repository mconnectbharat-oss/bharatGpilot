#!/usr/bin/env python3
"""Repeatable latency benchmark for the conservative Indic fuzzy matcher.

This benchmark measures per-call wall time while calls are submitted through
asyncio.to_thread. Python's GIL means this is not CPU-parallel execution; the
result is a scheduling/load profile, not proof of 1,000-way CPU parallelism.
Run from any working directory with: python research-service/scripts/benchmark_fuzzy.py
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Sequence

# Allow direct execution from the repository root or another working directory.
SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from src.services.fuzzy_checker import FuzzyScriptEngine  # noqa: E402


PAYLOADS: tuple[str, ...] = (
    "क्याा बदल गया?",
    "অনুগ্রহ কূরে বাংলা",
    "நனறி தமழ",
    "नमस्ते भारतजी",
    "வணக்கம் நண்பா",
)


def percentile_nearest_rank(values: Sequence[float], percentile: float) -> float:
    """Compute a deterministic nearest-rank percentile without interpolation."""
    if not values:
        raise ValueError("percentile requires at least one observation")
    if not 0 < percentile <= 100:
        raise ValueError("percentile must be in (0, 100]")
    ordered = sorted(values)
    rank = max(1, int((percentile / 100) * len(ordered) + 0.999999999))
    return ordered[rank - 1]


class FuzzyBenchmarkRunner:
    def __init__(self) -> None:
        self.engine = FuzzyScriptEngine()

    def execute_single_profile_task(self, prompt: str) -> float:
        started = time.perf_counter_ns()
        self.engine.execute_fuzzy_pipeline(prompt)
        return (time.perf_counter_ns() - started) / 1_000_000

    async def run(self, total_requests: int, concurrency: int, p95_limit_ms: float) -> bool:
        semaphore = asyncio.Semaphore(concurrency)
        payloads = [PAYLOADS[index % len(PAYLOADS)] for index in range(total_requests)]

        # Warm up the interpreter and code paths; exclude warm-up from reported samples.
        for payload in PAYLOADS:
            await asyncio.to_thread(self.engine.execute_fuzzy_pipeline, payload)

        async def measured(payload: str) -> float:
            async with semaphore:
                return await asyncio.to_thread(self.execute_single_profile_task, payload)

        matrix_started = time.perf_counter()
        latencies = await asyncio.gather(*(measured(payload) for payload in payloads))
        wall_ms = (time.perf_counter() - matrix_started) * 1000
        result = {
            "benchmark": "bharatgpilot_fuzzy_matching",
            "requests": total_requests,
            "configured_concurrency": concurrency,
            "execution_model": "asyncio.to_thread (thread scheduling; Python GIL may serialize CPU work)",
            "wall_time_ms": round(wall_ms, 3),
            "mean_latency_ms": round(statistics.mean(latencies), 4),
            "p95_latency_ms": round(percentile_nearest_rank(latencies, 95), 4),
            "p99_latency_ms": round(percentile_nearest_rank(latencies, 99), 4),
            "max_latency_ms": round(max(latencies), 4),
            "p95_limit_ms": p95_limit_ms,
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if os.getenv("GITHUB_STEP_SUMMARY"):
            summary_path = Path(os.environ["GITHUB_STEP_SUMMARY"])
            with summary_path.open("a", encoding="utf-8") as summary:
                summary.write("## Indic fuzzy-matching benchmark\n\n")
                summary.write("| Metric | Result |\n|---|---:|\n")
                for key in ("requests", "configured_concurrency", "wall_time_ms",
                            "mean_latency_ms", "p95_latency_ms", "p99_latency_ms",
                            "max_latency_ms", "p95_limit_ms"):
                    summary.write(f"| {key} | {result[key]} |\n")
        passed = result["p95_latency_ms"] <= p95_limit_ms
        print("PASS: p95 is within the configured limit." if passed else
              "FAIL: p95 exceeded the configured limit.")
        return passed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--requests", type=int, default=1000)
    parser.add_argument("--concurrency", type=int, default=100)
    parser.add_argument(
        "--max-p95-ms",
        type=float,
        default=float(os.getenv("BGP_FUZZY_P95_LIMIT_MS", "5.0")),
    )
    args = parser.parse_args()
    if args.requests < 1 or args.concurrency < 1 or args.max_p95_ms <= 0:
        parser.error("requests, concurrency and max-p95-ms must be positive")
    return 0 if asyncio.run(
        FuzzyBenchmarkRunner().run(args.requests, args.concurrency, args.max_p95_ms)
    ) else 1


if __name__ == "__main__":
    raise SystemExit(main())
