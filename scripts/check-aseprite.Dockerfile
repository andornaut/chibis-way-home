# Check image with headless Aseprite 1.2.30 for the art export checks.
# The base is the local image built from scripts/check.Dockerfile, expected ID
# sha256:25709b0553b835ace5e58289652b2d1e0806d473ba9a7b351af8ac9e7d7a679e. BuildKit resolves a
# FROM digest only against a registry, so the tag is pinned here and the ID is checked after the build.
# The licensed vendor .deb comes from the named build context aseprite-deb, outside the repository.
# The binary links libGL, libXcursor and libXfixes, which the package does not declare; apt resolves
# libGL through Mesa. Batch mode opens no display, so no X server is installed.
FROM game-check:node24.21.0-python3.12

ARG SNAPSHOT=20261103T000000Z

RUN --mount=type=bind,from=aseprite-deb,target=/mnt/aseprite-deb \
    set -eu \
    && cp /mnt/aseprite-deb/Aseprite_1.2.30-1_amd64.deb /tmp/ \
    && echo "0180ae561b83817bd63764589aba4eba9c2e5d4e8380387bf52f04f54b9a5ea7  /tmp/Aseprite_1.2.30-1_amd64.deb" | sha256sum -c - \
    && rm -f /etc/apt/sources.list.d/debian.sources \
    && printf '%s\n' \
        "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/${SNAPSHOT} bookworm main" \
        "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/${SNAPSHOT} bookworm-updates main" \
        "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/${SNAPSHOT} bookworm-security main" \
        > /etc/apt/sources.list \
    && apt-get update \
    && apt-get install --yes --no-install-recommends \
        /tmp/Aseprite_1.2.30-1_amd64.deb \
        libgl1=1.6.0-1 \
        libxcursor1=1:1.2.1-1 \
        libxfixes3=1:6.0.0-2 \
    && rm -f /tmp/Aseprite_1.2.30-1_amd64.deb \
    && rm -rf /var/lib/apt/lists/* \
    && if ldd /usr/bin/aseprite | grep 'not found'; then exit 1; fi \
    && dpkg-query -W -f '${Version}\n' aseprite | grep -qx 1.2.30-1 \
    && aseprite -b --version
