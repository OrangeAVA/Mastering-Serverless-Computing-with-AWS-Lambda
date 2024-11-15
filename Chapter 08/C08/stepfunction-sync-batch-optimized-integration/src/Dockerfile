FROM --platform=arm64 node:20 as build

WORKDIR /app

COPY --chown=node:node package*.json ./
COPY --chown=node:node . .

RUN npm install

RUN npm run bundle

FROM --platform=linux/amd64 node:20-alpine as production

COPY --from=build /app/dist /app/dist
EXPOSE 8080

CMD [ "node", "/app/dist/index.js" ]