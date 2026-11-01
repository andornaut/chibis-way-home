FROM node:24.21.0 AS node
FROM python:3.12-bookworm

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/ /usr/local/lib/node_modules/

RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && npm --version \
    && npx --version \
    && node --eval "if (process.versions.node !== '24.21.0') process.exit(1)" \
    && python3 -c "import sys; assert sys.version_info[:2] == (3, 12)"
