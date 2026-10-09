# Research service security alerts

The research sidecar counts failed internal-service token checks per source IP. By
default, it sends an Amazon SES email after **5 failures in 10 minutes**, then
rate-limits further alerts for that source for the same window. The counter is
in-memory and per process; it is best-effort alerting, not a substitute for
gateway rate limits, centralized audit logs, or incident response controls.

## Runtime configuration

Set these variables in the research-service runtime (never commit credentials):

- `BGP_RESEARCH_API_TOKEN`: shared service token already required by protected routes.
- `ALERT_SENDER_EMAIL`: verified SES sender identity.
- `ALERT_ADMIN_EMAIL`: security alert recipient.
- `AWS_REGION`: SES region, defaults to `ap-south-1`.
- `ALERT_FAILURE_THRESHOLD`: optional integer threshold, defaults to `5`.

Use an AWS workload role or the deployment platform's secret/identity mechanism
rather than embedding AWS access keys. The role should have only
`ses:SendEmail` permission scoped to the verified sender identity. If the SES
account is in its sandbox, verify the recipient too or request production access.

Alerts intentionally include only the source IP, endpoint path, and failure
count. They do not include request bodies, prompts, authorization headers, or
tokens. Configure centralized metrics/log-based alerting for multi-replica
deployments because this process-local counter does not aggregate across workers.

## Verification

From `research-service/`, run:

```sh
python -m unittest discover -s tests -v
```

The tests mock email delivery and do not send live email.
