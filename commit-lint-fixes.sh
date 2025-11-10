#!/bin/bash

# Script to commit and push lint fixes
# Run this from the project root

echo "🔍 Running linter to verify fixes..."
npm run lint

if [ $? -ne 0 ]; then
  echo "❌ Linter failed. Please check the errors above."
  exit 1
fi

echo "✅ Linter passed!"
echo ""
echo "📝 Staging changes..."
git add src/composition/middleware.ts

echo "💾 Committing changes..."
git commit -m "fix(lint): remove unused variable and unnecessary try/catch in rate limiter middleware"

echo "🚀 Pushing to remote..."
git push

echo "✅ Done! Check CI to verify the build passes."
