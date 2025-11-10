/**
 * Test to validate the rate limit fix
 * Ensures different queries return their own results (not cached previous results)
 */

import { compose, withRateLimiter, RateLimitStrategy } from "./src";

async function testRateLimitFix() {
  console.log("🧪 Testing Rate Limit Fix\n");

  // Create a composed function with rate limiter
  const robustApi = compose([
    withRateLimiter({
      maxRequests: 10,
      windowMs: 60000,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    }),
  ]);

  // Test 1: Call with different queries - each should return its own result
  console.log("Test 1: Multiple different API calls\n");

  const result1 = await robustApi(
    async () => {
      console.log("  ✓ Executing query 1: fetchUser");
      return { type: "user", id: 123, name: "Alice" };
    },
    undefined
  );
  console.log("  Result 1:", JSON.stringify(result1));

  const result2 = await robustApi(
    async () => {
      console.log("  ✓ Executing query 2: fetchProduct");
      return { type: "product", id: 456, name: "Phone" };
    },
    undefined
  );
  console.log("  Result 2:", JSON.stringify(result2));

  const result3 = await robustApi(
    async () => {
      console.log("  ✓ Executing query 3: fetchOrder");
      return { type: "order", id: 789, total: 99.99 };
    },
    undefined
  );
  console.log("  Result 3:", JSON.stringify(result3));

  // Verify results are correct
  console.log("\n📊 Verification:");
  const test1Pass = result1.type === "user" && result1.id === 123;
  const test2Pass = result2.type === "product" && result2.id === 456;
  const test3Pass = result3.type === "order" && result3.id === 789;

  console.log(`  Test 1 (user): ${test1Pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Test 2 (product): ${test2Pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Test 3 (order): ${test3Pass ? "✅ PASS" : "❌ FAIL"}`);

  if (test1Pass && test2Pass && test3Pass) {
    console.log("\n✅ SUCCESS: All queries returned their correct results!");
    console.log("   The rate limiter is now working correctly with different functions.");
  } else {
    console.log("\n❌ FAILURE: Some queries returned incorrect results!");
    console.log("   There may still be a caching/state issue.");
  }

  // Test 2: Verify rate limiting still works
  console.log("\n\nTest 2: Verify rate limiting enforcement\n");

  const fastApi = compose([
    withRateLimiter({
      maxRequests: 3,
      windowMs: 5000,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    }),
  ]);

  let rateLimitHit = false;
  try {
    for (let i = 1; i <= 5; i++) {
      console.log(`  Request ${i}/5`);
      await fastApi(async () => ({ request: i }), undefined);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Rate limit exceeded")) {
      rateLimitHit = true;
      console.log(`  ✓ Rate limit correctly enforced: ${error.message}`);
    } else {
      throw error;
    }
  }

  if (rateLimitHit) {
    console.log("\n✅ SUCCESS: Rate limiting is still enforced correctly!");
  } else {
    console.log("\n❌ FAILURE: Rate limiting was not enforced!");
  }

  // Test 3: Verify global counting across different functions
  console.log("\n\nTest 3: Verify global rate limit counter\n");

  const globalApi = compose([
    withRateLimiter({
      maxRequests: 3,
      windowMs: 5000,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    }),
  ]);

  let globalCountWorking = false;
  try {
    await globalApi(async () => ({ type: "user" }), undefined);
    console.log("  Request 1: user - ✓");
    await globalApi(async () => ({ type: "product" }), undefined);
    console.log("  Request 2: product - ✓");
    await globalApi(async () => ({ type: "order" }), undefined);
    console.log("  Request 3: order - ✓");
    await globalApi(async () => ({ type: "payment" }), undefined);
    console.log("  Request 4: payment - Should have been blocked!");
  } catch (error) {
    if (error instanceof Error && error.message.includes("Rate limit exceeded")) {
      globalCountWorking = true;
      console.log("  Request 4: payment - ✓ Correctly blocked by rate limit");
    }
  }

  if (globalCountWorking) {
    console.log("\n✅ SUCCESS: Global rate limiting works across different functions!");
    console.log("   All requests (regardless of function) are counted together.");
  } else {
    console.log("\n❌ FAILURE: Global rate limiting not working correctly!");
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 All tests completed!");
}

testRateLimitFix().catch(console.error);
