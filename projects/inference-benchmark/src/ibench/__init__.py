"""ibench —— Capstone 4：GPU / Inference Profiling Lab（AI Infra Track）。"""
from ibench.timer import cuda_available, platform_info, timeit
from ibench.attention_bench import bench_attention, naive_attention, sdpa_attention

__all__ = ["cuda_available", "platform_info", "timeit",
           "bench_attention", "naive_attention", "sdpa_attention"]
__version__ = "0.1.0"
