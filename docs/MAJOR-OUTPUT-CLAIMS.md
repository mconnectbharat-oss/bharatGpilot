# Major output claim evidence

Major outputs are evidence-carrying objects:

- **Project purpose**: linked to README/manifest evidence.
- **Health**: each scored area links to the observation supporting it; truncated coverage is explicitly limited.
- **Contribution recommendations**: each recommendation links to the issue or structural observation that motivated it.
- **Security**: each finding links to the repository source that triggered it; a clean bounded scan is marked **NO EVIDENCE FOUND**, never "secure".
- **Final action decision**: carries the complete evidence chain used by the reviewer.

High confidence is reserved for claims with **DIRECT** evidence. INDIRECT evidence can support an inference but cannot by itself authorize a high-confidence claim. NO EVIDENCE FOUND means the claim could not be verified; it never means the opposite is true.

The action receipt already includes the final review object, so these evidence chains become part of the authorization context and therefore the receipt hash.
