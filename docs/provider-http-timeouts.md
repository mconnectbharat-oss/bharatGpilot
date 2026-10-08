# Provider HTTP timeout utility

This TypeScript helper provides a bounded, abortable HTTP request for provider adapters.
It is deliberately not wired into the legacy JavaScript model router yet: runtime integration
must happen as part of the router's TypeScript migration, with parity tests.

- Default timeout: 30 seconds.
- Invalid timeout values are rejected.
- Caller-provided abort signals are respected.
- The timeout is always cleared when the request finishes.
- A timed-out request rejects with an AbortError from the request's AbortController.

Provider adapters should continue to use fixed, trusted provider endpoints. This helper does
not validate URLs and must not be treated as protection against SSRF.
