# Delivery reference

[Reference index](README.md) · [Gate-image maintenance](../guides/delivery.md)

## Scheduled delivery

[delivery-kit](https://github.com/andornaut/delivery-kit) ships local `main` on the schedule in [`delivery-kit.json`](../../delivery-kit.json). Each departure installs dependencies with `npm ci` and runs `tests/container/check lint`, `test` and `build` (the same categories as `make check`) on the `main` HEAD in an isolated container, pushes that exact commit, waits for its CI and then deploys the gated build with Wrangler to the account pinned by `account_id` in [`wrangler.jsonc`](../../wrangler.jsonc). A departure starts only while the one-minute load is below 30; otherwise it re-checks the load every minute for up to 15 minutes after its slot, then skips that slot. Pushes and deployments are not made by hand.

## Site routing

The `routes` entry in `wrangler.jsonc` serves the custom domain.
