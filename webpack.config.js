const webpack = require("webpack");
const HtmlWebPackPlugin = require("html-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const safePostCssParser = require("postcss-safe-parser");
const ManifestPlugin = require("webpack-manifest-plugin");
const CaseSensitivePathsPlugin = require("case-sensitive-paths-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const merge = require("webpack-merge");
const preprocess = require("svelte-preprocess");
const ScriptExtHtmlWebpackPlugin = require("script-ext-html-webpack-plugin");

const path = require("path");
const DEV_PORT = 7000;

const mode = process.env.NODE_ENV || "development";
const dev = mode === "development";
const shouldUseSourceMap = dev;
const ci = process.env.CI === "true";
const publicPath = "/";

const postCssLoaderConfig = {
	loader: "postcss-loader",
	options: {
		ident: "postcss",
		plugins: () => [
			require("postcss-flexbugs-fixes"),
			require("postcss-preset-env")({ browsers: "last 6 versions" }),
			require("cssnano")()
		],
		sourceMap: shouldUseSourceMap
	}
};

const htmlPluginConfig = conf =>
	merge(
		conf,
		!dev
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
						minifyURLs: true
					}
			  }
			: {}
	);

module.exports = {
	bail: !dev,
	context: path.resolve(__dirname, "./src"),
	devtool: dev ? "cheap-module-eval-source-map" : "source-map",
	entry: {
		bundle: ["whatwg-fetch", "./index.js"]
	},
	resolve: {
		alias: {
			svelte: path.resolve("node_modules", "svelte")
		},
		extensions: [".wasm", ".mjs", ".js", ".html", ".json", ".svelte"],
		mainFields: ["svelte", "browser", "module", "main"]
	},
	output: {
		path: __dirname + "/dist",
		filename: "[name].[hash:5].js",
		chunkFilename: "[name].[hash:5].js",
		publicPath
	},
	module: {
		rules: [
			// transpile js svelte helpers
			{
				test: /\.m?js$/,
				include: [/svelte/],
				use: ["babel-loader"]
			},
			{
				test: /\.svelte$/,
				use: [
					{
						loader: "svelte-loader",
						options: {
							emitCss: true,
							hotReload: dev,
							preprocess: preprocess({
								scss: true,
								postcss: postCssLoaderConfig.options
							})
						}
					}
				]
			},
			{
				test: /\.css$/,
				use: [
					/**
					 * MiniCssExtractPlugin doesn't support HMR.
					 * For developing, use 'style-loader' instead.
					 * */
					dev ? "style-loader" : MiniCssExtractPlugin.loader,
					"css-loader?url=false"
				]
			},
			{
				test: /\.scss$/,
				use: [
					dev ? "style-loader" : MiniCssExtractPlugin.loader,
					{
						loader: "string-replace-loader",
						options: {
							search: "url\\(/", // these regular expressions should work for the example paths in the question
							replace: `url(${publicPath}`,
							flags: "g"
						}
					},
					"css-loader",
					postCssLoaderConfig,
					"sass-loader"
				]
			},
			{
				loader: require.resolve("file-loader"),
				// Exclude `js` files to keep "css" loader working as it injects
				// its runtime that would otherwise be processed through "file" loader.
				// Also exclude `html` and `json` extensions so they get processed
				// by webpacks internal loaders.
				exclude: [
					/\.(js|mjs|jsx|svelte)$/,
					/\.html$/,
					/\.json$/,
					/\.(scss|css)$/
				],
				options: {
					name: "[name].[hash:5].[ext]"
				}
			}
		]
	},
	mode,
	plugins: [
		!dev &&
			new CleanWebpackPlugin({
				verbose: true
			}),
		new HtmlWebPackPlugin(
			htmlPluginConfig({
				template: "./index.html",
				filename: "index.html",
				hash: true,
				removeComments: true,
				collapseWhitespace: true
			})
		),
		new ScriptExtHtmlWebpackPlugin({
			defaultAttribute: "async",
			sync: ["runtime", "polyfills", "vendors"],
			preload: ["runtime", "polyfills", "vendors"]
		}),
		// new InterpolateHtmlPlugin(HtmlWebPackPlugin, {
		// 	NODE_ENV: mode
		// }),
		// new ModuleNotFoundPlugin("./src"),
		new webpack.DefinePlugin({
			"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
			PUBLIC_URL: JSON.stringify(publicPath)
		}),
		// dev && new webpack.HotModuleReplacementPlugin(),
		dev && new CaseSensitivePathsPlugin(),
		// !dev && new WatchMissingNodeModulesPlugin("./node_modules"),
		!dev &&
			new MiniCssExtractPlugin({
				// Options similar to the same options in webpackOptions.output
				// both options are optional
				filename: "[name].[contenthash:5].css",
				chunkFilename: "[name].[contenthash:5].chunk.css"
			}),
		new ManifestPlugin({
			fileName: "asset-manifest.json",
			publicPath
		}),
		new CopyPlugin([
			{
				from: path.resolve(__dirname, "public"),
				to: path.resolve(__dirname, "dist")
			}
		])
		// new DashboardPlugin({port: DEV_PORT})
	].filter(Boolean),
	optimization: {
		minimize: !dev,
		minimizer: [
			// This is only used in non development mode
			new TerserPlugin({
				terserOptions: {
					parse: {
						// we want terser to parse ecma 8 code. However, we don't want it
						// to apply any minfication steps that turns valid ecma 5 code
						// into invalid ecma 5 code. This is why the 'compress' and 'output'
						// sections only apply transformations that are ecma 5 safe
						// https://github.com/facebook/create-react-app/pull/4234
						ecma: 8
					},
					compress: {
						ecma: 5,
						warnings: false,
						// Disabled because of an issue with Uglify breaking seemingly valid code:
						// https://github.com/facebook/create-react-app/issues/2376
						// Pending further investigation:
						// https://github.com/mishoo/UglifyJS2/issues/2011
						comparisons: false,
						// Disabled because of an issue with Terser breaking valid code:
						// https://github.com/facebook/create-react-app/issues/5250
						// Pending futher investigation:
						// https://github.com/terser-js/terser/issues/120
						inline: 2
					},
					mangle: {
						safari10: true
					},
					output: {
						ecma: 5,
						comments: false,
						// Turned on because emoji and regex is not minified properly using default
						// https://github.com/facebook/create-react-app/issues/2488
						ascii_only: true
					}
				},
				// Use multi-process parallel running to improve the build speed
				// Default number of concurrent runs: os.cpus().length - 1
				parallel: true,
				// Enable file caching
				cache: true,
				sourceMap: shouldUseSourceMap
			}),
			// This is only used in non developement mode
			new OptimizeCSSAssetsPlugin({
				cssProcessorOptions: {
					parser: safePostCssParser,
					map: shouldUseSourceMap
						? {
								// `inline: false` forces the sourcemap to be output into a
								// separate file
								inline: false,
								// `annotation: true` appends the sourceMappingURL to the end of
								// the css file, helping the browser find the sourcemap
								annotation: true
						  }
						: false
				}
			})
		],
		// Automatically split vendor and commons
		// https://twitter.com/wSokra/status/969633336732905474
		// https://medium.com/webpack/webpack-4-code-splitting-chunk-graph-and-the-splitchunks-optimization-be739a861366
		splitChunks: !dev
			? {
					chunks: "all",
					minSize: 0,
					minChunks: 1,
					automaticNameDelimiter: "_",
					cacheGroups: {
						vendors: {
							test: /[\\/]node_modules[\\/]/,
							name: "vendors",
							priority: -10,
							reuseExistingChunk: true
						},
						// Chunk that contains used polyfills
						polyfills: {
							test: /core-js/,
							name: "polyfills",
							priority: 10,
							reuseExistingChunk: true
						}
					}
			  }
			: {},
		// Keep the runtime chunk separated to enable long term caching
		// https://twitter.com/wSokra/status/969679223278505985
		runtimeChunk: !dev
			? {
					name: "runtime"
			  }
			: false
	},
	devServer: {
		hot: false,
		historyApiFallback: true,
		port: DEV_PORT,
		contentBase: "./dist",
		publicPath,
		open: false
	}
};
