/**
 * Advanced Context Window with AI Summarization
 *
 * This example demonstrates using AI to summarize old messages
 * when the context window is full, maintaining conversation coherence.
 */

import { smartContextWindow, createAISummarizer } from "../../src/ai/context-window";
import { ContextStrategy } from "../../src/types/context-window";
import { compose } from "../../src/composition/compose";
import { withRetry, withTimeout } from "../../src/composition/middleware";
import type { Message } from "../../src/types/context-window";

// Simulate AI API for text generation
interface AIResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

async function generateText(messages: Message[]): Promise<AIResponse> {
  // In production, this would call OpenAI, Anthropic, etc.
  const random = Math.random();

  if (random < 0.1) {
    throw new Error("API temporarily unavailable");
  }

  const lastMessage = messages[messages.length - 1];

  return {
    text: `AI response to: "${lastMessage.content.substring(0, 40)}..."\n\nBased on our conversation history, here's my detailed answer with context from previous messages.`,
    usage: {
      promptTokens: estimateTokens(messages),
      completionTokens: 50,
      totalTokens: estimateTokens(messages) + 50,
    },
  };
}

// Simulate AI summarization
async function summarizeConversation(messages: Message[]): Promise<string> {
  // In production, use a smaller/cheaper model for summarization
  const messageCount = messages.length;
  const userMessages = messages.filter((m) => m.role === "user").length;
  const topics = extractTopics(messages);

  return `[Context Summary] Previous conversation covered ${messageCount} messages with ${userMessages} user questions. Main topics: ${topics.join(", ")}. Key points discussed and user preferences noted.`;
}

function extractTopics(messages: Message[]): string[] {
  // Simple topic extraction (in production, use NLP)
  const topics = new Set<string>();

  messages.forEach((msg) => {
    if (msg.content.toLowerCase().includes("weather")) topics.add("weather");
    if (msg.content.toLowerCase().includes("travel")) topics.add("travel");
    if (msg.content.toLowerCase().includes("food")) topics.add("food");
    if (msg.content.toLowerCase().includes("technology")) topics.add("technology");
    if (msg.content.toLowerCase().includes("sports")) topics.add("sports");
  });

  return topics.size > 0 ? Array.from(topics) : ["general conversation"];
}

function estimateTokens(messages: Message[]): number {
  const totalChars = messages.reduce(
    (sum, msg) => sum + msg.content.length + (msg.role?.length || 0),
    0
  );
  return Math.ceil(totalChars / 4);
}

// Create a long conversation
function createLongConversation(): Message[] {
  const topics = [
    { topic: "weather", question: "What's the weather like?", context: "discussing weather patterns" },
    { topic: "travel", question: "Best places to travel in Europe?", context: "planning a trip" },
    { topic: "food", question: "Recommend Italian restaurants", context: "looking for dinner options" },
    { topic: "technology", question: "Explain quantum computing", context: "learning about tech" },
    { topic: "sports", question: "Who won the championship?", context: "sports discussion" },
  ];

  const messages: Message[] = [
    {
      role: "system",
      content:
        "You are a knowledgeable AI assistant. Provide helpful, accurate, and contextual responses based on conversation history.",
    },
  ];

  // Create 50 back-and-forth exchanges
  for (let i = 0; i < 50; i++) {
    const topic = topics[i % topics.length];

    messages.push({
      role: "user",
      content: `${topic.question} (iteration ${i + 1}). I'm ${topic.context}. ${"Additional context ".repeat(30)}`,
    });

    messages.push({
      role: "assistant",
      content: `Here's my answer about ${topic.topic} for iteration ${i + 1}. ${"Detailed explanation ".repeat(40)}`,
    });
  }

  // Add current question
  messages.push({
    role: "user",
    content: "Based on our entire conversation, what are my main interests?",
  });

  return messages;
}

