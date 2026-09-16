> **本章对应课件**：《GRPO强化学习算法》。核心知识点全部按统一模板展开。本章公式较多，但每个都能用数字算例验证。
>
> 说明：偏好数据、Reward Model 与 **DPO 的最小可运行实现**见第 13 章 Lab 14（Build 训练篇）；本章聚焦 PPO / GRPO 的算法核心。

## 22.1 为什么 SFT 后还要 RL

:::unfold 先懂直觉
SFT 教模型「照着示范做」，但没有告诉它「哪个回答更好」。同一个问题可以有很多正确回答，人类偏好的是其中更有帮助、更安全、更准确的那些。RL 就是用奖励信号去优化这个「更好」。
:::

SFT 的局限：

- 只能模仿示范数据，无法超越示范质量；
- 对「两个都不错的回答，哪个更好」没有信号；
- 错误示范会被直接学走。

所以接下来利用 **reward signal** 继续优化：

```
RLHF → PPO → GRPO
```

> 一句话：**SFT 是模仿，RL 是优化偏好。**

## 22.2 PPO 和 GRPO 的结构差异 ★

:::unfold 先懂直觉
PPO 需要额外训练一个「价值模型」来估计每个状态值多少钱（baseline），显存和工程复杂度都高。GRPO 发现：同一道题采样多个回答，互相比较就能得到 baseline——不需要价值模型。
:::

**PPO 通常有四个模型**：

| 模型 | 作用 | 是否训练 |
| --- | --- | --- |
| Policy Model | 正在训练的模型 | ✅ |
| Reward Model | 给回答打分 | 冻结 |
| Value Model | 估计状态价值 $V(s)$（算 GAE 基线） | ✅（额外训练） |
| Reference Model | 计算 KL 惩罚的锚点 | 冻结 |

**GRPO 去掉了 Value Model**：

| 模型 | 作用 |
| --- | --- |
| Policy Model | 正在训练 |
| Reward Model / 规则校验 | 打分 |
| Reference Model | KL 锚点 |
| **Group Responses** | 同一 prompt 采样一组回答，组内比较代替 Value Model |

:::demo ppo-grpo 交互：结构对比
左右并排看 PPO（4 个模型）与 GRPO（3 个模型）的结构差异，注意 GRPO 用 Group Advantage 替代了 Value Model。
:::

:::warning 常见误区
- **GRPO 不是「不要 Reward」**：它只去掉了 Value Model，reward 信号仍然必需。
- **GRPO 不是「不用 RL」**：它仍是策略梯度类算法，只是 advantage 的估计方式不同。
- **GRPO 不是免费的**：省了一个 Value Model，但每个 prompt 要采样 G 个回答，采样成本更高。
:::

:::interview 面试常问
**Q：GRPO 为什么能去掉 Value Model？**

:::answer
PPO 需要 Value Model 来估计基线（baseline）以降低方差；GRPO 用「同一 prompt 的 G 个回答的组内均值」作为基线——同一上下文下样本天然可比，均值和标准差可以直接从组内估计，无需训练额外的价值网络。
:::
:::

## 22.3 Group Relative Advantage ★

:::unfold 先懂直觉
把同一道题的所有回答当成一个班，考得比班平均分高的加分，低于平均分的减分。奖励的绝对值不重要，重要的是在组内的相对位置。
:::

### 公式

$$
A_i = \frac{r_i - \mu}{\sigma}, \qquad \mu = \frac{1}{G}\sum_{i=1}^G r_i, \qquad \sigma = \sqrt{\frac{1}{G}\sum_{i=1}^G (r_i - \mu)^2}
$$

### 逐项拆解

| 符号 | 含义 |
| --- | --- |
| $r_i$ | 第 $i$ 个回答的 reward |
| $\mu$ | 组内均值（baseline） |
| $\sigma$ | 组内标准差（归一化尺度） |
| $A_i$ | 组内标准化优势：> 0 提高概率，< 0 降低概率 |

### 数字算例（G = 4）

reward = `[1, 3, 2, 6]`：

$$
\mu = \frac{1+3+2+6}{4} = 3
$$

$$
\sigma = \sqrt{\frac{(1-3)^2+(3-3)^2+(2-3)^2+(6-3)^2}{4}} = \sqrt{\frac{4+0+1+9}{4}} = \sqrt{3.5} \approx 1.871
$$

| 回答 | reward | $r_i - \mu$ | $A_i$ | 效果 |
| --- | --- | --- | --- | --- |
| 1 | 1 | −2 | **−1.07** | 降低概率 |
| 2 | 3 | 0 | **0.00** | 不变 |
| 3 | 2 | −1 | **−0.53** | 降低概率 |
| 4 | 6 | +3 | **+1.60** | 提高概率 |

