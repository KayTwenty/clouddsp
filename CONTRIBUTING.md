# Contributing

Thanks for helping. Bug reports, testing on real hardware and pull requests are
all welcome.

## Most useful right now

- **Testing on decks.** If you run cdj3k-mods on a CDJ-3000, tell us whether the
  exported stems load. Native formats for XZ Mods, AZ-MODS and MOLE are open
  questions; details of their stem formats help a lot.
- **GPU reports.** Separation times for your GPU and preset (the worker logs
  `separated Xs of audio in Ys`).

## Setting up

```bash
npm install
npm run dev      # website on http://localhost:3000
npm run worker   # GPU worker, in another terminal
```

No accounts or configuration are needed for development; see
[docs/architecture.md](docs/architecture.md) for how it fits together.

## Before opening a pull request

```bash
npm run lint
npx tsc --noEmit
npm run build
```

- Keep changes focused and match the style of the code around them.
- Site copy: no em dashes, and icons come from `lucide-react`.
- Database changes need a migration in `prisma/migrations` (`npx prisma migrate dev --name <change>`).
- Never commit `.env` files, keys or audio you don't have the rights to.

By contributing you agree that your contributions are licensed under the
project's [AGPL-3.0 license](LICENSE).
