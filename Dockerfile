FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs catalog.json sources.json quote-sources.json ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
