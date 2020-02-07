module.exports = {
    entry: './lib/parser.js',
    output: {
        path: __dirname + '/dist',
        filename: 'parser.js',
        library: 'StepToJsonParser',
        libraryTarget: "umd"
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
    node: {
        fs: 'empty'
    }
};