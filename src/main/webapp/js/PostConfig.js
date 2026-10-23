/**
 * Copyright (c) 2006-2024, JGraph Holdings Ltd
 * Copyright (c) 2006-2024, draw.io AG
 */
// null'ing of global vars need to be after init.js
window.ICONSEARCH_PATH = null;
window.ICON_SERVICE_PATH = null;

// drawio-agentic: load the freehand pencil plugin directly, bypassing
// App.pluginRegistry entirely. That registry lives in js/diagramly/App.js,
// which a packaged build excludes (only the pre-built app.min.js ships) —
// our registry edit there has no effect once packaged. PostConfig.js, unlike
// App.js, ships in every build, and mxscript() is the same loader
// App.loadPlugins itself uses internally.
//
// PostConfig.js runs before Draw (the plugin-loading helper our plugin calls
// into) exists yet, so loading the script immediately throws "Draw is not
// defined" inside it. Poll until Draw is actually ready.
(function waitForDrawThenLoadFreehand()
{
	if (typeof Draw !== 'undefined' && typeof Draw.loadPlugin === 'function' && typeof mxscript === 'function')
	{
		mxscript('plugins/freehand.js');
	}
	else
	{
		window.setTimeout(waitForDrawThenLoadFreehand, 50);
	}
})();
