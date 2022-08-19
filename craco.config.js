//const { whenDev, whenProd, ESLINT_MODES, POSTCSS_MODES } = require("@craco/craco");
const fs = require('fs');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const env = require('react-scripts/config/env')('/').raw;

const isWebBuild = env.REACT_APP_BUILD_MODE === 'WEB';
const analyzeBundles = process.env.ANALYZE_BUNDLES === "true";
const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP === 'true';
const shouldUseSourceMap_CSS = process.env.GENERATE_CSS_SOURCEMAP === 'true';

const appDirectory = fs.realpathSync(process.cwd());
const resolvePath = relativePath => path.resolve(appDirectory, relativePath);

const modulesWithoutHashName = ['background', 'content', 'jira_cs'];

module.exports = {
    style: shouldUseSourceMap && !shouldUseSourceMap_CSS && {
        css: { loaderOptions: styleLoaderOptions },
        sass: { loaderOptions: styleLoaderOptions },
        postcss: { loaderOptions: styleLoaderOptions }
    },
    webpack: {
        plugins: getPlugins(),
        configure: (wpConfig, { env, paths }) => {
            const isProd = wpConfig.mode === 'production';

            /*
             wpConfig.devServer= { writeToDisk: true };
            */

            // set entry point
            if (!isWebBuild) {
                wpConfig.entry = getEntryObject(paths);
            }

            // Set the output file name without content hash for some of the entries
            if (isProd) {
                const existingJSFileName = wpConfig.output.filename;
                wpConfig.output.filename = (pathData) => (
                    modulesWithoutHashName
                        .includes(pathData.chunk.name)
                        ? 'static/js/[name].js'
                        : existingJSFileName
                );

                const miniCss = wpConfig.plugins.filter(p => p instanceof MiniCssExtractPlugin)[0];
                const existingCSSFileName = miniCss.options.filename;
                miniCss.options.filename = (pathData) => (pathData.chunk.name === 'jira_cs'
                    ? 'static/css/[name].css'
                    : existingCSSFileName
                );

                if (shouldUseSourceMap && !shouldUseSourceMap_CSS) {
                    const filesList = ['.module.scss', '.module.sass', '.module.css'];
                    wpConfig.module.rules.forEach(rule => {
                        if (Array.isArray(rule.oneOf)) {
                            rule.oneOf.forEach(r => {
                                if (!(r.test instanceof RegExp) || !filesList.some(f => r.test.test(f))) {
                                    return;
                                }

                                if (Array.isArray(r.use)) {
                                    r.use.forEach(styleLoaderOptions);
                                }
                            });
                        }
                    });
                }
            }

            return wpConfig;
        }
    }
};

function getEntryObject(paths) {
    return {
        index: paths.appIndexJs,
        background: resolvePath('src/common/background.js'),
        menu: resolvePath('src/common/menu.js'),
        jira_cs: resolvePath('src/content-scripts/jira.js')
    };
}

function getPlugins() {
    const plugins = {
        remove: ['WebpackManifestPlugin']
    };

    const pluginsToAdd = [];

    if (!isWebBuild) {
        pluginsToAdd.push([
            getHTMLWebpackPlugin("menu.html", resolvePath('public/menu.html'), ['menu'], true),
            'prepend'
        ]);
    }

    if (analyzeBundles) {
        pluginsToAdd.push(new BundleAnalyzerPlugin({
            analyzerMode: "static",
            generateStatsFile: true,
            openAnalyzer: false
        }));
    }

    if (pluginsToAdd.length) {
        plugins.add = pluginsToAdd;
    }

    return plugins;
}

// Util functions

function getHTMLWebpackPlugin(filename, template, chunks, isEnvProduction) {
    return new HtmlWebpackPlugin(
        Object.assign(
            {},
            {
                inject: true,
                filename,
                template,
                chunks
            },
            isEnvProduction
                ? {
                    minify: {
                        removeComments: true,
                        collapseWhitespace: true,
                        removeRedundantAttributes: true,
                        useShortDoctype: true,
                        removeEmptyAttributes: true,
                        removeStyleLinkTypeAttributes: true,
                        keepClosingSlash: true,
                        minifyJS: true,
                        minifyCSS: true,
                        minifyURLs: true,
                    },
                }
                : undefined
        )
    );
}

function styleLoaderOptions(opt) {
    if (shouldUseSourceMap_CSS) {
        return opt;
    }

    if (opt.sourceMap) {
        opt.sourceMap = shouldUseSourceMap_CSS;
    } else if (opt.options?.sourceMap) {
        opt.options.sourceMap = shouldUseSourceMap_CSS;
    }

    return opt;
}