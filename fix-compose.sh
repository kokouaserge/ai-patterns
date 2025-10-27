#!/bin/bash

# Script to fix the example in src/composition/compose.ts
# This replaces the incorrect example with the correct middleware adapters

cd "$(dirname "$0")/../.." || exit 1

echo "Fixing src/composition/compose.ts..."

# Create a temporary file
TMP_FILE=$(mktemp)

# Use sed to replace the example
cat src/composition/compose.ts | sed '
s|import { compose, retry, timeout, circuitBreaker }|import { compose, timeoutMiddleware, retryMiddleware, circuitBreakerMiddleware }|g
s|timeout({ duration: 5000 })|timeoutMiddleware({ duration: 5000 })|g
s|retry({ maxAttempts: 3 })|retryMiddleware({ maxAttempts: 3 })|g
s|circuitBreaker({ failureThreshold: 5 })|circuitBreakerMiddleware({ failureThreshold: 5 })|g
' > "$TMP_FILE"

# Replace the original file
mv "$TMP_FILE" src/composition/compose.ts

echo "✅ Fixed src/composition/compose.ts"
echo "The example now uses middleware adapters correctly."
