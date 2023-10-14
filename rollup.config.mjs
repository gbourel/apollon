import terser from '@rollup/plugin-terser';

export default {
  input: 'src/js/apollon.js',
  output: {
    file: 'public/bundle.js',
    format: 'iife',
    plugins: [terser()]
  }
};
