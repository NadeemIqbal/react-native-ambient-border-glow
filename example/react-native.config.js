const path = require('path');
const pkg = require('../package.json');

module.exports = {
  project: {
    ios: {
      automaticPodsInstallation: true,
    },
  },
  dependencies: {
    // The example resolves the library through Metro/Babel rather than as an
    // npm dependency, so autolinking can't discover its Android module on its
    // own. Pointing at the package root is what registers it.
    [pkg.name]: {
      root: path.join(__dirname, '..'),
      platforms: {
        // The library has no iOS native code; an empty object keeps the
        // codegen script from failing on the missing platform.
        ios: {},
        android: {},
      },
    },
  },
};
