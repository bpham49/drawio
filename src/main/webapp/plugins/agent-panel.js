/**
 * Claude side panel for bphamio.
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
		if (panel == null) return;

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

	// Docked in its own column of the editor's CSS grid, right of the format
	// panel, so it resizes the canvas the same way the format panel does
	var css = document.createElement('style');
	css.textContent =
		'.geEditor.bphamioAgentDocked { grid-template-columns: min-content min-content 1fr min-content min-content; }' +
		'.bphamioAgentPanel { grid-column: 5; grid-row: 3; min-height: 0; width: 320px; box-sizing: border-box;' +
		' display: flex; flex-direction: column; padding: 8px 10px; font-size: 12px; z-index: 2;' +
		' border-left: 1px solid light-dark(#dadce0, #505759); }' +
		'.bphamioAgentHeader { display: flex; align-items: center; font-weight: 600; font-size: 13px; margin-bottom: 8px; }' +
		'.bphamioAgentHeader span { flex: 1; }' +
		'.bphamioAgentClose { cursor: pointer; opacity: 0.6; padding: 0 4px; font-size: 16px; line-height: 1; }' +
		'.bphamioAgentClose:hover { opacity: 1; }';
	document.head.appendChild(css);

	var panel = null;

	function createPanel()
	{
		panel = document.createElement('div');
		panel.className = 'bphamioAgentPanel';

		var header = document.createElement('div');
		header.className = 'bphamioAgentHeader';
		var title = document.createElement('span');
		title.textContent = 'Claude';
		header.appendChild(title);
		var close = document.createElement('a');
		close.className = 'bphamioAgentClose';
		close.textContent = '×';
		close.setAttribute('title', 'Hide panel');
		mxEvent.addListener(close, 'click', function() { setPanelVisible(false); });
		header.appendChild(close);
		panel.appendChild(header);

		log = document.createElement('div');
		log.style.flex = '1';
		log.style.overflowY = 'auto';
		log.style.userSelect = 'text';
		log.style.marginBottom = '8px';
		panel.appendChild(log);

		selLine = document.createElement('div');
		selLine.style.color = 'gray';
		selLine.style.fontSize = '11px';
		selLine.style.marginBottom = '4px';
		selLine.style.whiteSpace = 'nowrap';
		selLine.style.overflow = 'hidden';
		selLine.style.textOverflow = 'ellipsis';
		panel.appendChild(selLine);

		input = document.createElement('textarea');
		input.placeholder = 'Change this… (type, or dictate: press Fn twice). ' +
			(mxClient.IS_MAC ? 'Cmd' : 'Ctrl') + '+Enter sends.';
		input.style.width = '100%';
		input.style.height = '72px';
		input.style.boxSizing = 'border-box';
		input.style.resize = 'none';
		input.style.fontFamily = 'inherit';
		input.style.fontSize = '12px';
		panel.appendChild(input);

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
		panel.appendChild(buttons);

		ui.container.appendChild(panel);
		graph.getSelectionModel().addListener(mxEvent.CHANGE, updateSelectionLine);
	}

	function isPanelVisible()
	{
		return panel != null && panel.style.display != 'none';
	}

	function setPanelVisible(visible)
	{
		if (visible && panel == null) createPanel();
		if (panel == null) return;

		panel.style.display = visible ? '' : 'none';
		ui.container.classList.toggle('bphamioAgentDocked', visible);
		ui.refresh(true);

		try { localStorage.setItem('.bphamioAgentPanel', visible ? '1' : '0'); } catch (e) { /* ignore */ }

		if (visible)
		{
			updateSelectionLine();
			input.focus();
		}
	}

	mxResources.parse('askClaude=Claude Panel');

	var action = ui.actions.addAction('askClaude', function()
	{
		setPanelVisible(!isPanelVisible());
	}, null, null, Editor.ctrlKey + '+/');
	action.setToggleAction(true);
	action.setSelectedCallback(isPanelVisible);
	ui.keyHandler.bindAction(191, true, 'askClaude'); // Ctrl+/

	function appendToMenu(name, items)
	{
		var menu = ui.menus.get(name);
		if (menu == null) return;
		var oldFunct = menu.funct;

		menu.funct = function(menu2, parent)
		{
			oldFunct.apply(this, arguments);
			ui.menus.addMenuItems(menu2, items, parent);
		};
	}

	appendToMenu('extras', ['askClaude']);
	appendToMenu('view', ['-', 'askClaude']);

	var open = true;
	try { open = localStorage.getItem('.bphamioAgentPanel') != '0'; } catch (e) { /* ignore */ }
	if (open) setPanelVisible(true);
});
