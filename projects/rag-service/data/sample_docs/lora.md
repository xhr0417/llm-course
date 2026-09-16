# 示例文档 B：LoRA 微调

LoRA（Low-Rank Adaptation）冻结原始模型权重，只在目标线性层旁边
增加一对低秩矩阵 A 和 B。前向计算变为：

    y = Wx + (alpha / r) · B(Ax)

其中 A 用随机高斯初始化，B 初始化为全零——因此训练开始时
LoRA 分支输出为零，模型行为与原始模型完全一致。

LoRA 的优势：

1. 可训练参数极少（通常为总参数的 0.1% 量级）；
2. 显存需求低，单卡即可微调较大模型；
3. adapter 文件只有几 MB，便于保存、切换与分享。

常见超参数：rank（r）一般取 8~64；alpha 常取两倍于 r；
target_modules 通常选择 q_proj 和 v_proj。
