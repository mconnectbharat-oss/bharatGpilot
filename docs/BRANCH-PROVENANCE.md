# Branch Provenance and Optimistic Concurrency

Every autonomous coding action is bound to a specific branch head SHA.

1. Branch creation records the exact base commit.
2. Every file mutation requires the branch to still point at the expected SHA.
3. Each successful commit becomes the expected SHA for the next mutation.
4. PR creation requires the final expected SHA and re-checks the remote branch head.
5. Any concurrent branch movement fails closed.

The Git reference API exposes the current branch commit SHA, and reference updates default to non-force behavior so existing work is not overwritten accidentally.