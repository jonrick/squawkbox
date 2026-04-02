FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# Use --legacy-peer-deps or create a dummy lockfile if it doesnt exist to avoid install errors
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV production

# Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
