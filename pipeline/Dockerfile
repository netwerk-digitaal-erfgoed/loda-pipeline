FROM node:26-alpine AS build

WORKDIR /app

COPY package*.json tsconfig.json ./
COPY pipeline/package.json pipeline/

RUN npm ci -w pipeline --include-workspace-root

COPY pipeline pipeline

RUN npm run compile

FROM node:26-alpine
LABEL org.opencontainers.image.source="https://github.com/netwerk-digitaal-erfgoed/loda-pipeline"

RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV QLEVER_ENV=remote

WORKDIR /app/

COPY package*.json ./
COPY pipeline/package.json pipeline/

RUN npm ci --omit=dev -w pipeline

COPY --from=build /app/pipeline/build /app/pipeline/build
COPY pipelines /app/pipelines
COPY base /app/base
COPY overrides /app/overrides
COPY pipelines.yaml /app/pipelines.yaml

RUN mkdir /app/output /app/imports && \
    chown node /app/output /app/imports

    USER node

ENTRYPOINT ["/sbin/tini", "--", "node", "pipeline/build/index.js"]
