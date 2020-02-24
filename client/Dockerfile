# build environment
# node slim image
FROM node:12.10.0-slim as builder
WORKDIR /usr/src/client

# installing packages
COPY ./package*.json ./
RUN npm install --quiet

# copy files
COPY . .
EXPOSE 3000
# build app
RUN npm run build

# production environment
FROM nginx:1.16.1-alpine
COPY --from=builder /usr/src/client/build /var/www
COPY --from=builder /usr/src/client/nginx.conf etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
