/**
 * Simple Human-in-the-Loop Example
 *
 * This example demonstrates automated decision-making with human escalation.
 */

import { humanInTheLoop, EscalationReason } from '../../src';

interface ContentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  keywords: string[];
}

async function main() {
  console.log('👤 Simple Human-in-the-Loop Example\n');

  const testCases = [
    { content: 'I love this product! It works great!', shouldEscalate: false },
    { content: 'This is terrible and I want my money back', shouldEscalate: false },
    { content: 'I think maybe it could be better or worse', shouldEscalate: true }, // Low confidence
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📍 Test Case ${i + 1}: "${testCase.content}"\n`);

    const result = await humanInTheLoop<string, ContentAnalysis>({
      execute: async () => {
        console.log('  🤖 AI analyzing content...');

        // Simulate AI analysis
        const analysis: ContentAnalysis = {
          sentiment: testCase.content.includes('love')
            ? 'positive'
            : testCase.content.includes('terrible')
              ? 'negative'
              : 'neutral',
          confidence: testCase.content.includes('maybe') ? 0.45 : 0.92,
          keywords: testCase.content.split(' ').slice(0, 3),
        };

        console.log(`  📊 Sentiment: ${analysis.sentiment} (${(analysis.confidence * 100).toFixed(0)}% confidence)`);

        return analysis;
      },

      input: testCase.content,

      escalationRules: [
        {
          name: 'low-confidence',
          shouldEscalate: (input, output) => {
            if (output && output.confidence < 0.7) {
              return true;
            }
            return false;
          },
          reason: EscalationReason.LOW_CONFIDENCE,
          priority: 5,
        },
      ],

      requestHumanReview: async (review) => {
        console.log('\n  🚨 ESCALATED TO HUMAN REVIEW');
        console.log(`     Reason: ${review.reason}`);
        if (review.aiOutput) {
          console.log(`     AI Confidence: ${(review.aiOutput.confidence * 100).toFixed(0)}%`);
        }

        // Simulate human review
        return new Promise((resolve) => {
          setTimeout(() => {
            console.log('  👤 Human reviewer: Marking as neutral\n');
            resolve({
              sentiment: 'neutral',
              confidence: 1.0,
              keywords: review.input.split(' ').slice(0, 3),
            } as ContentAnalysis);
          }, 1000);
        });
      },

      onEscalate: (review) => {
        console.log(`  ⚠️  Low confidence detected - routing to human`);
      },
    });

    console.log('  ✅ Final result:');
    console.log(`     Sentiment: ${result.sentiment}`);
    console.log(`     Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  }

  console.log('\n📊 Human-in-the-Loop Example Complete\n');
}

// Run the example
main().catch(console.error);
