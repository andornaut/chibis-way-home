FROM node:24.21.0-bookworm

RUN npm --version \
    && npx --version \
    && git --version \
    && node --eval "if (process.versions.node !== '24.21.0') process.exit(1)"
