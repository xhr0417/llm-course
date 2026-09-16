"""报告：把 benchmark 结果拼成 analysis.md。"""
from __future__ import annotations

from pathlib import Path


def _attention_section(rows: list[dict]) -> str:
    if not rows:
        return "（未运行）"
    lines = ["| impl | seq_len | dtype | latency_ms | peak_mem_mb |", "| --- | --- | --- | --- | --- |"]
    for r in rows:
        lines.append(f"| {r['impl']} | {r['seq_len']} | {r['dtype']} | {r['latency_ms']} | {r['peak_mem_mb']} |")
    # 伸缩性分析（同一 impl/dtype 下 seq 翻倍的延迟倍数）
    by_impl: dict[str, list[dict]] = {}
    for r in rows:
        by_impl.setdefault(r["impl"] + "/" + r["dtype"], []).append(r)
    lines.append("")
    lines.append("**伸缩性（seq_len 翻倍时的延迟倍数，理论 O(n²) ⇒ ≈4×）**：")
    for key, items in by_impl.items():
        items = sorted(items, key=lambda x: x["seq_len"])
        for a, b in zip(items, items[1:]):
            if a["seq_len"] * 2 == b["seq_len"] and a["latency_ms"] > 0:
                ratio = b["latency_ms"] / a["latency_ms"]
                lines.append(f"- {key}: {a['seq_len']}→{b['seq_len']} = {ratio:.2f}×")
    return "\n".join(lines)


def _profile_section(rows: list[dict]) -> str:
    if not rows:
        return "（未运行）"
    lines = ["| op | calls | cpu_ms | cpu% | cuda_ms |", "| --- | --- | --- | --- | --- |"]
    for r in rows:
        lines.append(f"| `{r['op']}` | {r['calls']} | {r['cpu_time_ms']} | {r['cpu_pct']}% | {r['cuda_time_ms']} |")
    return "\n".join(lines)


def _compile_section(row: dict | None) -> str:
    if not row:
        return "（未运行）"
    return (f"- eager：{row['eager_ms']} ms | compiled：{row['compiled_ms']} ms | 加速比：**{row['speedup']}×**\n"
            f"- 首次编译耗时：{row['compile_time_s']}s | 输出一致：{row['matches'] if 'matches' in row else row['outputs_match']}\n"
            f"- 结论：{row['note']}")


def _serving_section(rows: list[dict]) -> str:
    if not rows:
        return "（未运行：需要 OpenAI-compatible 服务端，见 docs/vllm_runbook.md）"
    lines = ["| label | concurrency | reqs | errors | TTFT p50 | TTFT p95 | TPOT p50 | tok/s | req/s |",
             "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for r in rows:
        lines.append(f"| {r['label']} | {r['concurrency']} | {r['requests']} | {r['errors']} | "
                     f"{r['ttft_ms_p50']}ms | {r['ttft_ms_p95']}ms | {r['tpot_ms_p50']}ms | "
                     f"{r['tokens_per_s']} | {r['requests_per_s']} |")
    return "\n".join(lines)


GPU_NOTES = """以下预期行为来自理论/公开资料，**需在目标硬件上按本仓库脚本实测**：

- **并发 ↑ → 吞吐 ↑、TTFT/TPOT 可能 ↑**：batch 内请求共享一次权重读取（吞吐上升），但每步计算量与排队增加（延迟上升）；
- **prompt 变长 → TTFT ↑（近似线性）**：prefill 计算量随 prompt 长度增长（第 20 章）；
- **output 变长 → 总时长 ↑、tokens/s 大致稳定**：decode 每步成本近似固定（带宽受限），总时间正比于输出长度；
- **naive vs SDPA 差距随 seq_len 拉大**：naive 物化 [B,H,S,S]，显存与带宽是瓶颈；SDPA/FlashAttention IO-aware（第 19 章）；
- **BF16 通常比 FP32 快 1.5-3×**（Tensor Core），但 CPU 上不适用。"""

NOT_EXECUTED = """本机未执行（如实标注）：

- **CUDA 相关全部实验**：本机无 NVIDIA GPU（`cuda_available=False`）；
- **vLLM 服务端 benchmark**：vLLM 需要 CUDA 环境，见 `docs/vllm_runbook.md`（命令齐全，待有 GPU 机器验证）；
- **Triton kernel**：同属 CUDA 环境（第 19 章代码标注 NOT EXECUTED ON CUDA）；
- 已完成：CPU 上的 attention 伸缩、profiler 算子表、torch.compile 对比、serving 客户端（对 mock 服务端验证）。"""


def build_analysis_md(platform: dict, attention_rows: list[dict], profile_rows: list[dict],
                      compile_row: dict | None, serve_rows: list[dict]) -> str:
    lines = [
        "# Inference Benchmark 分析报告（自动生成）",
        "",
        "## 0. 环境",
        "",
        f"- 平台：{platform['platform']} | Python {platform['python']} | torch {platform['torch']}",
        f"- 设备：{platform['device_name']} | CUDA 可用：{platform['cuda_available']}",
        "",
        "## 1. Attention：naive vs SDPA",
        "",
        _attention_section(attention_rows),
        "",
        "## 2. Profiler：Top 算子（CPU）",
        "",
        _profile_section(profile_rows),
        "",
        "## 3. torch.compile",
        "",
        _compile_section(compile_row),
        "",
        "## 4. Serving benchmark（OpenAI-compatible）",
        "",
        _serving_section(serve_rows),
        "",
        "## 5. GPU 预期行为（待验证）",
        "",
        GPU_NOTES,
        "",
        "## 6. 未执行清单（诚实标注）",
        "",
        NOT_EXECUTED,
    ]
    return "\n".join(lines) + "\n"


def write_analysis(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
