# powsybl-diagram-viewer

Typescript library to integrate a powsybl svg diagram in a javascript project. The library is built with the Vite bundler.
Node from v18+ is required to build with Vite.

Installation using npm:  
'npm install @powsybl/diagram-viewer'

#### For developers

For development purpose, to install this library locally from an app, you should run these commands in the library project :
- npm install
- npm run build
- npm pack

Then in the app project :
- npm install {PATH_TO_LIBRARY}/powsybl-diagram-viewer-{LIBRARY_VERSION}.tgz

_Warning_ : with Create React App, we realised the library was not updating correctly if you try to install the library multiple times.
To fix this, run this command from the app **after** running "npm install"
- rm -Rf node_modules/.cache

#### For integrators

If you want to deploy a new version of powsybl-diagram-viewer in the [NPM package registry](https://www.npmjs.com/package/@powsybl/powsybl-diagram-viewer),
you need to follow the steps below:

- [Make a release action](https://github.com/powsybl/powsybl-diagram-viewer/actions/workflows/release.yml)
- In the 'run workflow' combobox select, let the branch on main
- Enter the type of evolution (major | minor | patch)
- Click 'run workflow'

Notes :
* Check [license-checker-config.json](license-checker-config.json) for license white list and exclusion.
  If you need to update this list, please inform organization's owners.
* We need to exclude some packages for now :
    * `@mapbox/jsonlint-lines-primitives@2.0.2` is a special license
    * `cartocolor@4.0.2` is Creative Commons but not correctly described in the package
    * `rw@0.1.4` is BSD-3-Clause but not correctly described in the package
