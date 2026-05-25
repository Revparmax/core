"use strict";
// Function form prevents lint-staged from passing filenames as shell args,
// which would break biome on route files with '$' in the name.
module.exports = {
  "*.{js,jsx,ts,tsx,json,jsonc,css,scss,md,mdx}": () => "bun x ultracite fix",
};
