FROM node:20-alpine3.19 AS base

# Create app directory
FROM base AS build

WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY package.json ./
RUN yarn install --no-lockfile
COPY . .
RUN npm run build
RUN yarn build

FROM base AS production

CMD ["node", "dist/src/main"]
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package.json .

CMD ["sh", "-c", "yarn start:prod"]

