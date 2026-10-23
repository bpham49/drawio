/**
 * MCP setup panel for bphamio.
 *
 * Shows whether the local agent server is running and what's currently
 * "active" (the file Claude will act on by default), plus ready-to-paste
 * connection snippets for Claude Code and Claude Desktop.
 *
 * Status comes from the main process (electron.js's 'mcpStatus' rendererReq
 * action -> drawio-agentic.js's getMcpStatus()), not a direct fetch from
 * here: the renderer's own CSP (connect-src 'self') blocks a request to
 * 127.0.0.1 from this context, even though the server is local.
 */
Draw.loadPlugin(function(ui)
{
	function requestStatus(callback)
	{
		window.electron.request({ action: 'mcpStatus' }, callback, function()
		{
			callback({ running: false, port: null, url: null, activeFile: null });
		});
	}

	function copyToClipboard(text)
	{
		window.electron.request({ action: 'clipboardAction', method: 'writeText', data: text }, function() {}, function() {});
	}

	function readonlyField(value)
	{
		var input = document.createElement('input');
		input.type = 'text';
		input.value = value;
		input.readOnly = true;
		input.style.width = '100%';
		input.style.boxSizing = 'border-box';
		input.style.fontFamily = 'monospace';
		input.style.fontSize = '12px';
		input.style.padding = '4px';
		input.addEventListener('focus', function() { input.select(); });
		return input;
	}

	function copyButton(getText)
	{
		var btn = mxUtils.button('Copy', function()
		{
			copyToClipboard(getText());
			btn.innerText = 'Copied';
			window.setTimeout(function() { btn.innerText = 'Copy'; }, 1200);
		});
		btn.className = 'geBtn';
		btn.style.marginLeft = '8px';
		btn.style.flexShrink = '0';
		return btn;
	}

	function row(labelText, field, btn)
	{
		var wrapper = document.createElement('div');
		wrapper.style.marginBottom = '12px';

		var label = document.createElement('div');
		label.innerText = labelText;
		label.style.fontSize = '11px';
		label.style.color = 'gray';
		label.style.marginBottom = '2px';
		wrapper.appendChild(label);

		var line = document.createElement('div');
		line.style.display = 'flex';
		line.style.alignItems = 'center';
		line.appendChild(field);
		if (btn != null) line.appendChild(btn);
		wrapper.appendChild(line);

		return wrapper;
	}

	function showMcpSetupDialog()
	{
		var container = document.createElement('div');
		container.style.padding = '4px 2px';

		var statusLine = document.createElement('div');
		statusLine.innerText = 'Checking…';
		statusLine.style.marginBottom = '16px';
		statusLine.style.fontWeight = 'bold';
		container.appendChild(statusLine);

		var fieldsContainer = document.createElement('div');
		container.appendChild(fieldsContainer);

		ui.showDialog(container, 460, 320, true, true);

		requestStatus(function(status)
		{
			fieldsContainer.innerHTML = '';

			if (status.running)
			{
				statusLine.innerText = '● Running on port ' + status.port;
				statusLine.style.color = '#2a7a2a';

				var activeLine = document.createElement('div');
				activeLine.style.marginBottom = '16px';
				activeLine.style.fontSize = '12px';
				activeLine.innerText = status.activeFile
					? 'Active file: ' + status.activeFile
					: 'No active file yet — open or save a .drawio file so Claude knows what to act on.';
				fieldsContainer.appendChild(activeLine);

				var urlField = readonlyField(status.url);
				fieldsContainer.appendChild(row('Server URL', urlField, copyButton(function() { return status.url; })));

				var desktopConfig = JSON.stringify({ 'bphamio': { type: 'http', url: status.url } }, null, 2);
				var desktopField = document.createElement('textarea');
				desktopField.readOnly = true;
				desktopField.value = desktopConfig;
				desktopField.style.width = '100%';
				desktopField.style.height = '70px';
				desktopField.style.boxSizing = 'border-box';
				desktopField.style.fontFamily = 'monospace';
				desktopField.style.fontSize = '11px';
				desktopField.style.padding = '4px';
				desktopField.addEventListener('focus', function() { desktopField.select(); });
				fieldsContainer.appendChild(row('Claude Desktop config (paste into claude_desktop_config.json → mcpServers)',
					desktopField, copyButton(function() { return desktopConfig; })));

				var cliCommand = 'claude mcp add --transport http bphamio ' + status.url + ' -s user';
				var cliField = readonlyField(cliCommand);
				fieldsContainer.appendChild(row('Claude Code CLI', cliField, copyButton(function() { return cliCommand; })));
			}
			else
			{
				statusLine.innerText = '● Not running';
				statusLine.style.color = '#a33';

				var hint = document.createElement('div');
				hint.style.fontSize = '12px';
				hint.innerText = 'The MCP server is built into bphamio and starts with it. If it isn’t running, ' +
					'another program is probably using port 37651 — close it and relaunch bphamio.';
				fieldsContainer.appendChild(hint);
			}

			var refreshBtn = mxUtils.button('Refresh', function() { ui.hideDialog(); showMcpSetupDialog(); });
			refreshBtn.className = 'geBtn';
			refreshBtn.style.marginTop = '8px';
			fieldsContainer.appendChild(refreshBtn);
		});
	}

	mxResources.parse('mcpSetup=MCP Setup…');

	var action = ui.actions.addAction('mcpSetup', function()
	{
		showMcpSetupDialog();
	});

	var menu = ui.menus.get('extras');
	var oldFunct = menu.funct;

	menu.funct = function(menu2, parent)
	{
		oldFunct.apply(this, arguments);
		ui.menus.addMenuItems(menu2, ['-', 'mcpSetup'], parent);
	};
});