:::demo grpo-group 交互：组内优势计算
拖动 4 个回答的 reward 滑块，实时看 mean、std、advantage 的计算，以及正优势（绿）/负优势（红）的变化。
:::

:::math 为什么用组内比较代替 Value Model
Value Model 估计的是「在状态 s 下的期望回报」，需要额外训练、额外显存，估计不准还会引入偏差。

GRPO 用同组样本的经验均值 $\mu$ 和标准差 $\sigma$ 直接构造 baseline——**无参数**估计。同一 prompt 的所有回答共享上下文，天然可比。

:::

:::warning 常见误区
- **advantage 只取决于组内相对表现**：如果一组 reward 是 [100, 101, 102, 103]，优势和 [1,3,2,6] 完全一样。
- **σ = 0 时要处理**：如果组内 reward 全相同，标准差为 0，需要加 eps 或跳过该组（无学习信号）。
- **组内比较是 on-policy 的**：每次更新后要重新采样。
:::

:::interview 面试常问
**Q：GRPO 的 advantage 和 PPO 的 GAE 有什么区别？**

:::answer
GAE 用 Value Model 估计的 V(s) 做基线，逐 token 计算优势（考虑折扣与时间结构）；GRPO 用同一 prompt 的 G 个回答的组内均值做基线，整条回答共享一个优势值。前者依赖价值网络，后者无参数但更粗糙，适合可验证奖励的任务。
:::
:::

## 22.4 Policy Ratio ★

:::unfold 先懂直觉
更新时不能盲目乐观：要用「新策略给这个回答的概率 ÷ 旧策略给的概率」来衡量这次更新让模型改变了多少。这个比值就是 ratio。
:::

### 公式

$$
r_t(\theta) = \frac{\pi_\theta(a_t \mid s_t)}{\pi_{\theta_{old}}(a_t \mid s_t)}
$$

### 逐项拆解

| ratio | 含义 |
| --- | --- |
| 1.0 | 没有变化 |
| 1.5 | 概率增加到 1.5 倍 |
| 0.5 | 概率下降到一半 |

:::note 为什么需要 ratio
采集数据时用的是旧策略 $\pi_{old}$，但更新的是新策略 $\pi_\theta$。两者分布不同，直接用旧数据估计新策略的期望是有偏的——ratio 就是**重要性采样（importance sampling）**的修正因子：

$$
\mathbb E_{\pi_\theta}[f] = \mathbb E_{\pi_{old}}\left[\frac{\pi_\theta}{\pi_{old}} f\right]
$$

:::

:::demo policy-ratio 交互：ratio 与 clip 的可视化
拖动 π_old、π_new、advantage 和 ε，实时看 ratio 的计算、clip 区间的位置，以及目标函数曲线在 clip 边界变平的过程。
:::

## 22.5 为什么需要 Clip ★

:::unfold 先懂直觉
如果某个回答 reward 特别高，模型可能一次把它的概率从 0.01 拉到 0.9——步子太大，训练崩掉。Clip 就是把单次更新的幅度限制在 ±20% 以内。
:::

### 公式

$$
L^{clip}(\theta) = \mathbb E\left[\min\left(r_t(\theta) A_t,\ \text{clip}(r_t(\theta), 1-\epsilon, 1+\epsilon) A_t\right)\right]
$$

### 逐项拆解

| 情况 | 行为 |
| --- | --- |
| $A_t > 0$（好回答） | ratio 被上限 $1+\epsilon$ 截断，防止过度提高概率 |
| $A_t < 0$（坏回答） | ratio 被下限 $1-\epsilon$ 截断，防止过度降低概率 |
| 取 min | 保证「悲观更新」——只在保守方向上获益 |

### 数字算例（ε = 0.2）

π_old = 0.4，π_new = 0.6 → ratio = 1.5，A = 1.0：

| 项 | 计算 | 结果 |
| --- | --- | --- |
| $r \cdot A$ | 1.5 × 1.0 | 1.5 |
| clip(r) | clamp(1.5, 0.8, 1.2) | 1.2 |
| clip(r)·A | 1.2 × 1.0 | 1.2 |
| min | min(1.5, 1.2) | **1.2** |

即使继续提高概率，收益也被截断在 1.2——单次更新幅度被限制在 20% 以内。

:::warning 常见误区
- **clip 的是 ratio，不是 advantage**。
- **clip 让目标函数在边界外变平**（梯度为 0），不是把 ratio 永久改掉——下一轮重新计算。
- **ε 太小会学得慢，太大会不稳定**：常用 0.1~0.2。
:::

:::interview 面试常问
**Q：PPO/GRPO 的 clip 机制解决什么问题？**

