# Multi-stage build: Node compiles the Angular app, a small unprivileged nginx serves it.
FROM node:25-alpine AS build
WORKDIR /src

# Install first (only package files) so Docker caches node_modules between builds.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist/web/browser /usr/share/nginx/html
EXPOSE 8080
