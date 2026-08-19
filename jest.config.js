module.exports = {
  preset: '@react-native/jest-preset',
  testPathIgnorePatterns: ['/node_modules/', '/example/', '/lib/'],
  moduleNameMapper: {
    '^react-native-ambient-border-glow$': '<rootDir>/src/index',
  },
  transformIgnorePatterns: [
    `node_modules/(?!(${[
      '@react-native',
      'react-native',
      '@shopify/react-native-skia',
      'react-native-reanimated',
      'react-native-worklets',
    ].join('|')})/)`,
  ],
};
