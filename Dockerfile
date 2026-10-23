FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run compile

FROM node:26-alpine
LABEL org.opencontainers.image.source="https://github.com/netwerk-digitaal-erfgoed/loda-pipeline"

RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV QLEVER_ENV=remote
WORKDIR /app/
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/build /app/build
COPY --from=build /app/pipelines /app/pipelines
RUN mkdir /app/output /app/imports && \
    chown node /app/output /app/imports
USER node
ENTRYPOINT ["/sbin/tini", "--", "node", "build/index.js"]
