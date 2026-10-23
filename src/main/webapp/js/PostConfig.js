/**
 * Copyright (c) 2006-2024, JGraph Holdings Ltd
 * Copyright (c) 2006-2024, draw.io AG
 */
// null'ing of global vars need to be after init.js
window.ICONSEARCH_PATH = null;
window.ICON_SERVICE_PATH = null;

// bphamio: load our plugins directly, bypassing App.pluginRegistry entirely.
// That registry lives in js/diagramly/App.js, which a packaged build excludes
// (only the pre-built app.min.js ships) — an edit there has no effect once
// packaged. PostConfig.js, unlike App.js, ships in every build, and
// mxscript() is the same loader App.loadPlugins itself uses internally.
//
// PostConfig.js runs before Draw (the plugin-loading helper these plugins
// call into) exists yet, so loading them immediately throws "Draw is not
// defined" inside each. Poll until Draw is actually ready.
//
// noWrite is required: with dev=1, mxscript() otherwise falls back to
// document.write, which — called from this setTimeout after the page has
// loaded — replaces the entire document and leaves a blank window.
(function waitForDrawThenLoadPlugins()
{
	if (typeof Draw !== 'undefined' && typeof Draw.loadPlugin === 'function' && typeof mxscript === 'function')
	{
		mxscript('plugins/freehand.js', null, null, null, true);
		mxscript('plugins/mcp-setup.js', null, null, null, true);
	}
	else
	{
		window.setTimeout(waitForDrawThenLoadPlugins, 50);
	}
})();
