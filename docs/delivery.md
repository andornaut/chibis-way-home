# Delivery

[Documentation index](README.md) · [Development](development.md)

Run image-maintenance commands from the repository root.

## Scheduled delivery

[delivery-kit](https://github.com/andornaut/delivery-kit) ships local `main` on the schedule in [`delivery-kit.json`](../delivery-kit.json). Each departure installs dependencies with `npm ci` and runs `tests/container/check lint`, `test` and `build` (the same categories as `make check`) on the `main` HEAD in an isolated container, pushes that exact commit, waits for its CI and then deploys the gated build with Wrangler to the account pinned by `account_id` in [`wrangler.jsonc`](../wrangler.jsonc). A departure starts only while the one-minute load is below 30; otherwise it re-checks the load every minute for up to 15 minutes after its slot, then skips that slot. Pushes and deployments are not made by hand.

## Gate image

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

## Site routing

The `routes` entry in `wrangler.jsonc` serves the custom domain.
