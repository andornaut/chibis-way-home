ARG NODE_VERSION=24.21.0
FROM node:${NODE_VERSION} AS tools

COPY --from=koalaman/shellcheck:v0.11.0 /bin/shellcheck /usr/local/bin/shellcheck

FROM tools

ENV HUSKY=0
WORKDIR /opt/check
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tests/container/check /opt/check/run
ENV PATH=/opt/check/node_modules/.bin:${PATH}
WORKDIR /work
