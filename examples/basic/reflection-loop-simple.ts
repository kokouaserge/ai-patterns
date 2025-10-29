/**
 * Simple Reflection Loop Example
 *
 * This example demonstrates how AI can iteratively improve its output
 * through self-critique and regeneration.
 */

import { reflectionLoop } from '../../src';

interface TextOutput {
  text: string;
  version: number;
}

// Helper to simulate score extraction from critique
function extractScore(critique: string): number {
  const match = critique.match(/Score:\s*(\d+)/i);
  return match ? parseInt(match[1]) : 5;
}

async function main() {
  console.log('🔄 Simple Reflection Loop Example\n');
  console.log('Generating and iteratively improving a product description...\n');

  const result = await reflectionLoop<TextOutput>({
    execute: async (ctx) => {
      console.log(`\n📝 Iteration ${ctx.iteration}:`);

      if (ctx.iteration === 1) {
        // First attempt
        console.log('   Generating initial description...');
        return {
          text: 'This product is good and works well.',
          version: 1,
        };
      } else {
        // Subsequent attempts - improve based on feedback
        console.log(`   Previous score: ${ctx.previousCritique?.score}/10`);
        console.log(`   Improving based on feedback...`);

        // Simulate improvement based on iteration
        const improvements = [
          'Our innovative product delivers exceptional performance and reliability.',
          'Experience the future with our cutting-edge product that combines superior quality, ' +
            'unmatched performance, and innovative features designed to exceed your expectations.',
          'Transform your workflow with our revolutionary product: engineered with precision, ' +
            'crafted for excellence. Featuring advanced technology, intuitive design, and ' +
            'enterprise-grade reliability, it empowers teams to achieve more with less effort. ' +
            'Backed by 24/7 support and a 30-day satisfaction guarantee.',
        ];

        return {
          text: improvements[ctx.iteration - 2] || improvements[improvements.length - 1],
          version: ctx.iteration,
        };
      }
    },

    reflect: async (output, ctx) => {
      console.log('   🤔 AI critiquing own output...');

      // Simulate AI critique based on version
      const critiques = [
        {
          score: 3,
          feedback:
            'Score: 3\nIssues:\n- Too generic and bland\n- Lacks specific features\n- No compelling value proposition\n- Needs more professional tone',
          shouldContinue: true,
        },
        {
          score: 6,
          feedback:
            'Score: 6\nImprovements:\n- Better tone and vocabulary\n- More engaging\n\nRemaining issues:\n- Still lacks specific benefits\n- No call to action\n- Missing credibility indicators',
          shouldContinue: true,
        },
        {
          score: 9,
          feedback:
            'Score: 9\nStrengths:\n- Compelling value proposition\n- Specific benefits mentioned\n- Professional and engaging tone\n- Includes trust signals\n\nMinor note: Could add pricing context',
          shouldContinue: false,
        },
      ];

      // Simulate reflection time
      await new Promise((resolve) => setTimeout(resolve, 800));

      const critique = critiques[output.version - 1] || critiques[critiques.length - 1];

      console.log(`   Score: ${critique.score}/10`);
      console.log(`   Feedback: ${critique.feedback.split('\n')[1]}`);

      return critique;
    },

    maxIterations: 5,
    targetScore: 8,
    onMaxIterationsReached: 'return-best',

    // Lifecycle callbacks
    onIterationComplete: (iteration) => {
      console.log(`   ✅ Iteration ${iteration.iteration} complete`);
      console.log(`      Time: ${iteration.metrics.totalTime.toFixed(0)}ms`);
    },

    onImprovement: (current, previous) => {
      const improvement = current.critique.score - previous.critique.score;
      console.log(`   📈 Score improved by ${improvement.toFixed(1)} points!`);
    },

    onTargetReached: (iteration, history) => {
      console.log(`\n🎯 Target score reached in ${iteration.iteration} iterations!`);
    },
  });

  console.log('\n' + '='.repeat(70));
  console.log('📊 Final Results:');
  console.log('='.repeat(70));
  console.log(`\nFinal Text:\n"${result.value.text}"\n`);
  console.log(`Final Score: ${result.finalScore}/10`);
  console.log(`Iterations: ${result.iterations}`);
  console.log(`Target Reached: ${result.targetReached ? 'Yes ✅' : 'No ❌'}`);
  console.log(`Total Time: ${result.metrics.totalTime.toFixed(0)}ms`);
  console.log(`Average Time per Iteration: ${result.metrics.averageIterationTime.toFixed(0)}ms`);

  console.log('\n📈 Score Progression:');
  result.history.getScoreProgression().forEach((score, index) => {
    const bar = '█'.repeat(score);
    console.log(`   Iteration ${index + 1}: ${bar} ${score}/10`);
  });

  console.log('\n📊 Statistics:');
  console.log(`   Best Score: ${result.history.stats.bestScore}/10`);
  console.log(`   Worst Score: ${result.history.stats.worstScore}/10`);
  console.log(`   Average Score: ${result.history.stats.averageScore.toFixed(1)}/10`);
  console.log(`   Score Improvement: +${result.history.stats.scoreImprovement.toFixed(1)}`);
  console.log(`   Was Improving: ${result.history.wasImproving() ? 'Yes ✅' : 'No ❌'}`);

  console.log('\n✅ Reflection Loop Example Complete\n');
}

// Run the example
main().catch(console.error);
