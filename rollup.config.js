const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const babel = require('@rollup/plugin-babel');

const dist = 'dist'

module.exports = {
    input: 'src/parser.js',
    output: [
        {
            file: `${dist}/parser.cjs.js`,
            format: 'cjs'
        },
        {
            file: `${dist}/parser.esm.js`,
            format: 'esm'
        },
        {
            file: `${dist}/parser.umd.js`,
            format: 'umd',
            name: 'StepToJsonParser'
        }
    ],
    plugins: [
        nodeResolve(),
        commonjs(), // Converts CommonJS modules to ES6
        babel({ babelHelpers: 'bundled' }), // Transpile with Babel
        //terser() // Minify the bundle (optional)
    ]
}
