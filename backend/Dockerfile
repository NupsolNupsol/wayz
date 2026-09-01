# The build context is the PLATFORM ROOT, not backend/ (see docker-compose.yml `build.context`).
# The API depends on the sibling workflow package through `"@wayz/workflow": "file:../workflow"`,
# so that directory has to sit next to backend/ inside the image exactly as it does on the host.
FROM node:20-alpine

# ---------------------------------------------------------------------------
# 1. Workflow engine — a local file: dependency. Its dist/ is what the API resolves at run
#    time, and it is never copied from the host (see .dockerignore) so the build stays
#    reproducible regardless of what the developer happens to have built locally.
# ---------------------------------------------------------------------------
WORKDIR /app
COPY workflow/package.json ./workflow/
RUN cd workflow && npm install --omit=optional
COPY workflow/ ./workflow/
RUN cd workflow && npm run build

# ---------------------------------------------------------------------------
# 2. API. Dependencies are installed before the sources are copied so an edit under src/
#    does not invalidate the npm layer.
# ---------------------------------------------------------------------------
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --omit=optional

COPY backend/tsconfig.json ./
COPY backend/src ./src

# NODE_ENV is the only build-time value here on purpose: no credential is ever baked into an
# image layer. Every secret is injected at run time through docker-compose `environment:`,
# which reads it from the host environment / backend/.env.
ENV NODE_ENV=production
EXPOSE 4000

CMD ["npx", "tsx", "src/index.ts"]
