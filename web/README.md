# Organizel Web (Firebase Hosting)

This is a **static** website (no build step) used for:
- Landing page
- Privacy Policy
- Terms
- Support
- Account deletion instructions

It is deployed via **Firebase Hosting** from the repo root.

## Local preview

From repo root:

```bash
firebase emulators:start --only hosting
```

## Deploy

From repo root:

```bash
firebase deploy --only hosting
```


