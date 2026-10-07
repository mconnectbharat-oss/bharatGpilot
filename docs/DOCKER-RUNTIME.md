# Docker Runtime Provider

This provider implements the isolated runtime contract with Docker.

Security controls:
- `--network none`
- read-only container root filesystem
- all Linux capabilities dropped
- no-new-privileges
- PID, CPU, and memory limits
- non-root UID/GID
- only the ephemeral repository workspace is writable
- minimal environment
- bounded execution timeout
- automatic container removal

Docker documents namespace/cgroup isolation, resource constraints, read-only filesystems, capability dropping, and no-new-privileges. The provider intentionally does not use privileged mode, host networking, Docker socket mounts, or unrelated host filesystem mounts.

Production requirement: the Docker daemon remains a high-value security boundary. Use a dedicated runner host with tightly controlled Docker API access.