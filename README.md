# Aeon Learning Center

Aeon Learning Center is a local Electron writing app with multi-document tabs, a multilingual Dictionary and Library, and document export.

## Local development

```sh
npm install
npm start
```

The editor, styles, dictionary modules, and reference data are in `renderer/` and are bundled into packaged apps.

## Linux build

```sh
npm run build:linux
```

## macOS build

On a Mac running macOS 12 or later, install dependencies and build the app:

```sh
npm ci
npm run build:mac
```

The `.zip` installers are written to `dist/`. On an Intel Mac, use the `x64`
build. Extract the archive and move `Aeon Learning Center.app` to Applications.
The GitHub **Code > Download ZIP** option contains source code, not an
installable app; download a packaged installer from a GitHub Release instead.
To create that release, publish the appropriate `dist/` installer as a release
asset.

Builds are not code-signed or notarized. On first launch, macOS may require
Control-clicking the app and choosing **Open**.

LibreOffice is required at runtime for OpenDocument Text (`.odt`) and legacy Word 97 (`.doc`) exports. Native Aeon documents use `.scrb`.
