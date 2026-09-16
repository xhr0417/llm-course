# 示例文档 C：RAG 检索增强生成

RAG（Retrieval-Augmented Generation）把外部知识检索与语言模型生成结合起来：

    documents → chunk → 索引 → 检索 → 重排 → 上下文 → LLM → answer + citations

为什么需要 RAG：

- 私有知识不在模型权重里；
- 训练数据有截止时间，无法回答最新信息；
- 生成需要可验证的引用来源。

检索质量与生成质量必须分开评估：

- 检索侧指标：Recall@k、MRR、nDCG；
- 生成侧指标：answer correctness、citation correctness、faithfulness。

常见失败模式：

1. 没检索到正确文档（检索失败）；
2. 检索到了但模型没有使用（忽略上下文）；
3. 模型凭空编造答案（幻觉）；
4. 引用编号与内容不对应（引用错位）。
