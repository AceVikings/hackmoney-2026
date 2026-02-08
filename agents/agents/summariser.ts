import {
  ACNAgent,
  type JobPosting,
  type JobEvaluation,
  type TaskResult,
} from "../base-agent/index.js";
import { chatCompletion } from "../lib/openai.js";

const MODEL = "gpt-4o-mini";

/**
 * SummariserAgent — Summarizes long text into concise summaries.
 * Implements the ACN Agent Protocol.
 */
export class SummariserAgent extends ACNAgent {
  constructor(ensName: string, maxLiability: number) {
    super(ensName, "Text Summariser", maxLiability);
  }

  getSkills(): string[] {
    return ["text-summarization", "content-condensation", "tldr"];
  }

  async evaluateJob(job: JobPosting): Promise<JobEvaluation | null> {
    const skills = this.getSkills();
    const requiredLower = job.requiredSkills.map((s) => s.toLowerCase());

    // Check skill overlap
    const overlap = requiredLower.filter((s) => skills.includes(s));

    // Also check title/description for summarization keywords
    const text = `${job.title} ${job.description}`.toLowerCase();
    const keywords = [
      "summar",
      "condense",
      "tldr",
      "shorten",
      "digest",
      "brief",
    ];
    const keywordMatch = keywords.some((kw) => text.includes(kw));

    if (overlap.length === 0 && !keywordMatch) return null;

    const relevanceScore = Math.min(
      100,
      overlap.length * 30 + (keywordMatch ? 40 : 0) + 10,
    );

    const proposedAmount = Number(Math.min(job.budget, job.budget * 0.8).toFixed(2));

    const message = [
      `🤖 ${this.ensName} — Text Summariser`,
      "━━━━━━━━━━━━━━━━━━━━━━━",
      `📋 Capability Match: ${relevanceScore}%`,
      `📝 Approach: I will use ${MODEL} to produce a concise, structured summary of the provided content, preserving key facts and reducing length by ~70%.`,
      `⏱️ Estimated Time: ~15 seconds`,
      `💰 Proposed: ${proposedAmount} USDC`,
      "━━━━━━━━━━━━━━━━━━━━━━━",
      `Model: ${MODEL} | Skills: ${skills.join(", ")}`,
    ].join("\n");

    return {
      relevanceScore,
      message,
      estimatedTime: "~15 seconds",
      proposedAmount,
    };
  }

  async executeTask(taskId: string, description: string): Promise<TaskResult> {
    try {
      const summary = await chatCompletion(
        [
          {
            role: "system",
            content:
              "You are a professional text summariser. Produce a clear, concise summary that preserves all key information. Output only the summary, nothing else.",
          },
          {
            role: "user",
            content: `Summarize the following:\n\n${description}`,
          },
        ],
        MODEL,
        512,
      );

      const inputWords = description.split(/\s+/).length;
      const outputWords = summary.split(/\s+/).length;

      return {
        success: true,
        output: { summary, inputWords, outputWords, model: MODEL },
        summary: `Summarized ${inputWords} words → ${outputWords} words`,
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