:::answer
防止策略单次更新过猛（如把某个回答概率从 0.01 拉到 0.9）导致训练崩溃。通过把 ratio 限制在 [1−ε, 1+ε] 并取 min，目标函数在超出范围后变平（梯度为 0），实现「悲观更新」——只在不激进的方向上获益。
:::
:::

## 22.6 KL Divergence ★

:::unfold 先懂直觉
KL 衡量两个概率分布「差多远」。RL 训练时用它约束模型别为了拿奖励而跑得太偏——跑太偏会语言退化、钻奖励空子（reward hacking）。
:::

### 公式

$$
D_{KL}(P \| Q) = \sum_x P(x) \log \frac{P(x)}{Q(x)}
$$

### 逐项拆解

| 性质 | 说明 |
| --- | --- |
| 非负性 | $D_{KL}(P\|Q) \ge 0$，当且仅当 P = Q 时为 0 |
| 不对称 | $D_{KL}(P\|Q) \ne D_{KL}(Q\|P)$，不是「距离」 |
| 不满足三角不等式 | 因此不能当度量空间用 |
| 直觉 | 「用 P 的分布去看 Q 有多意外」 |

### 数字算例

P = `[0.5, 0.5]`，Q = `[0.25, 0.75]`：

$$
D_{KL}(P\|Q) = 0.5 \ln\frac{0.5}{0.25} + 0.5 \ln\frac{0.5}{0.75}
$$

$$
= 0.5 \times 0.693 + 0.5 \times (-0.405) = 0.347 - 0.203 = 0.144
$$

反向 $D_{KL}(Q\|P)$：

$$
= 0.25 \ln\frac{0.25}{0.5} + 0.75 \ln\frac{0.75}{0.5} = 0.25 \times (-0.693) + 0.75 \times 0.405 = -0.173 + 0.304 = 0.131
$$

可以看到 0.144 ≠ 0.131——**KL 不对称**。

:::demo kl-divergence 交互：拖动滑块看 KL 变化
固定 reference 分布，拖动 α 让当前 policy 逐渐偏离，实时计算 KL 值。观察偏离越大 KL 越大。
:::

在 RL 中：

- 当前 Policy：$\pi_\theta$；
- Reference model：$\pi_{ref}$（通常是 SFT 后的模型，冻结）。

加入惩罚：

$$
-\beta\, D_{KL}(\pi_\theta \| \pi_{ref})
$$

:::fold 工程里怎么用（GRPO 的 KL 估计）
```python
# k3 无偏估计（逐 token）：
log_ratio = ref_logprobs - policy_logprobs
kl = torch.exp(log_ratio) - log_ratio - 1
# 等价于 (π_ref/π_θ) - log(π_ref/π_θ) - 1
```
:::

:::warning 常见误区
- **KL 不对称**：$D(P\|Q) \ne D(Q\|P)$，RL 里用哪个方向要明确（GRPO 用 $\pi_\theta \| \pi_{ref}$ 的估计）。
- **KL 惩罚不能去掉**：没有约束，模型会迅速退化到「刷分模式」。
- **KL 不参与 reward 打分**：它是额外的正则项，加在目标函数里。
:::

:::interview 面试常问
**Q：RL 训练中 KL 惩罚的作用？**

:::answer
约束当前策略不要偏离 reference（SFT 模型）太远：① 防止语言能力退化（输出重复、语病）；② 防止 reward hacking（钻奖励模型漏洞）；③ 保持输出多样性。代价是限制了探索范围，β 需要调节。
:::
:::

## 22.7 GRPO 的目标函数 ★

:::unfold 先懂直觉
GRPO 的目标可以读成一句话：**在「不跑偏」的前提下，提高好回答的概率、降低坏回答的概率，且每次别改太多。**
:::

### 公式（完整展开）

$$
\mathcal J_{GRPO}(\theta) = \frac{1}{G}\sum_{i=1}^{G}\frac{1}{|o_i|}\sum_{t=1}^{|o_i|}
\left[
\min\left(r_{i,t}(\theta) A_i,\ \text{clip}(r_{i,t}(\theta), 1-\epsilon, 1+\epsilon) A_i\right)
- \beta\, D_{KL,i,t}
\right]
$$

### 逐项拆解

| 符号 | 含义 |
| --- | --- |
| $G$ | 每个 prompt 采样的回答数 |
| $|o_i|$ | 第 $i$ 个回答的 token 数（长度归一化） |
| $r_{i,t}$ | 第 $i$ 个回答第 $t$ 个 token 的概率比 |
| $A_i$ | 第 $i$ 个回答的组内优势（整条共享） |
| $\epsilon$ | clip 范围（如 0.2） |
| $\beta$ | KL 惩罚系数 |
| $D_{KL,i,t}$ | 与 reference 的逐 token KL |

**结构**：

