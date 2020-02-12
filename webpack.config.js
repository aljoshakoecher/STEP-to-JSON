const path = require("path");

module.exports = {
    entry: './src/parser.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'parser.js',
        library: 'StepToJsonParser',
        libraryTarget: 'umd',
        globalObject: 'this',
    },
    module: {
        rules: [{
            test: /\.(js)$/,
            exclude: /node_modules/,
            use: ['babel-loader']
        }]
    },
    resolve: {
        extensions: ['*', '.js']
    },
};