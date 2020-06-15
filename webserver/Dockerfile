FROM node:12
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY package*.json ./

RUN apt-get -y update
RUN apt-get -y install python3-pip
RUN pip3 install javalang
RUN pip3 install jsonpickle

USER node
RUN npm install
COPY --chown=node:node . .
EXPOSE 3000
CMD [ "node", "app.js" ]