$$
\boxed{\text{目标} \approx \text{Policy Improvement} - \text{KL Penalty}}
$$

> 这就已经抓住 80% 核心。

:::warning 常见误区
- **别死背公式**：先记住「组内优势 × 概率比，clip 限制，KL 约束」四件事。
- **长度归一化容易被忽略**：不同回答长度不同，除以 $|o_i|$ 避免长回答主导。
:::

## 22.8 On-policy 与 Off-policy

**On-policy**：数据就是当前 policy 刚生成的。

```
current policy → rollout → reward → update current policy
```

**Off-policy**：训练数据可能来自 old policy、其他 policy、历史 buffer。

此时需要处理「数据分布和当前模型分布不一致」的问题——ratio 就是重要性采样修正。

:::note GRPO 是 on-policy 算法
每轮用当前 policy 采样 group，更新后这批数据就作废（或只做少量 epoch），需要重新采样。这也是 GRPO 训练成本高的原因之一：采样（推理）和训练交替进行。
:::

## 22.9 Reward Model 从哪里来

| 来源 | 例子 | 适用 |
| --- | --- | --- |
| Reward Model | 人类偏好数据训练 | 通用对话 |
| Rule-based | 格式检查、长度、关键词 | 快速原型 |
| Correctness verifier | 答案比对 | 数学、选择题 |
| Unit tests | 代码跑测试用例 | 代码 |
| Human feedback | 人工打分 | 高价值场景 |

GRPO 本身**不强制** reward 一定是哪一种。这也是它流行的重要原因：在数学、代码等**可验证任务**上，可以直接用规则 reward，省掉 Reward Model。

## 22.10 本章总结

:::key 本节必须记住
| 概念 | 一句话 |
| --- | --- |
| 为什么 RL | SFT 学示范，RL 直接优化偏好 |
| GRPO 核心 | 去掉 Value Model，用组内相对优势 |
| $A_i = (r_i-\mu)/\sigma$ | 高于组平均加分，低于组平均减分 |
| Policy Ratio | 新旧策略概率比，重要性采样修正 |
| Clip | 限制单次更新幅度（如 ±20%），悲观更新 |
| KL 惩罚 | 别偏离 reference 太远，防 reward hacking |
| On/Off-policy | 数据是否来自当前策略 |
| Reward 来源 | 模型 / 规则 / 校验器 / 人工 |
:::

:::quiz
GRPO 相比 PPO 最核心的结构变化是？

A. 去掉了 Reward Model
B. 去掉了 Value Model，用组内相对优势估计 baseline
C. 去掉了 Policy Model
D. 去掉了 Reference Model

答案: B
解析: GRPO 用「同一 prompt 采样一组回答、组内标准化」来构造 advantage，从而不需要训练 Value Model。Reward 和 Reference 仍然需要。
:::

:::quiz
GRPO 中 advantage Aᵢ 的计算方式是？

A. Aᵢ = rᵢ
B. Aᵢ = (rᵢ − mean) / std（组内标准化）
C. Aᵢ = rᵢ − V(s)
D. Aᵢ = log(rᵢ)

答案: B
解析: GRPO 把同一 prompt 的 G 个回答的 reward 做组内标准化得到 advantage。比组平均好的为正、差的为负。C 是 PPO/GAE 的思路。
:::

:::quiz
Clip 机制的作用是？

A. 裁剪训练数据
B. 限制策略单次更新的幅度，防止训练不稳定
C. 减少显存
D. 加速采样

答案: B
解析: clip(r, 1−ε, 1+ε) 把概率比限制在如 [0.8, 1.2]，避免某个高 reward 样本让概率剧变（如 0.01→0.9）导致崩溃。目标函数在边界外变平，实现悲观更新。
:::

:::quiz
GRPO 中 KL 惩罚项的目的是？

A. 加速收敛
B. 约束当前策略不要偏离 reference 太远，防止语言退化与 reward hacking
C. 提高 reward 数值
D. 替代 clip

答案: B
解析: −β·D_KL(π_θ‖π_ref) 惩罚偏离。没有它模型会为刷分而输出退化文本或钻奖励漏洞。它与 clip 是互补的两道保险。
:::

:::quiz
关于 KL 散度，说法正确的是？

A. 是对称的
B. 满足三角不等式
C. 非负，P=Q 时为 0
D. 可以大于 1

答案: C
解析: KL 非负（吉布斯不等式），P=Q 时为 0；但它不对称（D(P‖Q) ≠ D(Q‖P)）、不满足三角不等式，所以不是严格意义上的「距离」。KL 可以大于 1，取决于分布差异。
:::

:::related
依赖 | SFT, 策略梯度, KL 散度, Reward Model
用于 | 对齐训练, 可验证奖励, 推理模型, 偏好优化
:::
