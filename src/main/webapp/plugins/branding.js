/**
 * bphamio branding.
 *
 * draw.io's name and logo are trademarks (see drawio/README.md, "Trademark"),
 * so a fork must not show them as its own. The packaged app runs the
 * pre-built app.min.js, so the user-visible name and logo are replaced here
 * at runtime instead of in the editor sources. Copyright and license notices
 * are left untouched.
 */
Draw.loadPlugin(function(ui)
{
	var NAME = 'bphamio';
	var GLYPH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="180 180 664 664">' +
		'<path d="M330 640 C 360 470, 470 520, 520 440 S 590 360, 600 330" fill="none" stroke="#fff" stroke-width="44" stroke-linecap="round"/>' +
		'<circle cx="320" cy="660" r="96" fill="#fff"/>' +
		'<rect x="540" y="230" width="230" height="170" rx="40" fill="#fff"/>' +
		'<path d="M700 560 C 712 640, 728 656, 808 668 C 728 680, 712 696, 700 776 C 688 696, 672 680, 592 668 C 672 656, 688 640, 700 560 Z" fill="#FDE68A"/></svg>';

	Editor.logoImage = 'data:image/svg+xml,' + encodeURIComponent(GLYPH);
	Editor.prototype.appName = NAME;
	ui.editor.appName = NAME;

	// Standalone "draw.io" only: leaves domains and URLs (get.draw.io,
	// www.drawio.com/...) alone, since those are links, not branding
	var re = /(^|[^\w.\/-])draw\.io(?![\w\/-])/g;

	for (var key in mxResources.resources)
	{
		var value = mxResources.resources[key];

		if (typeof value === 'string' && value.indexOf('draw.io') >= 0)
		{
			mxResources.resources[key] = value.replace(re, '$1' + NAME);
		}
	}

	// The header icon is created before plugins load and App.updateHeader
	// restores its original logo on mouseout, so it's overridden in CSS
	var style = document.createElement('style');
	style.textContent = '.geAppIcon { background-image: url("' + Editor.logoImage + '") !important; ' +
		'background-color: #5B3FE0 !important; background-size: 80% !important; }';
	document.head.appendChild(style);

	ui.updateDocumentTitle();
});
