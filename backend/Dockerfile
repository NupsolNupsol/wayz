FROM node:20-alpine

WORKDIR /app/backend

COPY workflow/package.json ./workflow/
RUN cd workflow && npm install --omit=optional
COPY workflow/ ./workflow/
RUN cd workflow && npm run build

COPY package.json ./
RUN npm install --omit=optional

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npx", "tsx", "src/index.ts"]
