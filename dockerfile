FROM node:11

WORKDIR /home/node/app
COPY . .

# If you have native dependencies, you'll need extra tools
# RUN apk add --no-cache make gcc g++ python
RUN npm install

EXPOSE 3000