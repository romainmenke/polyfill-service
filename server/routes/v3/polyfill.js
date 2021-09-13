"use strict";

const mergeStream = require("merge2");
const { Readable } = require("stream");
const createCompressor = require("../../lib/create-compressor");
const getPolyfillParameters = require("../../lib/get-polyfill-parameters");
const latestVersion = require("polyfill-library/package.json").version;
const polyfillio = require("polyfill-library");
const pipeline = require("util").promisify(require("stream").pipeline);

const lastModified = new Date().toUTCString();
async function respondWithBundle(response, parameters, bundle, next) {
	const compressor = await createCompressor(parameters.compression);
	const headers = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
		"Cache-Control": "public, s-maxage=31536000, max-age=604800, stale-while-revalidate=604800, stale-if-error=604800",
		"Content-Type": "text/javascript; charset=utf-8",
		"surrogate-key": "polyfill-service",
		"Last-Modified": lastModified
	};
	if (parameters.compression) {
		headers["Content-Encoding"] = parameters.compression;
	}
	response.status(200);
	response.set(headers);

	try {
		await pipeline(bundle, compressor, response);
	} catch (error) {
		if (error && error.code !== "ERR_STREAM_PREMATURE_CLOSE") {
			next(error);
		}
	}
}


async function respondWithMissingFeatures(response, missingFeatures) {
	response.status(400);
	response.set({
		"Cache-Control": "public, s-maxage=31536000, max-age=604800, stale-while-revalidate=604800, stale-if-error=604800",
		"surrogate-key": "polyfill-service"
	});
	response.send(`Requested features do not all exist in polyfill-service, please remove them from the URL: ${missingFeatures.join(",")} do not exist.`);
}

// provide option for consumers to run their service on another context path
const contextPath = process.env.CONTEXT_PATH || "";

// Map the version parameter to a version of the polyfill library.
const versionToLibraryMap = new Map();
versionToLibraryMap.set(latestVersion, polyfillio);
versionToLibraryMap.set('3.25.1', 'polyfill-library-3.25.1');
versionToLibraryMap.set('3.25.2', 'polyfill-library-3.25.3'); // '3.25.2' maps to polyfillio_3_25_3
versionToLibraryMap.set('3.25.3', 'polyfill-library-3.25.3');
versionToLibraryMap.set('3.27.4', 'polyfill-library-3.27.4');
versionToLibraryMap.set('3.28.1', 'polyfill-library-3.28.1');
versionToLibraryMap.set('3.34.0', 'polyfill-library-3.34.0');
versionToLibraryMap.set('3.35.0', 'polyfill-library-3.35.0');
versionToLibraryMap.set('3.36.0', 'polyfill-library-3.36.0');
versionToLibraryMap.set('3.37.0', 'polyfill-library-3.37.0');
versionToLibraryMap.set('3.38.0', 'polyfill-library-3.38.0');
versionToLibraryMap.set('3.39.0', 'polyfill-library-3.39.0');
versionToLibraryMap.set('3.40.0', 'polyfill-library-3.40.0');
versionToLibraryMap.set('3.41.0', 'polyfill-library-3.41.0');
versionToLibraryMap.set('3.42.0', 'polyfill-library-3.42.0');
versionToLibraryMap.set('3.43.0', 'polyfill-library-3.43.0');
versionToLibraryMap.set('3.44.0', 'polyfill-library-3.44.0');
versionToLibraryMap.set('3.45.0', 'polyfill-library-3.45.0');
versionToLibraryMap.set('3.46.0', 'polyfill-library-3.46.0');
versionToLibraryMap.set('3.48.0', 'polyfill-library-3.48.0');
versionToLibraryMap.set('3.49.0', 'polyfill-library-3.49.0');
versionToLibraryMap.set('3.50.2', 'polyfill-library-3.50.2');
versionToLibraryMap.set('3.51.0', 'polyfill-library-3.51.0');
versionToLibraryMap.set('3.52.0', 'polyfill-library-3.52.0');
versionToLibraryMap.set('3.52.1', 'polyfill-library-3.52.1');
versionToLibraryMap.set('3.52.2', 'polyfill-library-3.52.2');
versionToLibraryMap.set('3.52.3', 'polyfill-library-3.52.3');
versionToLibraryMap.set('3.53.1', 'polyfill-library-3.53.1');
versionToLibraryMap.set('3.89.4', 'polyfill-library-3.89.4');
versionToLibraryMap.set('3.96.0', 'polyfill-library-3.96.0');
versionToLibraryMap.set('3.98.0', 'polyfill-library-3.98.0');
versionToLibraryMap.set('3.100.0', 'polyfill-library-3.100.0');
versionToLibraryMap.set('3.101.0', 'polyfill-library-3.101.0');
versionToLibraryMap.set('3.103.0', 'polyfill-library-3.103.0');

module.exports = app => {
	app.get([`${contextPath}/v3/polyfill.js`, `${contextPath}/v3/polyfill.min.js`], async (request, response, next) => {
		const parameters = getPolyfillParameters(request);

		// Get the polyfill library for the requested version.
		const polyfillLibrary = versionToLibraryMap.get(parameters.version);

		// 404 if no library for the requested version was found.
		if (!polyfillLibrary) {
			response.status(400);
			response.set({
				"Cache-Control": "public, s-maxage=31536000, max-age=604800, stale-while-revalidate=604800, stale-if-error=604800",
				"surrogate-key": "polyfill-service"
			});
			response.send(`requested version does not exist`);
			return;
		}

		// 400 if requested polyfills are missing
		if (polyfillLibrary && parameters.strict) {
			const features = new Set([...await polyfillio.listAliases(), ...await polyfillio.listAllPolyfills()]);
			const requestedFeaturesAllExist = parameters.features.every(feature => features.has(feature));
			if (!requestedFeaturesAllExist) {
				const requestedFeaturesWhichDoNotExist = parameters.features.filter(feature => !features.has(feature));
				await respondWithMissingFeatures(response, requestedFeaturesWhichDoNotExist);
				return;
			}
		}

		let polyfillBundler = require(polyfillLibrary);

		// Return a polyfill bundle
		switch (parameters.version) {
			case "3.25.3":
			case "3.25.2": {
				const bundle = mergeStream(await polyfillBundler.getPolyfillString(parameters));

				if (parameters.callback) {
					bundle.add(Readable.from("\ntypeof " + parameters.callback + "==='function' && " + parameters.callback + "();"));
				}

				await respondWithBundle(response, parameters, bundle, next);
				break;
			}
			case "3.25.1": {
				const bundle = mergeStream(await polyfillBundler.getPolyfillString(parameters));

				if (parameters.callback) {
					bundle.add(Readable.from("\ntypeof " + parameters.callback + "==='function' && " + parameters.callback + "();"));
				}

				await respondWithBundle(response, parameters, bundle, next);
				break;
			}
			default: {
				const bundle = await polyfillBundler.getPolyfillString(parameters);
				await respondWithBundle(response, parameters, bundle, next);
				return;
			}
		}
	});
};
