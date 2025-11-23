FROM node:18-alpine

WORKDIR /app

COPY package.json ./
# We need to copy the root package.json and lock file if we were using them for install, 
# but for this simple scaffold we'll assume we can install directly or we'd need to handle workspaces.
# For simplicity in this MVP scaffold without a complex build step:
COPY package.json tsconfig.json ./

RUN npm install

COPY src ./src

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
