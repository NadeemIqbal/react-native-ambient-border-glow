const path = require('path');
const { getConfig } = require('react-native-builder-bob/babel-config');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');

module.exports = getConfig(
  {
    presets: ['module:@react-native/babel-preset'],
    // Reanimated 4 ships its worklets transform separately, and it MUST be the
    // last plugin in the list — anything appended after it breaks worklet
    // capture at runtime with no build-time error.
    plugins: ['react-native-worklets/plugin'],
  },
  { root, pkg }
);
