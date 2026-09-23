FROM node:20-alpine

WORKDIR /app

# better-sqlite3 не публикует prebuild для musl, поэтому модуль собирается при npm ci.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
