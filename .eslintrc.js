module.exports = {
	extends: ["prettier", "plugin:import/errors", "plugin:import/warnings"],
	env: {
		browser: true,
		es6: true,
		node: true
	},
	plugins: ["import", "json", "markdown"],
	overrides: [
		{
			files: ["**/*.svelte"],
			processor: "svelte3/svelte3",
			plugins: ["svelte3"]
		}
	],
	settings: {
		"import/resolver": {
			node: {
				extensions: [".js"]
			}
		},
		"svelte3/ignore-styles": attributes =>
			attributes.lang && attributes.lang.includes("scss")
	}
};
