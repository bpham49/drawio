/**
 * Freehand pencil tool for drawio-agentic.
 *
 * Draws a floating curved edge (no source/target cell) through the captured
 * mouse points — the same native mxGraph concept behind draw.io's own
 * multi-point "Line" tool, so the result is a perfectly ordinary edge cell:
 * fully editable, fully compatible with vanilla draw.io, no custom shape
 * class needed. sketch=1 adds the hand-drawn jitter (see sketch-test.png).
 */
Draw.loadPlugin(function(ui)
{
	var graph = ui.editor.graph;
	var active = false;
	var points = null;
	var wasRubberband, wasPanning, wasConnectable;

	function dist(a, b)
	{
		return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
	}

	// Drop points closer than 4px (graph units) apart — keeps the stroke
	// smooth without storing an unusably dense point list.
	function append(pt)
	{
		if (points.length === 0 || dist(points[points.length - 1], pt) >= 4)
		{
			points.push(pt);
		}
	}

	var listener =
	{
		mouseDown: function(sender, me)
		{
			if (!active) return;
			points = [new mxPoint(me.getGraphX(), me.getGraphY())];
			me.consume();
		},
		mouseMove: function(sender, me)
		{
			if (!active || points == null) return;
			append(new mxPoint(me.getGraphX(), me.getGraphY()));
			me.consume();
		},
		mouseUp: function(sender, me)
		{
			if (!active || points == null) return;

			if (points.length >= 2)
			{
				var model = graph.getModel();
				model.beginUpdate();

				try
				{
					var edge = new mxCell('', new mxGeometry(0, 0, 0, 0),
						'edgeStyle=none;curved=1;rounded=1;endArrow=none;startArrow=none;' +
						'sketch=1;strokeWidth=2;html=1;');
					edge.geometry.relative = false;
					edge.geometry.points = points.slice(1, points.length - 1);
					edge.geometry.sourcePoint = points[0];
					edge.geometry.targetPoint = points[points.length - 1];
					edge.edge = true;
					graph.addCell(edge, graph.getDefaultParent());
				}
				finally
				{
					model.endUpdate();
				}
			}

			points = null;
			me.consume();
		}
	};

	graph.addMouseListener(listener);

	var action = ui.actions.addAction('freehandDraw', function()
	{
		active = !active;

		if (active)
		{
			wasRubberband = graph.rubberband.isEnabled();
			wasPanning = graph.panningHandler.isEnabled();
			wasConnectable = graph.isConnectable();
			graph.rubberband.setEnabled(false);
			graph.panningHandler.setEnabled(false);
			graph.setConnectable(false);
			graph.container.style.cursor = 'crosshair';
		}
		else
		{
			graph.rubberband.setEnabled(wasRubberband);
			graph.panningHandler.setEnabled(wasPanning);
			graph.setConnectable(wasConnectable);
			graph.container.style.cursor = '';
		}
	});

	action.setToggleAction(true);
	action.setSelectedCallback(function() { return active; });

	mxResources.parse('freehandDraw=Freehand Draw (P)');

	var menu = ui.menus.get('extras');
	var oldFunct = menu.funct;

	menu.funct = function(menu2, parent)
	{
		oldFunct.apply(this, arguments);
		ui.menus.addMenuItems(menu2, ['-', 'freehandDraw'], parent);
	};

	// 'P' toggles freehand mode, except while typing in a label or a field
	mxEvent.addListener(document, 'keydown', function(evt)
	{
		if (evt.keyCode == 80 && !graph.isEditing() &&
			document.activeElement != null &&
			document.activeElement.nodeName != 'INPUT' &&
			document.activeElement.nodeName != 'TEXTAREA')
		{
			ui.actions.get('freehandDraw').funct();
			mxEvent.consume(evt);
		}
	});
});
