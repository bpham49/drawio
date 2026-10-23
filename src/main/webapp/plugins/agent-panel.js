/**
 * "Ask Claude" panel for bphamio.
 *
 * Select shapes, type (or dictate) what to change, and the user's local
 * Claude Code edits the open diagram through bphamio's MCP server. The
 * request goes to the main process (src/main/agent.js), which runs
 * `claude -p` and streams progress back as 'agentEvent' messages. Edits land
 * in the file on disk and show up here through the file watcher.
 *
 * Everything shown in the log is set with textContent: replies can quote
 * diagram labels, which may come from an untrusted file.
 */
Draw.loadPlugin(function(ui)
{
	var graph = ui.editor.graph;
	var sessionId = null;
	var busy = false;
	var win = null;
	var log, selLine, input, sendBtn, stopBtn;

	function cellLabel(cell)
	{
		var value = graph.convertValueToString(cell) || '';
		var text = (graph.isHtmlLabel(cell) && value.indexOf('<') >= 0) ?
			(new DOMParser().parseFromString(value, 'text/html').body.textContent || '') : value;
		text = text.replace(/\s+/g, ' ').trim();
		return (text.length > 80) ? text.substring(0, 80) + '…' : text;
	}

	function selectionContext()
	{
		return graph.getSelectionCells().slice(0, 50).map(function(cell)
		{
			return {
				id: cell.id,
				kind: graph.model.isEdge(cell) ? 'edge' : (graph.model.getChildCount(cell) > 0 ? 'group' : 'shape'),
				label: cellLabel(cell)
			};
		});
	}

	function updateSelectionLine()
	{
		if (selLine == null) return;
		var sel = selectionContext();
		selLine.textContent = (sel.length == 0) ? 'Nothing selected — Claude sees the whole page.' :
			'Selected: ' + sel.map(function(c) { return c.label || c.kind; }).join(', ');
	}

	function addLine(text, color, italic)
	{
		var div = document.createElement('div');
		div.style.whiteSpace = 'pre-wrap';
		div.style.marginBottom = '6px';
		if (color) div.style.color = color;
		if (italic) div.style.fontStyle = 'italic';
		div.textContent = text;
		log.appendChild(div);
		log.scrollTop = log.scrollHeight;
	}

	function setBusy(value)
	{
		busy = value;
		sendBtn.disabled = value;
		stopBtn.disabled = !value;
		input.disabled = value;
	}

	// The agent edits the file on disk, so unsaved changes here must be
	// written first or they'd be lost when the edited file reloads.
	function withSavedFile(callback)
	{
		var file = ui.getCurrentFile();

		if (file == null || file.fileObject == null || file.fileObject.path == null)
		{
			addLine('Save this diagram to a .drawio file first (File > Save As).', '#a33');
			return;
		}

		if (!file.isModified())
		{
			callback(file.fileObject.path);
			return;
		}

		file.save(true, function()
		{
			callback(file.fileObject.path);
		}, function(e)
		{
			addLine('Could not save before asking Claude: ' + ((e && e.message) || e), '#a33');
		});
	}

	function send()
	{
		var prompt = input.value.trim();
		if (busy || prompt == '') return;

		withSavedFile(function(filePath)
		{
			addLine('You: ' + prompt);
			input.value = '';
			setBusy(true);

			window.electron.request({
				action: 'agentAsk',
				prompt: prompt,
				filePath: filePath,
				page: (ui.currentPage != null) ? ui.currentPage.getName() : null,
				selection: selectionContext(),
				sessionId: sessionId
			}, function() {}, function(msg)
			{
				addLine(String(msg || 'Request failed'), '#a33');
				setBusy(false);
			});
		});
	}

	window.electron.registerMsgListener('agentEvent', function(e)
	{
		if (win == null) return;

		if (e.kind == 'init')
		{
			sessionId = e.sessionId || sessionId;
			if (!e.mcpConnected) addLine('Claude could not reach bphamio\'s MCP server (Extras > MCP Setup…).', '#a33');
		}
		else if (e.kind == 'tool')
		{
			addLine('→ ' + e.name + (e.detail ? ' ' + e.detail : ''), 'gray', true);
		}
		else if (e.kind == 'text')
		{
			addLine('Claude: ' + e.text);
		}
		else if (e.kind == 'done')
		{
			sessionId = e.sessionId || sessionId;
			if (e.isError) addLine(e.result || 'Claude stopped with an error.', '#a33');
			setBusy(false);
		}
		else if (e.kind == 'stopped')
		{
			addLine('Stopped.', 'gray', true);
			setBusy(false);
		}
		else if (e.kind == 'error')
		{
			addLine(String(e.message), '#a33');
			setBusy(false);
		}
	});

	function createWindow()
	{
		var div = document.createElement('div');
		div.style.display = 'flex';
		div.style.flexDirection = 'column';
		div.style.height = '100%';
		div.style.padding = '8px';
		div.style.boxSizing = 'border-box';
		div.style.fontSize = '12px';

		log = document.createElement('div');
		log.style.flex = '1';
		log.style.overflowY = 'auto';
		log.style.userSelect = 'text';
		log.style.marginBottom = '8px';
		div.appendChild(log);

		selLine = document.createElement('div');
		selLine.style.color = 'gray';
		selLine.style.fontSize = '11px';
		selLine.style.marginBottom = '4px';
		selLine.style.whiteSpace = 'nowrap';
		selLine.style.overflow = 'hidden';
		selLine.style.textOverflow = 'ellipsis';
		div.appendChild(selLine);

		input = document.createElement('textarea');
		input.placeholder = 'Change this… (type, or dictate: press Fn twice). ' +
			(mxClient.IS_MAC ? 'Cmd' : 'Ctrl') + '+Enter sends.';
		input.style.width = '100%';
		input.style.height = '60px';
		input.style.boxSizing = 'border-box';
		input.style.resize = 'none';
		div.appendChild(input);

		mxEvent.addListener(input, 'keydown', function(evt)
		{
			// Keeps editor shortcuts (Delete, arrows, letters) out of the graph
			evt.stopPropagation();

			if (evt.key == 'Enter' && (evt.metaKey || evt.ctrlKey))
			{
				evt.preventDefault();
				send();
			}
		});

		var buttons = document.createElement('div');
		buttons.style.marginTop = '6px';
		buttons.style.textAlign = 'right';

		var newBtn = mxUtils.button('New chat', function()
		{
			if (busy) return;
			sessionId = null;
			log.textContent = '';
		});
		newBtn.className = 'geBtn';

		stopBtn = mxUtils.button('Stop', function()
		{
			window.electron.request({ action: 'agentCancel' }, function() {}, function() {});
		});
		stopBtn.className = 'geBtn';
		stopBtn.disabled = true;

		sendBtn = mxUtils.button('Send', send);
		sendBtn.className = 'geBtn gePrimaryBtn';

		buttons.appendChild(newBtn);
		buttons.appendChild(stopBtn);
		buttons.appendChild(sendBtn);
		div.appendChild(buttons);

		var w = 340, h = 420;
		var x = Math.max(0, document.body.clientWidth - w - 260);

		win = new mxWindow('Ask Claude', div, x, 100, w, h, true, true);
		win.destroyOnClose = false;
		win.setMaximizable(false);
		win.setResizable(true);
		win.setClosable(true);
		win.addListener('show', function()
		{
			updateSelectionLine();
			win.fit();
			input.focus();
		});

		graph.getSelectionModel().addListener(mxEvent.CHANGE, updateSelectionLine);
	}

	mxResources.parse('askClaude=Ask Claude…');

	ui.actions.addAction('askClaude', function()
	{
		if (win == null) createWindow();
		win.setVisible(true);
		updateSelectionLine();
		input.focus();
	});

	var menu = ui.menus.get('extras');
	var oldFunct = menu.funct;

	menu.funct = function(menu2, parent)
	{
		oldFunct.apply(this, arguments);
		ui.menus.addMenuItems(menu2, ['askClaude'], parent);
	};
});
