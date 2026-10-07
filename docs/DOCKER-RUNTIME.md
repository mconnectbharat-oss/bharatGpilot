# Docker Runtime Configuration

The Docker execution provider requires an immutable image reference ending in `@sha256:<64-hex>`.

Set:

`BHARATGPILOT_DOCKER_IMAGE=docker.io/library/node@sha256:<approved-digest>`

The runtime uses `--pull never`, so the approved image must already exist on the execution host.

Do not use a mutable tag in production. Docker documents digest references as immutable and recommends pinning critical images to exact digests. citeturn0search0turn0search1

Operational requirements:
- Pre-pull the approved digest onto the isolated execution host.
- Restrict the host/container runtime to approved images.
- Rotate the digest deliberately when security updates are approved.
- Keep network disabled for repository execution.
