"""报告：把 benchmark 结果拼成 analysis.md。"""
from __future__ import annotations

from pathlib import Path


def _attention_section(rows: list[dict]) -> str:
    if not rows:
        return "（未运行）"
    has_cuda_mem = any(r.get("peak_allocated_mb", -1) >= 0 for r in rows)
    header = "| impl | device | seq_len | dtype | latency_ms | 理论中间张量 MB |"
    sep = "| --- | --- | --- | --- | --- | --- |"
    if has_cuda_mem:
        header = header[:-1] + " peak allocated MB | peak reserved MB |"
        sep = sep[:-1] + " | --- | --- |"
    lines = [header, sep]
    for r in rows:
        line = (f"| {r['impl']} | {r['device']} | {r['seq_len']} | {r['dtype']} | {r['latency_ms']} | "
                f"{r['intermediate_mb']} |")
        if has_cuda_mem:
            line += f" {r['peak_allocated_mb']} | {r['peak_reserved_mb']} |"
        lines.append(line)
    lines += [
        "",
        "> **口径**：`理论中间张量 MB` 是按 `2×B×H×S²×bytes`（naive 的 scores 与 probs 同时存活）"
        "估算的张量 footprint，**不是进程 peak memory**；CUDA 的 peak allocated/reserved 为真机实测。",
    ]
    by_impl: dict[str, list[dict]] = {}
    for r in rows:
        by_impl.setdefault(r["impl"] + "/" + r["dtype"], []).append(r)
    lines.append("")
    lines.append("**伸缩性（seq_len 翻倍时的延迟倍数；纯 attention 理论 O(n²) ⇒ 接近 4×）**：")
    for key, items in by_impl.items():
        items = sorted(items, key=lambda x: x["seq_len"])
        for a, b in zip(items, items[1:]):
            if a["seq_len"] * 2 == b["seq_len"] and a["latency_ms"] > 0:
                ratio = b["latency_ms"] / a["latency_ms"]
                lines.append(f"- {key}: {a['seq_len']}→{b['seq_len']} = {ratio:.2f}×")
    return "\n".join(lines)


def _rss_section(rows: list[dict]) -> str:
    if not rows:
        return "（未运行 subprocess RSS 检查）"
    lines = ["| impl | seq_len | 理论中间张量 MB | 进程 peak RSS MB |",
             "| --- | --- | --- | --- |"]
    for r in rows:
        lines.append(f"| {r['impl']} | {r['seq_len']} | {r['theoretical_intermediate_mb']} | "
                     f"{r['process_peak_rss_mb']} |")
    lines += [
        "",
        "> **口径**：`进程 peak RSS` 由**独立子进程**（`python -m ibench.mem_worker`）测得，"
        "是该进程生命周期的 high-water mark，**包含 Python / PyTorch / BLAS 运行时开销**，"
        "不是纯 attention 张量内存。它与理论张量 footprint 的差距主要来自运行时基线。",
    ]
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
            f"- 首次编译耗时：{row['compile_time_s']}s | 输出一致：{row.get('outputs_match')}\n"
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

- **并发 ↑ → 吞吐 ↑、TTFT/TPOT 可能 ↑**：batch 内请求共享权重读取（吞吐上升），但每步计算量与排队增加（延迟上升）；
- **prompt 变长 → TTFT 通常 ↑**：dense Transformer 的 prefill 同时含随 S 线性增长的投影/MLP 项与随 S² 增长的 attention 项；在具体模型/硬件/长度区间内常观察到近似线性的 wall-clock 区间，但不应简化为「prefill 复杂度 = O(S)」；
- **output 变长 → 总时长 ↑**：在上下文长度变化不大的区间内，decode 每步近似稳定；从更大尺度看，单步 attention / KV 读取成本会随当前 context length 增长；
- **naive vs SDPA 差距随 seq_len 拉大**：naive 物化 S×S 中间矩阵，带宽/容量压力更大；SDPA/FlashAttention 通过 tiling + online softmax 避免把完整 attention 矩阵写回 HBM；
- **BF16 通常比 FP32 快**（Tensor Core），但 CPU 上不适用。"""

NOT_EXECUTED = """本机未执行（如实标注）：

- **CUDA 相关全部实验**：本机无 NVIDIA GPU（`cuda_available=False`）。`--device cuda` 会直接报错退出，不做静默回退；
- **vLLM 服务端 benchmark**：vLLM 需要 CUDA 环境，见 `docs/vllm_runbook.md`（命令齐全，待有 GPU 机器验证）；
- **Triton kernel**：同属 CUDA 环境（第 19 章代码标注 NOT EXECUTED ON CUDA）；
- **Docker build**：本机未安装 Docker；由 CI 的 docker-build job 真实执行（当前状态：**通过**，见 `.github/workflows/ci.yml`）；
- 已完成：CPU 上的 attention 伸缩（latency + 理论张量 footprint + 子进程 RSS）、profiler 算子表、torch.compile 对比、serving 客户端（对 mock 服务端验证）。"""


def build_analysis_md(platform: dict, attention_rows: list[dict], rss_rows: list[dict],
                      profile_rows: list[dict], compile_row: dict | None, serve_rows: list[dict]) -> str:
    lines = [
        "# Inference Benchmark 分析报告（自动生成）",
        "",
        "## 0. 环境",
        "",
        f"- 平台：{platform['platform']} | Python {platform['python']} | torch {platform['torch']}",
        f"- 设备：{platform['device_name']} | CUDA 可用：{platform['cuda_available']}",
        "",
        "## 1. Attention：naive vs SDPA（latency）",
        "",
        _attention_section(attention_rows),
        "",
        "## 1b. 独立子进程 peak RSS（CPU 参照）",
        "",
        _rss_section(rss_rows),
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