async function main() {
  console.log("=== Context Window with AI Summarization ===\n");

  const conversation = createLongConversation();
  console.log(`Created conversation with ${conversation.length} messages`);

  const originalTokens = estimateTokens(conversation);
  console.log(`Estimated tokens: ${originalTokens.toLocaleString()}\n`);

  // Create resilient AI call with retry and timeout
  const resilientAI = compose(
    async (messages: Message[]) => await generateText(messages),
    withTimeout({ duration: 10000 }),
    withRetry({
      maxAttempts: 3,
      delayMs: 1000,
      backoff: "exponential",
    })
  );

  // Create AI summarizer
  const summarizer = createAISummarizer(async (messages: Message[]) => {
    console.log(`  🤖 Summarizing ${messages.length} old messages...`);
    const summary = await summarizeConversation(messages);
    console.log(`  ✅ Summary created: ${summary.substring(0, 80)}...\n`);
    return summary;
  });

  const analytics = {
    totalCalls: 0,
    totalTokensSaved: 0,
    summarizationCalls: 0,
  };

  console.log("--- Strategy 1: Summarize Old Messages ---\n");

  try {
    const result1 = await smartContextWindow({
      execute: async (messages) => {
        analytics.totalCalls++;
        console.log(`📤 Sending ${messages.length} messages to AI...`);

        const response = await resilientAI(messages);

        console.log(`📥 Received response (${response.usage.totalTokens} tokens used)\n`);

        return response;
      },
      messages: conversation,
      maxTokens: 8000, // Simulate GPT-4 Turbo 128k limit with safety margin
      strategy: ContextStrategy.SUMMARIZE_OLD,
      summarizeOldCount: 30, // Keep last 30 messages, summarize the rest
      summarizer,
      onTruncation: (origCount, optCount, origTokens, optTokens) => {
        const saved = origTokens - optTokens;
        analytics.totalTokensSaved += saved;
        analytics.summarizationCalls++;

        console.log(`📊 Context Optimization:`);
        console.log(`  Messages: ${origCount} → ${optCount}`);
        console.log(`  Tokens: ${origTokens.toLocaleString()} → ${optTokens.toLocaleString()}`);
        console.log(`  Saved: ${saved.toLocaleString()} tokens (${((saved / origTokens) * 100).toFixed(1)}%)\n`);
      },
    });

    console.log(`✅ Response: ${result1.value.text}\n`);
    console.log(`📈 Result Metadata:`);
    console.log(`  Original messages: ${result1.originalMessageCount}`);
    console.log(`  Optimized messages: ${result1.optimizedMessageCount}`);
    console.log(`  Was optimized: ${result1.wasOptimized}`);
    console.log(`  Strategy: ${result1.strategyUsed}`);
    console.log(`  Token usage: ${result1.value.usage.totalTokens}\n`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }

  console.log("\n--- Strategy 2: Hybrid Approach ---\n");
  console.log("Using summarization + priority filtering\n");

  // Add some important messages
  const conversationWithPriority = conversation.map((msg, idx) => {
    // Mark every 10th message as important
    if (idx % 10 === 0 && msg.role === "user") {
      return { ...msg, metadata: { important: true } };
    }
    return msg;
  });

  try {
    const result2 = await smartContextWindow({
      execute: async (messages) => {
        return await resilientAI(messages);
      },
      messages: conversationWithPriority,
      maxTokens: 8000,
      strategy: ContextStrategy.CUSTOM,
      strategies: {
        custom: async (messages, currentTokens, maxTokens) => {
          console.log(`  🔧 Applying hybrid optimization...`);

          // Step 1: Keep all important messages
          const importantMessages = messages.filter(
            (m) => m.metadata?.important || m.role === "system"
          );

          // Step 2: If still too many tokens, summarize old non-important messages
          const importantTokens = estimateTokens(importantMessages);

          if (importantTokens < maxTokens * 0.7) {
            // We have room, add recent messages
            const otherMessages = messages.filter(
              (m) => !m.metadata?.important && m.role !== "system"
            );
            const recentMessages = otherMessages.slice(-20);

            console.log(`  ✅ Kept ${importantMessages.length} important + ${recentMessages.length} recent messages\n`);

            return [...importantMessages, ...recentMessages];
          } else {
            // Need to summarize
            const summary = await summarizeConversation(importantMessages.slice(0, -10));
            const summaryMessage: Message = {
              role: "system",
              content: summary,
            };

            console.log(`  ✅ Summarized context + kept important messages\n`);

            return [summaryMessage, ...importantMessages.slice(-10)];
          }
        },
      },
      onOptimization: (strategy) => {
        console.log(`Applied ${strategy} strategy\n`);
      },
    });

    console.log(`✅ Response: ${result2.value.text}\n`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }

  console.log("\n=== Analytics Summary ===");
  console.log(`Total AI calls: ${analytics.totalCalls}`);
  console.log(`Summarization calls: ${analytics.summarizationCalls}`);
  console.log(`Total tokens saved: ${analytics.totalTokensSaved.toLocaleString()}`);
  console.log(`Average tokens saved per optimization: ${Math.round(analytics.totalTokensSaved / Math.max(analytics.summarizationCalls, 1)).toLocaleString()}`);

  const costPerMillionTokens = 10; // $10 per 1M tokens (example)
  const moneySaved = (analytics.totalTokensSaved / 1_000_000) * costPerMillionTokens;
  console.log(`Estimated cost saved: $${moneySaved.toFixed(4)}`);

  console.log("\n💡 Benefits:");
  console.log("  ✅ Prevents context_length_exceeded errors");
  console.log("  ✅ Maintains conversation coherence with summaries");
  console.log("  ✅ Reduces token usage and costs");
  console.log("  ✅ Keeps important messages intact");
  console.log("  ✅ Transparent to the application logic");
}

main().catch(console.error);
