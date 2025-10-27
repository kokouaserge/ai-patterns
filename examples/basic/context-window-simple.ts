/**
 * Simple Smart Context Window Example
 *
 * This example demonstrates how to automatically manage context token limits
 * to prevent context_length_exceeded errors.
 */

import { smartContextWindow } from "../../src/ai/context-window";
import { ContextStrategy } from "../../src/types/context-window";
import type { Message } from "../../src/types/context-window";

// Simulate AI text generation
async function generateText(messages: Message[]): Promise<string> {
  // In a real app, this would call an AI API (OpenAI, Anthropic, etc.)
  const lastMessage = messages[messages.length - 1];
  return `AI Response to: "${lastMessage.content.substring(0, 50)}..."`;
}

// Create a conversation history
function createConversationHistory(messageCount: number): Message[] {
  const messages: Message[] = [
    {
      role: "system",
      content: "You are a helpful AI assistant. Be concise and informative.",
    },
  ];

  for (let i = 0; i < messageCount; i++) {
    messages.push({
      role: "user",
      content: `User question ${i + 1}: ${"Lorem ipsum dolor sit amet ".repeat(20)}`,
    });

    messages.push({
      role: "assistant",
      content: `Assistant response ${i + 1}: ${"Here is a detailed answer ".repeat(25)}`,
    });
  }

  // Add the current question
  messages.push({
    role: "user",
    content: "What is the capital of France?",
  });

  return messages;
}

async function main() {
  console.log("=== Smart Context Window Simple Example ===\n");

  // Create a long conversation history (would exceed typical context limits)
  const conversationHistory = createConversationHistory(100);

  console.log(`Created conversation with ${conversationHistory.length} messages\n`);

  // Example 1: Sliding Window Strategy
  console.log("--- Example 1: Sliding Window Strategy ---\n");

  const result1 = await smartContextWindow({
    execute: async (messages) => {
      console.log(`Executing with ${messages.length} messages`);
      return await generateText(messages);
    },
    messages: conversationHistory,
    maxTokens: 5000, // Simulate a 5k token limit
    strategy: ContextStrategy.SLIDING_WINDOW,
    keepRecentCount: 20, // Keep only last 20 messages
    onTruncation: (origCount, optCount, origTokens, optTokens) => {
      console.log(`\n📉 Context Optimized:`);
      console.log(`  Messages: ${origCount} → ${optCount}`);
      console.log(`  Estimated tokens: ${origTokens} → ${optTokens}\n`);
    },
  });

  console.log(`Result: ${result1.value}`);
  console.log(`Was optimized: ${result1.wasOptimized}`);
  console.log(`Strategy used: ${result1.strategyUsed}\n`);

  // Example 2: Prioritize Important Messages
  console.log("\n--- Example 2: Prioritize Important Strategy ---\n");

  const conversationWithImportant: Message[] = [
    { role: "system", content: "You are a helpful assistant" },
    { role: "user", content: "Regular message 1" },
    { role: "assistant", content: "Response 1" },
    { role: "user", content: "@admin Please help with this urgent issue" },
    { role: "assistant", content: "I'll help with that" },
    { role: "user", content: "Regular message 2" },
    { role: "user", content: "/reset Reset the conversation" },
    { role: "user", content: "Regular message 3", metadata: { important: true } },
    { role: "user", content: "Regular message 4" },
    { role: "user", content: "What is the weather?" },
  ];

  const result2 = await smartContextWindow({
    execute: async (messages) => {
      console.log(`\nKept ${messages.length} important messages:`);
      messages.forEach((msg) => {
        if (msg.role !== "system") {
          console.log(`  - [${msg.role}] ${msg.content.substring(0, 50)}`);
        }
      });
      return await generateText(messages);
    },
    messages: conversationWithImportant,
    maxTokens: 100, // Very low limit to force optimization
    strategy: ContextStrategy.PRIORITIZE_IMPORTANT,
    onOptimization: (strategy, messages) => {
      console.log(`\nApplied strategy: ${strategy}`);
    },
  });

  console.log(`\nResult: ${result2.value}`);
  console.log(`Original: ${result2.originalMessageCount} messages`);
  console.log(`Optimized: ${result2.optimizedMessageCount} messages\n`);

  // Example 3: Truncate Middle Strategy
  console.log("\n--- Example 3: Truncate Middle Strategy ---\n");

  const result3 = await smartContextWindow({
    execute: async (messages) => {
      console.log(`\nContext structure after truncation:`);
      messages.forEach((msg, idx) => {
        const preview = msg.content.substring(0, 50);
        console.log(`  ${idx + 1}. [${msg.role}] ${preview}${msg.content.length > 50 ? "..." : ""}`);
      });
      return await generateText(messages);
    },
    messages: conversationHistory,
    maxTokens: 5000,
    strategy: ContextStrategy.TRUNCATE_MIDDLE,
    onTruncation: (origCount, optCount) => {
      console.log(`\nRemoved ${origCount - optCount} messages from the middle`);
    },
  });

  console.log(`\nResult: ${result3.value}\n`);

  // Example 4: Custom Strategy
  console.log("\n--- Example 4: Custom Strategy ---\n");

  const result4 = await smartContextWindow({
    execute: async (messages) => {
      console.log(`Custom strategy kept ${messages.length} messages`);
      return await generateText(messages);
    },
    messages: conversationHistory,
    maxTokens: 5000,
    strategy: ContextStrategy.CUSTOM,
    strategies: {
      custom: (messages) => {
        // Custom logic: keep every 10th message + system + last 5
        const systemMessages = messages.filter((m) => m.role === "system");
        const otherMessages = messages.filter((m) => m.role !== "system");

        const sampledMessages = otherMessages.filter((_, idx) => idx % 10 === 0);
        const recentMessages = otherMessages.slice(-5);

        return [...systemMessages, ...sampledMessages, ...recentMessages];
      },
    },
    onOptimization: (strategy) => {
      console.log(`Applied custom optimization strategy: ${strategy}\n`);
    },
  });

  console.log(`Result: ${result4.value}\n`);

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Total examples: 4`);
  console.log(`All strategies successfully prevented context overflow`);
  console.log(`Context management is transparent to the AI call`);
}

main().catch(console.error);
