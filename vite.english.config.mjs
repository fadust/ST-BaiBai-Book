import upstream from './vite.config.ts';
import { englishLocalization } from './localization/transform.mjs';

export default args => {
  const config = upstream(args);
  config.plugins.unshift(englishLocalization());
  // The host import path must be stable when building outside SillyTavern's public directory.
  const resolver = config.plugins.find(plugin => plugin.name === 'sillytavern-resolver');
  const resolve = resolver.resolveId;
  resolver.resolveId = function (id, ...rest) {
    if (id.startsWith('@sillytavern/')) return { id: '../../../../../' + id.slice('@sillytavern/'.length) + '.js', external: true };
    return resolve.call(this, id, ...rest);
  };
  config.test.include = ['localization/**/*.test.ts', 'src/memory/conditionManualEdit.test.ts'];
  return config;
};
