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

*Warning* : with Create React App, we realised the library was not updating correctly if you try to install the library multiple times.
To fix this, run this command from the app **after** running "npm install"
- rm -Rf node_modules/.cache

#### For integrators

If you want to deploy a new version of powsybl-diagram-viewer in the [NPM package registry](https://www.npmjs.com/package/@powsybl/powsybl-diagram-viewer),
you need to follow the steps below:

-   Update to the new version in [package.json](https://github.com/powsybl/powsybl-diagram-viewer/blob/main/package.json) (example `0.6.0`)
-   Update the package-lock.json: `npm install`
-   Commit the package.json and package-lock.json files, push to a branch, make a PR, have it reviewed and merged to main.
-   Pull and checkout main on your last commit.
-   [Tag your last commit](https://semver.org/) : `git tag <tag>` (example: `git tag v0.6.0`)
-   Push tag : `git push origin <tag>`  
---
-   (Optional) Checkout the tag in a fresh repo copy : `cd $(mktemp -d) && git clone https://github.com/powsybl/powsybl-diagram-viewer.git` then `cd powsybl-diagram-viewer && git checkout <tag>`
-   (Optional) [Test your package](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages#testing-your-package): `npm install`  
---
-   Build the package - npm will publish the README.md, the package.json and the dist directory you just generate : `npm run build`
-   [Login on the command line to the npm registry](https://docs.npmjs.com/logging-in-to-an-npm-enterprise-registry-from-the-command-line): `npm login`
-   [Publish the package](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages#publishing-scoped-public-packages): `npm publish`

