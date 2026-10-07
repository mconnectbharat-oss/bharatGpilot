# GitHub integration foundation

BharatGPilot now has a server-side GitHub client boundary and a repository-intelligence interface.

## Security boundary

GitHub credentials are read only from the server environment through GITHUB_TOKEN. They are not accepted as browser request data.

This is an integration foundation, not yet a GitHub App implementation. A production GitHub App should replace broad token configuration with installation-scoped credentials and least-privilege permissions.

## Repository intelligence

The initial inspection flow can retrieve:

- repository metadata
- default branch
- visibility
- primary language
- stars/forks/open issues
- root directory entries

Returned facts are represented as DIRECT evidence when directly returned by GitHub. If a requested fact cannot be verified by the inspected source, the system can represent that as NO EVIDENCE FOUND rather than converting absence into a negative claim.

## Current boundary

Repository inspection is read-only. Branch creation, pull requests, merges, deployment, and destructive operations remain behind the action policy and are not implemented by this module.
