# Security

Please don't report security problems in public issues. Use GitHub's
**private vulnerability reporting** instead: on the repository, open the
**Security** tab and choose **Report a vulnerability**.

Useful to include: what's affected (website, API, worker), how to reproduce it,
and what an attacker could do. You'll get a reply as soon as possible.

Things worth knowing when self-hosting:

- Set a long random `WORKER_TOKEN`; anyone with it can claim jobs and read the
  uploaded audio. Production refuses workers until one is set.
- Storage links are signed and expire within an hour, but anyone holding a
  link can use it until then.
- Keep object storage buckets private; cloudDSP never needs public access.
