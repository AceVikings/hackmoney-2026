import {
  ACNAgent,
  type JobPosting,
  type JobEvaluation,
  type TaskResult,
} from "../base-agent/index.js";
import { chatCompletion } from "../lib/openai.js";

const MODEL = "gpt-4o-mini";

/**
 * SentimentAgent — Analyzes sentiment of text (positive/negative/neutral).
 * Implements the ACN Agent Protocol.
 */
export class SentimentAgent extends ACNAgent {
  constructor(ensName: string, maxLiability: number) {
    super(ensName, "Sentiment Analyst", maxLiability);
  }

  getSkills(): string[] {
    return ["sentiment-analysis", "text-classification", "opinion-mining"];
  }

  async evaluateJob(job: JobPosting): Promise<JobEvaluation | null> {
    const skills = this.getSkills();
    const requiredLower = job.requiredSkills.map((s) => s.toLowerCase());

    const overlap = requiredLower.filter((s) => skills.includes(s));
    const text = `${job.title} ${job.description}`.toLowerCase();
    const keywords = [
      "sentiment",
      "opinion",
      "positive",
      "negative",
      "tone",
      "mood",
      "feeling",
    ];
    const keywordMatch = keywords.some((kw) => text.includes(kw));

    if (overlap.length === 0 && !keywordMatch) return null;

    const relevanceScore = Math.min(
      100,
      overlap.length * 30 + (keywordMatch ? 40 : 0) + 10,
    );
    const proposedAmount = Math.min(job.budget, Math.round(job.budget * 0.6));

    const message = [
      `🤖 ${this.ensName} — Sentiment Analyst`,
      "━━━━━━━━━━━━━━━━━━━━━━━",
      `📋 Capability Match: ${relevanceScore}%`,
      `📝 Approach: I will perform sentiment analysis on the text, classifying it as positive/negative/neutral with a confidence score and key sentiment drivers.`,
      `⏱️ Estimated Time: ~8 seconds`,
      `💰 Proposed: ${proposedAmount} USDC`,
      "━━━━━━━━━━━━━━━━━━━━━━━",
      `Model: ${MODEL} | Skills: ${skills.join(", ")}`,
    ].join("\n");

    return {
      relevanceScore,
      message,
      estimatedTime: "~8 seconds",
      proposedAmount,
    };
  }

  async executeTask(taskId: string, description: string): Promise<TaskResult> {
    try {
      const raw = await chatCompletion(
        [
          {
            role: "system",
            content: `You are a sentiment analysis engine. Analyze the text and respond with ONLY a JSON object. No markdown, no code fences, no explanation. The JSON must have exactly these keys: sentiment (one of: positive, negative, neutral, mixed), confidence (integer 0-100), drivers (array of short strings).`,
          },
          { role: "user", content: `Analyze sentiment:\n${description}` },
        ],
        MODEL,
        512,
      );

      // Strip markdown code fences and extract JSON
      let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      // Try to extract JSON object if surrounded by extra text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // If JSON parsing fails, return the raw text as the result
        return {
          success: true,
          output: { sentiment: 'unknown', rawResponse: raw, model: MODEL },
          summary: `Sentiment analysis completed (raw output)`,
        };
      }

      return {
        success: true,
        output: { ...parsed, model: MODEL },
        summary: `Sentiment: ${parsed.sentiment} (${parsed.confidence}% confidence)`,
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
