"""pytest：计时 / attention（口径与 device）/ profiler / compile / serving 客户端 / 报告。"""
from __future__ import annotations

import asyncio
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest
import torch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from ibench.attention_bench import (bench_attention, measure_process_peak_mb,  # noqa: E402
                                    naive_attention, sdpa_attention,
                                    theoretical_intermediate_mb)
from ibench.compile_lab import bench_compile, to_dict as compile_to_dict  # noqa: E402
from ibench.profiler_lab import profile_ops, rows_to_dicts  # noqa: E402
from ibench.report import build_analysis_md, write_analysis  # noqa: E402
from ibench.serving_bench import bench_serving  # noqa: E402
from ibench.timer import cuda_available, platform_info, timeit  # noqa: E402


class TestTimer:
    def test_timeit_positive(self):
        assert timeit(lambda: torch.ones(64) @ torch.ones(64), warmup=1, iters=2, device="cpu") > 0

    def test_timeit_device_param(self):
        # device 参数决定计时方式；CPU 上两种写法都不应崩溃
        assert timeit(lambda: torch.zeros(8), warmup=0, iters=1, device="cpu") >= 0

    def test_platform_info_keys(self):
        info = platform_info()
        for key in ("platform", "python", "torch", "cuda_available", "device_name"):
            assert key in info
        assert isinstance(cuda_available(), bool)


class TestAttentionBench:
    def test_naive_matches_sdpa(self):
        torch.manual_seed(0)
        q, k, v = (torch.randn(1, 2, 16, 8) for _ in range(3))
        assert torch.allclose(naive_attention(q, k, v), sdpa_attention(q, k, v), atol=1e-5)

    def test_output_shape(self):
        q = torch.randn(2, 4, 10, 8)
        assert naive_attention(q, q, q).shape == (2, 4, 10, 8)

    def test_theoretical_footprint_values(self):
        # naive: 2 × B×H×S²×4bytes；S=2048,B=1,H=4 → 128.0 MB
        assert theoretical_intermediate_mb("naive", 1, 4, 2048, "float32") == pytest.approx(128.0, abs=0.1)
        assert theoretical_intermediate_mb("naive", 1, 4, 1024, "float32") == pytest.approx(32.0, abs=0.1)
        assert theoretical_intermediate_mb("sdpa", 1, 4, 2048, "float32") == 0.0

    def test_bench_rows_schema_and_device(self):
        rows = bench_attention(seq_lens=[32, 64], warmup=0, iters=1, device="cpu")
        assert len(rows) == 4
        keys = set(rows[0].__dict__.keys())
        assert {"impl", "device", "seq_len", "latency_ms", "intermediate_mb",
                "peak_allocated_mb"} <= keys
        assert {r.impl for r in rows} == {"naive", "sdpa"}
        assert all(r.device == "cpu" for r in rows)
        assert all(r.peak_allocated_mb == -1.0 for r in rows)  # CPU 不报告 CUDA 显存

    def test_bf16_skipped_on_cpu(self):
        rows = bench_attention(seq_lens=[16], dtypes=["bfloat16"], warmup=0, iters=1, device="cpu")
        assert rows == []

    def test_cuda_requested_without_cuda_raises(self):
        if torch.cuda.is_available():
            pytest.skip("本机有 CUDA")
        with pytest.raises(RuntimeError):
            bench_attention(seq_lens=[16], warmup=0, iters=1, device="cuda")

    def test_mem_worker_subprocess(self):
        result = measure_process_peak_mb("sdpa", seq_len=64)
        assert result["process_peak_rss_mb"] > 0
        assert result["theoretical_intermediate_mb"] == 0.0
        assert result["impl"] == "sdpa"


class TestProfiler:
    def test_profile_returns_top_ops(self):
        x = torch.randn(1, 2, 64, 16)
        rows = rows_to_dicts(profile_ops(lambda: naive_attention(x, x, x), warmup=0, iters=1, top=8))
        assert rows
        assert all({"op", "calls", "cpu_time_ms", "cpu_pct"} <= set(r.keys()) for r in rows)


class TestCompile:
    def test_compile_outputs_match(self):
        def fn(x):
            return torch.relu(x @ x.T).softmax(dim=-1)

        result = compile_to_dict(bench_compile(fn, torch.randn(32, 32), warmup=1, iters=2))
        assert result["outputs_match"] is True
        assert result["eager_ms"] > 0 and result["compiled_ms"] > 0


class _SSEHandler(BaseHTTPRequestHandler):
    fail = False
    delay = 0.01

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        _ = self.rfile.read(length)
        if _SSEHandler.fail:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"{}")
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        for i in range(8):
            chunk = {"choices": [{"delta": {"content": f"t{i}"}}]}
            self.wfile.write(("data: " + json.dumps(chunk) + "\n\n").encode())
            self.wfile.flush()
            time.sleep(_SSEHandler.delay)
        self.wfile.write(b"data: [DONE]\n\n")

    def log_message(self, *args):
        pass


@pytest.fixture()
def sse_server():
    _SSEHandler.fail = False
    server = HTTPServer(("127.0.0.1", 0), _SSEHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


class TestServingBench:
    def test_streaming_metrics(self, sse_server):
        result = asyncio.run(bench_serving(sse_server, "mock", ["p1", "p2"], concurrency=2,
                                           max_tokens=8, label="test"))
        assert result.errors == 0
        assert result.ttft_ms_p50 > 0
        assert result.tpot_ms_p50 > 0
        assert result.tokens_per_s > 0
        assert result.requests_per_s > 0
        assert result.ttft_ms_p50 < result.total_s * 1000

    def test_error_counting(self, sse_server):
        _SSEHandler.fail = True
        result = asyncio.run(bench_serving(sse_server, "mock", ["p1"], concurrency=1, max_tokens=4))
        assert result.errors == 1
        assert result.tokens_per_s == 0.0


class TestReport:
    def test_analysis_md_sections(self, tmp_path):
        md = build_analysis_md(
            platform_info(),
            [{"impl": "naive", "device": "cpu", "seq_len": 128, "dtype": "float32",
              "latency_ms": 1.0, "intermediate_mb": 0.5, "peak_allocated_mb": -1.0, "peak_reserved_mb": -1.0},
             {"impl": "naive", "device": "cpu", "seq_len": 256, "dtype": "float32",
              "latency_ms": 4.0, "intermediate_mb": 2.0, "peak_allocated_mb": -1.0, "peak_reserved_mb": -1.0}],
            [{"impl": "naive", "seq_len": 256, "theoretical_intermediate_mb": 2.0, "process_peak_rss_mb": 400.0}],
            [{"op": "aten::mm", "calls": 3, "cpu_time_ms": 5.0, "cpu_pct": 50.0, "cuda_time_ms": 0.0}],
            {"eager_ms": 1.0, "compiled_ms": 0.8, "compile_time_s": 3.0, "speedup": 1.25,
             "outputs_match": True, "note": "compiled 更快"},
            [],
        )
        assert "伸缩性" in md
        assert "理论中间张量" in md
        assert "独立子进程" in md
        assert "aten::mm" in md
        out = tmp_path / "analysis.md"
        write_analysis(out, md)
        assert out.exists()
