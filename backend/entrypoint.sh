#!/bin/sh
set -e

# Sync the database schema with the latest Prisma definition from the image
echo "📦 Applying latest database schema to $DATABASE_URL..."
npx prisma db push --accept-data-loss --schema ./prisma/schema.prisma || true

# Start the application
echo "🚀 Starting SquawkBox Backend..."
npm start
