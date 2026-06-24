# Contributing

Thanks for contributing.

## Before You Start

- Use Node.js `>=20.19.4`
- Use Yarn `1.x`
- Install Xcode and CocoaPods for iOS work
- Install Android Studio / Android SDK for Android work

## Local Development

Install dependencies:

```bash
yarn install
```

Generate native projects:

```bash
yarn Step2_prebuild
```

Install iOS pods:

```bash
yarn Step3_podinstall
```

Run the app:

```bash
yarn ios
```

```bash
yarn android
```

## Important Open Source Constraints

- Do not add private runtime files, credentials, or signing assets to the public repository.
- Do not commit credentials, keys, signing assets, internal endpoint values, or private protocol documentation.
- If a change depends on private runtime files, keep the public path usable and document the limitation.
- Features backed by private services should be clearly marked as unavailable by default in public documentation.

## Workflow

1. Fork the repository.
2. Create a focused branch.
3. Make your changes with minimal scope.
4. Run the relevant checks locally.
5. Open a pull request with a clear summary, rationale, and testing notes.

## Coding Expectations

- Follow the existing project structure and naming style.
- Prefer small, reviewable changes.
- Keep public docs aligned with behavior changes.
- Use clear commit messages. Conventional Commits are preferred.

## Pull Requests

Please include:

- what changed
- why it changed
- how it was tested
- whether any private runtime behavior was intentionally left unchanged

## Issues

When filing an issue, include:

- reproduction steps
- expected behavior
- actual behavior
- logs or screenshots when relevant

## Security

Do not disclose private credentials or sensitive integration details in issues or pull requests.

If you find a sensitive-data exposure problem in the repository, report it privately to the maintainers first.
