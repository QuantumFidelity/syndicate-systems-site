/**
 * Syndicate Systems — Interactive System Diagram (Phase 2+)
 * Evolving network: drift, dynamic connections, pulse on new links
 * Chaos → clarity on interaction
 */

(function () {
  'use strict';

  var DIM = { w: 580, h: 480 };

  var graph = {
    nodes: [
      { id: 'structure', label: 'Structure', group: 'pillar' },
      { id: 'clarity', label: 'Clarity', group: 'pillar' },
      { id: 'independence', label: 'Independence', group: 'pillar' },
      { id: 'judgement', label: 'Judgement', group: 'core' },
      { id: 'risk', label: 'Risk', group: 'core' },
      { id: 'qualification', label: 'Qualification', group: 'process' },
      { id: 'inspection', label: 'Inspection', group: 'process' },
      { id: 'advisory', label: 'Advisory', group: 'process' },
      { id: 'optional', label: 'Optional', group: 'process' },
      { id: 'ambiguity', label: 'Ambiguity', group: 'problem' },
      { id: 'dependencies', label: 'Dependencies', group: 'problem' },
      { id: 'architecture', label: 'Architecture', group: 'outcome' },
      { id: 'order', label: 'Order', group: 'outcome' },
      { id: 'resilience', label: 'Resilience', group: 'outcome' },
      { id: 'governance', label: 'Governance', group: 'outcome' },
      { id: 'complexity', label: 'Complexity', group: 'problem' },
      { id: 'technical-debt', label: 'Technical Debt', group: 'problem' },
      { id: 'scalability', label: 'Scalability', group: 'outcome' },
      { id: 'observability', label: 'Observability', group: 'outcome' },
      { id: 'integration', label: 'Integration', group: 'problem' },
      { id: 'boundaries', label: 'Boundaries', group: 'pillar' },
      { id: 'constraints', label: 'Constraints', group: 'problem' },
      { id: 'failure-modes', label: 'Failure Modes', group: 'problem' },
      { id: 'legacy', label: 'Legacy', group: 'problem' },
      { id: 'modernization', label: 'Modernization', group: 'outcome' },
      { id: 'vendor-lock', label: 'Vendor Lock', group: 'problem' },
      { id: 'compliance', label: 'Compliance', group: 'outcome' },
      { id: 'migration', label: 'Migration', group: 'process' }
    ],
    coreLinks: [
      { source: 'structure', target: 'clarity' },
      { source: 'structure', target: 'independence' },
      { source: 'structure', target: 'architecture' },
      { source: 'clarity', target: 'judgement' },
      { source: 'clarity', target: 'order' },
      { source: 'independence', target: 'advisory' },
      { source: 'judgement', target: 'risk' },
      { source: 'risk', target: 'resilience' },
      { source: 'qualification', target: 'inspection' },
      { source: 'inspection', target: 'advisory' },
      { source: 'advisory', target: 'optional' },
      { source: 'ambiguity', target: 'inspection' },
      { source: 'dependencies', target: 'inspection' },
      { source: 'dependencies', target: 'architecture' },
      { source: 'ambiguity', target: 'structure' },
      { source: 'architecture', target: 'order' },
      { source: 'order', target: 'resilience' },
      { source: 'optional', target: 'order' },
      { source: 'advisory', target: 'clarity' },
      { source: 'inspection', target: 'structure' }
    ],
    potentialLinks: [
      { source: 'complexity', target: 'structure' },
      { source: 'technical-debt', target: 'inspection' },
      { source: 'scalability', target: 'architecture' },
      { source: 'observability', target: 'resilience' },
      { source: 'integration', target: 'dependencies' },
      { source: 'boundaries', target: 'structure' },
      { source: 'constraints', target: 'architecture' },
      { source: 'failure-modes', target: 'inspection' },
      { source: 'legacy', target: 'ambiguity' },
      { source: 'modernization', target: 'order' },
      { source: 'vendor-lock', target: 'independence' },
      { source: 'compliance', target: 'governance' },
      { source: 'migration', target: 'advisory' },
      { source: 'governance', target: 'structure' },
      { source: 'complexity', target: 'ambiguity' },
      { source: 'technical-debt', target: 'legacy' },
      { source: 'scalability', target: 'resilience' },
      { source: 'observability', target: 'clarity' },
      { source: 'boundaries', target: 'architecture' },
      { source: 'constraints', target: 'dependencies' },
      { source: 'failure-modes', target: 'risk' },
      { source: 'legacy', target: 'migration' },
      { source: 'modernization', target: 'architecture' },
      { source: 'vendor-lock', target: 'dependencies' },
      { source: 'compliance', target: 'structure' }
    ]
  };

  function linkKey(l) {
    var s = typeof l.source === 'object' ? l.source.id : l.source;
    var t = typeof l.target === 'object' ? l.target.id : l.target;
    return s < t ? s + '|' + t : t + '|' + s;
  }

  function getConnectedIds(links, nodeId) {
    var ids = new Set([nodeId]);
    links.forEach(function (l) {
      var s = typeof l.source === 'object' ? l.source.id : l.source;
      var t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === nodeId || t === nodeId) {
        ids.add(s);
        ids.add(t);
      }
    });
    return ids;
  }

  function initDiagram() {
    var container = document.getElementById('systemDiagram');
    if (!container) return;
    if (container.querySelector('canvas') || container.getAttribute('data-globe-active')) return;

    var rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      DIM.w = Math.max(rect.width, 300);
      DIM.h = Math.max(rect.height, 300);
    }

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      renderStatic(container);
      return;
    }

    if (typeof d3 === 'undefined') {
      renderStatic(container);
      return;
    }

    renderD3(container);
  }

  function renderStatic(container) {
    var allLinks = graph.coreLinks.concat(graph.potentialLinks.slice(0, 8));
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'system-diagram__svg');
    svg.setAttribute('viewBox', '0 0 ' + DIM.w + ' ' + DIM.h);
    svg.setAttribute('aria-hidden', 'true');

    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(' + DIM.w / 2 + ',' + DIM.h / 2 + ')');

    var positions = getStaticPositions();
    graph.nodes.forEach(function (n, i) {
      var p = positions[i] || { x: 0, y: 0 };
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'system-diagram__node');
      circle.setAttribute('data-id', n.id);
      circle.setAttribute('tabindex', '0');
      circle.setAttribute('cx', p.x);
      circle.setAttribute('cy', p.y);
      circle.setAttribute('r', 6);
      g.appendChild(circle);
    });

    allLinks.forEach(function (l) {
      var si = graph.nodes.findIndex(function (n) { return n.id === l.source; });
      var ti = graph.nodes.findIndex(function (n) { return n.id === l.target; });
      if (si < 0 || ti < 0) return;
      var p1 = positions[si] || { x: 0, y: 0 };
      var p2 = positions[ti] || { x: 0, y: 0 };
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'system-diagram__link');
      line.setAttribute('data-source', l.source);
      line.setAttribute('data-target', l.target);
      line.setAttribute('x1', p1.x);
      line.setAttribute('y1', p1.y);
      line.setAttribute('x2', p2.x);
      line.setAttribute('y2', p2.y);
      g.insertBefore(line, g.firstChild);
    });

    svg.appendChild(g);
    container.appendChild(svg);
    attachHoverListeners(container, allLinks);
  }

  function getStaticPositions() {
    var cx = DIM.w / 2;
    var cy = DIM.h / 2;
    var r = Math.min(DIM.w, DIM.h) * 0.42;
    var n = graph.nodes.length;
    return graph.nodes.map(function (node, i) {
      var angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      var jitter = (Math.sin(i * 1.3) * 0.12 + 1) * r;
      return {
        x: cx + Math.cos(angle) * jitter,
        y: cy + Math.sin(angle) * jitter
      };
    });
  }

  function renderD3(container) {
    var nodeById = {};
    graph.nodes.forEach(function (n) {
      nodeById[n.id] = Object.assign({}, n);
    });

    function toLinkObj(l) {
      return {
        source: nodeById[l.source] || l.source,
        target: nodeById[l.target] || l.target
      };
    }

    var activePotential = [];
    var links = graph.coreLinks.map(toLinkObj);
    var nodes = graph.nodes.map(function (n) { return nodeById[n.id]; });

    var hoveredNode = null;
    var cursorPos = null;
    var linkForce = d3.forceLink(links).id(function (d) { return d.id; }).distance(42);

    function clusterForce(alpha) {
      if (!hoveredNode) return;
      var connectedIds = getConnectedIds(links, hoveredNode.id);
      var targetDist = 50;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node === hoveredNode) continue;
        if (!connectedIds.has(node.id)) continue;
        var dx = hoveredNode.x - node.x;
        var dy = hoveredNode.y - node.y;
        var l = Math.sqrt(dx * dx + dy * dy);
        if (l < 0.01) continue;
        var k = alpha * 0.12 * (l - targetDist) / l;
        node.vx += dx * k;
        node.vy += dy * k;
      }
    }

    function cursorForce(alpha) {
      if (!cursorPos) return;
      var influence = 0.06;
      var radius = 140;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var dx = cursorPos.x - node.x;
        var dy = cursorPos.y - node.y;
        var distSq = dx * dx + dy * dy;
        if (distSq < 1 || distSq > radius * radius) continue;
        var dist = Math.sqrt(distSq);
        var strength = alpha * influence * (1 - dist / radius);
        node.vx += (dx / dist) * strength;
        node.vy += (dy / dist) * strength;
      }
    }

    function driftForce(alpha) {
      var strength = 0.4;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.fx != null) continue;
        node.vx += (Math.random() - 0.5) * strength;
        node.vy += (Math.random() - 0.5) * strength;
      }
    }

    var simulation = d3.forceSimulation(nodes)
      .force('link', linkForce)
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(DIM.w / 2, DIM.h / 2))
      .force('collision', d3.forceCollide().radius(14))
      .force('cluster', clusterForce)
      .force('cursor', cursorForce)
      .force('drift', driftForce)
      .alphaDecay(0.008)
      .velocityDecay(0.35)
      .alphaTarget(0.08);

    var svg = d3.select(container).append('svg')
      .attr('class', 'system-diagram__svg')
      .attr('viewBox', '0 0 ' + DIM.w + ' ' + DIM.h)
      .attr('aria-hidden', 'true');

    var g = svg.append('g');

    var linkEls = g.selectAll('.system-diagram__link')
      .data(links, linkKey)
      .enter().append('line')
      .attr('class', 'system-diagram__link')
      .attr('data-source', function (d) { return d.source.id; })
      .attr('data-target', function (d) { return d.target.id; });

    var nodeEls = g.selectAll('.system-diagram__node')
      .data(nodes)
      .enter().append('circle')
      .attr('class', 'system-diagram__node')
      .attr('data-id', function (d) { return d.id; })
      .attr('tabindex', '0')
      .attr('r', 6)
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    function ticked() {
      linkEls
        .attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });

      nodeEls
        .attr('cx', function (d) { return d.x; })
        .attr('cy', function (d) { return d.y; });
    }

    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.25).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event, d) {
      if (!event.active) simulation.alphaTarget(0.08);
      d.fx = null;
      d.fy = null;
    }

    simulation.on('tick', ticked);

    function addOrRemoveLink() {
      if (Math.random() < 0.55 && activePotential.length < graph.potentialLinks.length) {
        var available = graph.potentialLinks.filter(function (p) {
          var k = linkKey(p);
          return !links.some(function (l) { return linkKey(l) === k; });
        });
        if (available.length === 0) return;
        var chosen = available[Math.floor(Math.random() * available.length)];
        var newLink = toLinkObj(chosen);
        links.push(newLink);
        activePotential.push(chosen);
        linkForce.links(links);
        linkEls = g.selectAll('.system-diagram__link').data(links, linkKey);
        var linkEnter = linkEls.enter().insert('line', '.system-diagram__node')
          .attr('class', 'system-diagram__link system-diagram__link--pulse')
          .attr('data-source', function (d) { return d.source.id; })
          .attr('data-target', function (d) { return d.target.id; });
        linkEls = linkEls.merge(linkEnter);
        linkEls.filter(function (d) { return d === newLink; })
          .classed('system-diagram__link--pulse', true);
        setTimeout(function () {
          linkEls.filter(function (d) { return d === newLink; })
            .classed('system-diagram__link--pulse', false);
        }, 900);
        simulation.alpha(0.25).restart();
      } else if (activePotential.length > 0) {
        var idx = Math.floor(Math.random() * activePotential.length);
        var removed = activePotential.splice(idx, 1)[0];
        var k = linkKey(removed);
        var linkIdx = links.findIndex(function (l) { return linkKey(l) === k; });
        if (linkIdx >= 0) {
          links.splice(linkIdx, 1);
          linkForce.links(links);
          linkEls = g.selectAll('.system-diagram__link').data(links, linkKey);
          linkEls.exit().transition().duration(400).style('stroke-opacity', 0).remove();
          simulation.alpha(0.2).restart();
        }
      }
    }

    setInterval(addOrRemoveLink, 3200);

    function highlight(nodeId) {
      var connected = nodeId ? getConnectedIds(links, nodeId) : null;
      nodeEls.each(function (d) {
        var el = d3.select(this);
        var active = !nodeId || connected.has(d.id);
        el.classed('is-dimmed', !active);
        el.classed('is-active', nodeId && d.id === nodeId);
      });
      linkEls.each(function (d) {
        var el = d3.select(this);
        var active = !nodeId || (connected.has(d.source.id) && connected.has(d.target.id));
        el.classed('is-dimmed', !active);
      });

      if (hoveredNode && hoveredNode.id !== nodeId) {
        hoveredNode.fx = null;
        hoveredNode.fy = null;
      }
      hoveredNode = nodeId ? nodes.find(function (n) { return n.id === nodeId; }) : null;
      if (hoveredNode) {
        hoveredNode.fx = hoveredNode.x;
        hoveredNode.fy = hoveredNode.y;
        simulation.alphaTarget(0.4).restart();
      }
    }

    function clearHighlight() {
      if (hoveredNode) {
        hoveredNode.fx = null;
        hoveredNode.fy = null;
      }
      highlight(null);
      simulation.alphaTarget(0.08);
      simulation.alpha(0.3).restart();
    }

    nodeEls
      .on('mouseenter', function (event, d) {
        highlight(d.id);
      })
      .on('mouseleave', function () {
        clearHighlight();
      })
      .on('focus', function (event, d) {
        highlight(d.id);
      })
      .on('blur', function () {
        clearHighlight();
      });

    container.addEventListener('mouseleave', function () {
      clearHighlight();
      cursorPos = null;
    });

    container.addEventListener('mousemove', function (event) {
      var rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        cursorPos = {
          x: ((event.clientX - rect.left) / rect.width) * DIM.w,
          y: ((event.clientY - rect.top) / rect.height) * DIM.h
        };
        if (!hoveredNode && simulation.alpha() < 0.05) {
          simulation.alpha(0.03).restart();
        }
      }
    });
  }

  function attachHoverListeners(container, links) {
    var nodes = container.querySelectorAll('.system-diagram__node');
    var linkElements = container.querySelectorAll('.system-diagram__link');

    function highlight(nodeId) {
      var connected = nodeId ? getConnectedIds(links, nodeId) : null;
      nodes.forEach(function (n) {
        var id = n.getAttribute('data-id');
        var active = !nodeId || connected.has(id);
        n.classList.toggle('is-dimmed', !active);
        n.classList.toggle('is-active', nodeId && id === nodeId);
      });
      linkElements.forEach(function (l) {
        var s = l.getAttribute('data-source');
        var t = l.getAttribute('data-target');
        var active = !nodeId || (connected.has(s) && connected.has(t));
        l.classList.toggle('is-dimmed', !active);
      });
    }

    function clearHighlight() {
      highlight(null);
    }

    nodes.forEach(function (node) {
      node.addEventListener('mouseenter', function () {
        highlight(node.getAttribute('data-id'));
      });
      node.addEventListener('mouseleave', function () {
        clearHighlight();
      });
      node.addEventListener('focus', function () {
        highlight(node.getAttribute('data-id'));
      });
      node.addEventListener('blur', function () {
        clearHighlight();
      });
    });

    container.addEventListener('mouseleave', clearHighlight);
  }

  function runInit() {
    setTimeout(function () {
      initDiagram();
    }, 400);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }
})();
