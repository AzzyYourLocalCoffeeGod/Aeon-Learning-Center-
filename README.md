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

LibreOffice is required at runtime for OpenDocument Text (`.odt`) and legacy Word 97 (`.doc`) exports. Native Aeon documents use `.scrb`.
