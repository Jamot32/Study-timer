# Study Timer

A focused study timer app, built with React Native and Expo (iOS + Android, plus a web build).

## Stack

- Expo SDK 57 (React Native 0.86, React 19)
- TypeScript

## Getting started

```sh
npm install
npm run ios       # build and start the custom development client on iOS
npm run android   # build and start the custom development client on Android
npm start         # start Metro for an installed development client
```

This app uses native modules and cannot run in Expo Go. After native dependencies
change, rebuild the development client with `npm run ios` or `npm run android`.

## Web

```sh
npm run web                        # dev server at http://localhost:8081
npx expo export --platform web     # static site in dist/
```

The web build is deployed to Vercel from `main` (`vercel.json`). Setup, required
environment variables, the Google Cloud origin step and what differs on web are in
[DOCs/web-deploy.md](DOCs/web-deploy.md).
