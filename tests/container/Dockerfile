ARG NODE_VERSION=24.22.2

# The delivery-kit gate image. It holds no project file, so its ID changes only with this stage
# and NODE_VERSION; the gate installs dependencies into its own work copy.
FROM node:${NODE_VERSION}@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40 AS toolchain

COPY --from=koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d \
    /bin/shellcheck /usr/local/bin/shellcheck

# The digest selects the base image, so this fails when it does not hold the .nvmrc version
# that the Makefile passes.
ARG NODE_VERSION
RUN test "$(node --version)" = "v${NODE_VERSION}"

# UID 19001 is the user that tests/container/run and the delivery-kit gate start containers as.
USER 19001:19001
ENV HOME=/tmp HUSKY=0
WORKDIR /work
ENTRYPOINT []

# The local check image: the toolchain with the lockfile's dependencies, which
# tests/container/check copies into a work copy that has no node_modules.
FROM toolchain AS check

USER root
RUN install -d -m 0755 -o 19001 -g 19001 /opt/check
USER 19001:19001
COPY --chown=19001:19001 package.json package-lock.json /opt/check/
WORKDIR /opt/check
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY --chown=19001:19001 tests/container/check /opt/check/run
ENV PATH=/opt/check/node_modules/.bin:${PATH}
WORKDIR /work
