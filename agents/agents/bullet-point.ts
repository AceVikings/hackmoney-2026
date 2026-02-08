import {
  ACNAgent,
  type JobPosting,
  type JobEvaluation,
  type TaskResult,
} from "../base-agent/index.js";
import { chatCompletion } from "../lib/openai.js";

const MODEL = "gpt-4o-mini";

/**
 * BulletPointAgent — Converts long text into structured bullet point lists.
 * Implements the ACN Agent Protocol.
 */
export class BulletPointAgent extends ACNAgent {
  constructor(ensName: string, maxLiability: number) {
    super(ensName, "Bullet-Point Extractor", maxLiability);
  }

  getSkills(): string[] {
    return ["text-summarization", "bullet-points", "key-extraction"];
  }

  async evaluateJob(job: JobPosting): Promise<JobEvaluation | null> {
    const skills = this.getSkills();
    const requiredLower = job.requiredSkills.map((s) => s.toLowerCase());

    const overlap = requiredLower.filter((s) => skills.includes(s));
    const text = `${job.title} ${job.description}`.toLowerCase();
    const keywords = [
      "summar",
      "bullet",
      "key point",
      "extract",
      "list",
      "tldr",
    ];
    const keywordMatch = keywords.some((kw) => text.includes(kw));

    if (overlap.length === 0 && !keywordMatch) return null;

    const relevanceScore = Math.min(
      100,
      overlap.length * 25 + (keywordMatch ? 35 : 0) + 10,
    );
    const proposedAmount = Number(Math.min(job.budget, job.budget * 0.7).toFixed(2));

    const message = [
      `🤖 ${this.ensName} — Bullet-Point Extractor`,
      "━━━━━━━━━━━━━━━━━━━━━━━",
      `📋 Capability Match: ${relevanceScore}%`,
      `📝 Approach: I will extract the most important points from the content and return a clean, numbered bullet-point list using ${MODEL}.`,
      `⏱️ Estimated Time: ~10 seconds`,
      `💰 Proposed: ${proposedAmount} USDC`,
      "━━━━━━━━━━━━━━━━━━━━━━━",
      `Model: ${MODEL} | Skills: ${skills.join(", ")}`,
    ].join("\n");

    return {
      relevanceScore,
      message,
      estimatedTime: "~10 seconds",
      proposedAmount,
    };
  }

  async executeTask(taskId: string, description: string): Promise<TaskResult> {
    try {
      const bullets = await chatCompletion(
        [
          {
            role: "system",
            content:
              "You are a key-point extractor. Read the text and output a numbered list of the most important points (max 10). Output only the numbered list.",
          },
          {
            role: "user",
            content: description,
          },
        ],
        MODEL,
        512,
      );

      const pointCount = (bullets.match(/^\d+\./gm) || []).length;

      return {
        success: true,
        output: { bullets, pointCount, model: MODEL },
        summary: `Extracted ${pointCount} key points`,
      };
    } catch (err: any) {
      return {
        success: false,
        output: { error: err.message },
        summary: `Failed: ${err.message}`,
      };
    }
  }
}
