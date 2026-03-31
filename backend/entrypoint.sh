#!/bin/sh
set -e

# Sync the database schema with the SQLite file (creates it if it doesn't exist)
echo "📦 Syncing database schema..."
npx prisma db push --accept-data-loss

# Start the application
echo "🚀 Starting SquawkBox Backend..."
npm start
