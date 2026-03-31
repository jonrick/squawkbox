FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
RUN chmod +x entrypoint.sh

EXPOSE 3001
CMD ["./entrypoint.sh"]
