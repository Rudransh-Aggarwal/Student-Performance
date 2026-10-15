FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src
USER node
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:4100/health || exit 1
CMD ["node", "src/server.js"]