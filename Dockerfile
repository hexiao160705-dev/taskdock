FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund --no-audit
COPY src ./src
COPY public ./public
RUN mkdir /app/.data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 REGISTRY_HOST=0.0.0.0
EXPOSE 4640 4641
CMD ["node", "src/server.js"]
