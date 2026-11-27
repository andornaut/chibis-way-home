# Gate-image maintenance

[Guides index](README.md) · [Delivery reference](../reference/delivery.md)

Run image-maintenance commands from the repository root.

The gate image is the immutable local image ID in `delivery-kit.json`, built from the custom Dockerfile's `toolchain` stage on the delivery host and tagged so that image pruning keeps it. The gate's own `npm ci` installs dependencies into its work copy:

```sh
tar --create --file "${TMPDIR:-/tmp}/chibi-gate-context.tar" \
  --mode='u+rwX,go+rX' --files-from tests/container/context
tests/container/admit build-image
docker build --resource cpu-period=100000 --resource cpu-quota=400000 \
  --resource memory=4g --build-arg NODE_VERSION="$(sed 's/^v//' .nvmrc)" \
  --target toolchain --tag chibi-check:node24.22.2-shellcheck0.11.0-toolchain \
  --file tests/container/Dockerfile - < "${TMPDIR:-/tmp}/chibi-gate-context.tar"
docker image inspect --format '{{.Id}}' chibi-check:node24.22.2-shellcheck0.11.0-toolchain
```

The printed ID must equal `gate.image`. Image IDs are content addressed and local: a change to the `toolchain` stage, `.nvmrc` or a base digest produces a new ID, which replaces the pin in `delivery-kit.json` once that image is verified.
