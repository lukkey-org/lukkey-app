# Lukkey App

React Native / Expo mobile app for pairing with a secure external device over BLE and presenting device-driven UI flows.

## Status

This is the official open source repository for Lukkey App.

The public repo contains the application shell, UI, navigation, BLE orchestration, and local state handling. Sensitive runtime values and internal integration details are intentionally kept outside the public repository.

## What This Repository Includes

- Expo / React Native application code
- BLE connection, monitoring, and UI flow handling
- App screens, modals, assets, and localization files
- Native project scaffolding for iOS and Android
- Patch files required by current dependencies

## What Is Not Included

The following private capabilities are not shipped in the public repository by default:

- Production service credentials
- Internal API endpoint values
- Internal device authentication material
- Internal protocol documentation and integration playbooks
- Private build and signing materials

Some features depend on runtime environment variables or your own backend integrations. Without those values, related flows are unavailable by design.

## Features

- BLE device discovery and connection
- Device status and verification UI
- Address display and confirmation flows
- Asset and activity screens
- Firmware-update UI and transfer orchestration
- Multi-language UI resources

## Tech Stack

- React Native 0.81
- Expo 54
- React 19
- React Navigation
- `react-native-ble-plx`
- Expo Secure Store
- i18next

## Repository Layout

- `components/`: app UI and flow logic
- `config/`: public app config, translations, asset metadata
- `env/`: public wrappers around runtime configuration
- `utils/`: app helpers and runtime orchestration
- `assets/`: images, animations, icons, splash assets
- `android/`: Android native project
- `ios/`: iOS native project
- `patches/`: dependency patches used after install

## Local Setup

### Prerequisites

- Node.js `>=20.19.4`
- Yarn `1.x`
- Xcode 16.4+ for iOS work
- CocoaPods for iOS dependency installation
- Android Studio / Android SDK for Android work

### Install

```bash
yarn install
```

Copy `.env.example` to `.env.local` and fill in any runtime values you need for local development.

### Generate Native Projects

```bash
yarn Step2_prebuild
```

### Install iOS Pods

```bash
yarn Step3_podinstall
```

### Run

```bash
yarn ios
```

```bash
yarn android
```

### Development Server

```bash
yarn dev
```

## EAS Environments

This project expects EAS environments to be configured per build profile:

- `development` profile -> EAS `development` environment
- `adhoc` and `apk` profiles -> EAS `preview` environment
- `production` profile -> EAS `production` environment

Production builds now fail fast if these variables are missing:

- `EXPO_PUBLIC_GATEWAY_ORIGIN`
- `EXPO_PUBLIC_MARKET_ORIGIN`
- `EXPO_PUBLIC_PUSH_ORIGIN`
- `EXPO_PUBLIC_SITE_ORIGIN`
- `EXPO_PUBLIC_FILE_ORIGIN`

Set them with EAS environment variables before running `eas build --profile production`.

## Runtime Configuration

This app expects runtime environment variables or replacement backends for full functionality.

Important: values prefixed with `EXPO_PUBLIC_` are embedded into the client bundle at build time and are visible to anyone with the shipped app. Use them only for client-side configuration or other app-bundled integration values.

Do not place server-only secrets, private signing material, or confidential backend credentials in any `EXPO_PUBLIC_*` variable. If an integration requires a true secret, keep it on your backend and proxy the request there.

Without those values, features that rely on private services or device-auth material will not work, including some of:

- production API requests
- production firmware metadata lookups
- device-auth verification flows
- internal gateway integrations

Some legacy variable names in this project still include words such as `SECRET` or `TOKEN`. In the public app context, those values should be treated as client-visible integration parameters, not confidential server secrets.

If you are preparing an internal development environment, provide the required `.env.local` values locally and do not commit them.

## Open Source Notes

- Real service URLs and secrets should stay outside the public repository.
- Public documentation intentionally omits internal protocol details.
- If you fork this repository, expect to replace private integrations with your own services or mocks.

## Contributing

See `CONTRIBUTING.md`.

## License

This repository is released under the MIT License. See `LICENSE`.
