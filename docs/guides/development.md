# Development

[Guides index](README.md) · [Development reference](../reference/development.md)

Run commands from the repository root with the [documented prerequisites](../reference/development.md#commands).

Use `make test TEST_ARGS=src/rules` to focus tests, replacing the test path for the change.
Use `make check` for isolated lint, tests and builds, or `make build` to build and
check art reproduction, then export the ignored `dist/` directory.

The [command table](../reference/development.md#commands) lists the available recipes.
Native npm scripts use those recipes in the current environment and need a check
container or delivery gate for checks. See [containers](../reference/development.md#containers)
for resource limits and [native tools](../reference/development.md#native-tools) for development tools.
