/**
 * Syndicate Systems — Interactive System Graph
 * Visual metaphor: complexity → inspection → structure
 *
 * States: idle (semi-chaotic) → proximity (cursor response) → structured (layered architecture)
 * → relax (return to semi-chaotic)
 */

(function () {
  'use strict';

  var W = 540;
  var H = 400;
  var PAD = 48;
  var INNER_W = W - PAD * 2;
  var INNER_H = H - PAD * 2;
  var NODES = 18;
  var STATE = { IDLE: 0, PROXIMITY: 1, STRUCTURED: 2, RELAXING: 3 };
  var LEAVE_DELAY_MS = 400;
  var STRUCTURE_TRANSITION_MS = 800;
  var RELAX_TRANSITION_MS = 1200;
  var PROXIMITY_RADIUS = 120;
  var ENGAGE_THRESHOLD = 9999; /* Any hover in graph = structural reorganization */
  var STEEL_BLUE = '#6B7C8A';

  var nodes = [];
  var links = [];
  var nodeById = {};
  var sim = null;
  var state = STATE.IDLE;
  var cursorPos = null;
  var leaveTimer = null;
  var prefersReducedMotion = false;
  var structuredLayoutIndex = 0;
  var chaoticLayoutIndex = 0;

  function buildGraph() {
    var ids = [];
    for (var i = 0; i < NODES; i++) ids.push('n' + i);

    nodes = ids.map(function (id, i) {
      var tier = Math.floor(i / 4.5);
      if (tier > 3) tier = 3;
      var n = {
        id: id,
        tier: tier,
        x: 0,
        y: 0,
        fx: null,
        fy: null
      };
      nodeById[id] = n;
      return n;
    });

    var edgePairs = [
      [0, 4], [0, 5], [1, 4], [1, 6], [2, 5], [2, 7], [3, 6], [3, 7],
      [4, 8], [4, 9], [5, 9], [5, 10], [6, 10], [6, 11], [7, 11], [7, 9],
      [8, 12], [9, 12], [9, 13], [10, 13], [10, 14], [11, 14], [11, 15],
      [12, 16], [13, 16], [13, 17], [14, 17], [15, 17],
      [0, 1], [2, 3], [8, 10], [12, 14]
    ];

    links = edgePairs.map(function (p) {
      return {
        source: nodes[p[0]],
        target: nodes[p[1]]
      };
    });
  }

  function linkKey(l) {
    var a = l.source.id || l.source;
    var b = l.target.id || l.target;
    return a < b ? a + '|' + b : b + '|' + a;
  }

  /* Structured layouts — mathematical concepts: layered DAG, bipartite, circular, tree, grid, spiral */
  var STRUCTURED_LAYOUTS = [
    function layered() {
      var cx = W / 2, tierHeight = INNER_H / 4, baseY = PAD + tierHeight / 2;
      var tierCounts = [0, 0, 0, 0], tierIdx = [0, 0, 0, 0], positions = {};
      nodes.forEach(function (n) { tierCounts[n.tier] = (tierCounts[n.tier] || 0) + 1; });
      nodes.forEach(function (n) {
        var t = n.tier, count = tierCounts[t], idx = tierIdx[t]++;
        var tierW = count > 1 ? INNER_W * 0.75 : 0;
        positions[n.id] = {
          x: cx + (count > 1 ? (idx / Math.max(1, count - 1) - 0.5) * tierW : 0),
          y: baseY + t * tierHeight
        };
      });
      return positions;
    },
    function bipartite() {
      var cx = W / 2, gap = INNER_W * 0.3, positions = {};
      nodes.forEach(function (n, i) {
        var col = i % 2;
        var row = Math.floor(i / 2);
        var rowsInCol = Math.ceil(NODES / 2);
        var y = PAD + INNER_H * (row + 0.5) / rowsInCol;
        positions[n.id] = { x: cx + (col === 0 ? -gap : gap), y: y };
      });
      return positions;
    },
    function circular() {
      var cx = W / 2, cy = H / 2, r = Math.min(INNER_W, INNER_H) * 0.36;
      return nodes.reduce(function (acc, n, i) {
        var angle = (i / NODES) * Math.PI * 2 - Math.PI / 2;
        acc[n.id] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
        return acc;
      }, {});
    },
    function tree() {
      var cx = W / 2, baseY = PAD + 35;
      var tiers = [[0], [1, 2], [3, 4, 5, 6], [7, 8, 9, 10, 11], [12, 13, 14, 15, 16, 17]];
      var positions = {};
      tiers.forEach(function (inds, tier) {
        var count = inds.length;
        var tierW = INNER_W * (0.25 + tier * 0.12);
        var y = baseY + tier * (INNER_H / 5.5);
        inds.forEach(function (idx, i) {
          var x = cx + (count > 1 ? (i / (count - 1) - 0.5) * tierW : 0);
          positions['n' + idx] = { x: x, y: y };
        });
      });
      return positions;
    },
    function grid() {
      var cols = 5, rows = Math.ceil(NODES / cols);
      var cellW = INNER_W / (cols + 1), cellH = INNER_H / (rows + 1);
      return nodes.reduce(function (acc, n, i) {
        var c = i % cols, r = Math.floor(i / cols);
        acc[n.id] = { x: PAD + (c + 1) * cellW, y: PAD + (r + 1) * cellH };
        return acc;
      }, {});
    },
    function spiral() {
      var cx = W / 2, cy = H / 2;
      var phi = (1 + Math.sqrt(5)) / 2;
      return nodes.reduce(function (acc, n, i) {
        var angle = i * 2 * Math.PI / (phi * phi);
        var r = Math.min(INNER_W, INNER_H) * 0.35 * Math.sqrt(i + 1) / Math.sqrt(NODES);
        acc[n.id] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
        return acc;
      }, {});
    }
  ];

  /* Chaotic layouts — varied semi-chaotic arrangements */
  var CHAOTIC_LAYOUTS = [
    function radial() {
      var cx = W / 2, cy = H / 2, r = Math.min(INNER_W, INNER_H) * 0.36;
      return nodes.reduce(function (acc, n, i) {
        var angle = (i / NODES) * Math.PI * 2 - Math.PI / 2;
        var jitter = 0.85 + Math.sin(i * 2.1) * 0.15 + Math.cos(i * 1.7) * 0.1;
        acc[n.id] = { x: cx + Math.cos(angle) * r * jitter, y: cy + Math.sin(angle) * r * jitter };
        return acc;
      }, {});
    },
    function clustered() {
      var cx = W / 2, cy = H / 2;
      var clusters = [[0, 1, 2, 3, 4, 5], [6, 7, 8, 9], [10, 11, 12, 13], [14, 15, 16, 17]];
      var positions = {}, idx = 0;
      clusters.forEach(function (ids, ci) {
        var ac = (ci % 2) * 0.4 - 0.2;
        var bc = Math.floor(ci / 2) * 0.35 - 0.35;
        var ccx = cx + ac * INNER_W;
        var ccy = cy + bc * INNER_H;
        var rr = Math.min(INNER_W, INNER_H) * 0.15;
        ids.forEach(function (ni) {
          var angle = (idx / 6) * Math.PI * 2;
          var j = 0.7 + Math.sin(idx * 3) * 0.3;
          positions['n' + ni] = { x: ccx + Math.cos(angle) * rr * j, y: ccy + Math.sin(angle) * rr * j };
          idx++;
        });
      });
      return positions;
    },
    function scatter() {
      var positions = {};
      nodes.forEach(function (n, i) {
        var u = (Math.sin(i * 0.47) + 1) / 2;
        var v = (Math.cos(i * 0.31) + 1) / 2;
        positions[n.id] = {
          x: PAD + INNER_W * (0.1 + 0.8 * u),
          y: PAD + INNER_H * (0.1 + 0.8 * v)
        };
      });
      return positions;
    },
    function asymmetric() {
      var cx = W / 2 + INNER_W * 0.12, cy = H / 2 - INNER_H * 0.08;
      var r = Math.min(INNER_W, INNER_H) * 0.32;
      return nodes.reduce(function (acc, n, i) {
        var angle = (i / NODES) * Math.PI * 2.3 + 0.4;
        var jitter = 0.8 + Math.sin(i * 1.9) * 0.2;
        acc[n.id] = { x: cx + Math.cos(angle) * r * jitter, y: cy + Math.sin(angle) * r * jitter };
        return acc;
      }, {});
    }
  ];

  function getStructuredPositions(index) {
    var i = ((index || 0) % STRUCTURED_LAYOUTS.length + STRUCTURED_LAYOUTS.length) % STRUCTURED_LAYOUTS.length;
    return STRUCTURED_LAYOUTS[i]();
  }

  function getChaoticPositions(index) {
    var i = ((index || 0) % CHAOTIC_LAYOUTS.length + CHAOTIC_LAYOUTS.length) % CHAOTIC_LAYOUTS.length;
    return CHAOTIC_LAYOUTS[i]();
  }

  function distToCursor(node) {
    if (!cursorPos) return Infinity;
    var dx = cursorPos.x - node.x;
    var dy = cursorPos.y - node.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function cursorInEngageZone() {
    /* Any hover in graph = engage; mousemove only fires when cursor is over container */
    return !!cursorPos;
  }

  function initPositions(chaotic) {
    var pos = chaotic ? getChaoticPositions() : getStructuredPositions();
    nodes.forEach(function (n) {
      var p = pos[n.id];
      n.x = p.x;
      n.y = p.y;
      n.fx = null;
      n.fy = null;
    });
  }

  function renderStatic(container) {
    initPositions(true);
    var pos = getChaoticPositions();
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'system-graph__svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');

    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    links.forEach(function (l) {
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'system-graph__link');
      var p1 = pos[l.source.id];
      var p2 = pos[l.target.id];
      if (p1 && p2) {
        line.setAttribute('x1', p1.x);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x);
        line.setAttribute('y2', p2.y);
      }
      g.appendChild(line);
    });
    nodes.forEach(function (n) {
      var p = pos[n.id] || { x: W / 2, y: H / 2 };
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'system-graph__node');
      circle.setAttribute('cx', p.x);
      circle.setAttribute('cy', p.y);
      circle.setAttribute('r', 4);
      g.appendChild(circle);
    });
    svg.appendChild(g);
    container.appendChild(svg);
  }

  function renderInteractive(container) {
    if (typeof d3 === 'undefined') {
      renderStatic(container);
      return;
    }

    container.innerHTML = '';
    buildGraph();
    initPositions(true);

    var svg = d3.select(container)
      .append('svg')
      .attr('class', 'system-graph__svg')
      .attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('aria-hidden', 'true');

    var g = svg.append('g');

    var linkEls = g.selectAll('.system-graph__link')
      .data(links, linkKey)
      .enter().append('line')
      .attr('class', 'system-graph__link')
      .attr('x1', function (d) { return d.source.x; })
      .attr('y1', function (d) { return d.source.y; })
      .attr('x2', function (d) { return d.target.x; })
      .attr('y2', function (d) { return d.target.y; });

    var nodeEls = g.selectAll('.system-graph__node')
      .data(nodes)
      .enter().append('circle')
      .attr('class', 'system-graph__node')
      .attr('r', 4)
      .attr('cx', function (d) { return d.x; })
      .attr('cy', function (d) { return d.y; });

    function clampBounds() {
      var xMin = PAD;
      var xMax = W - PAD;
      var yMin = PAD;
      var yMax = H - PAD;
      nodes.forEach(function (n) {
        if (n.fx != null) return;
        n.x = Math.max(xMin, Math.min(xMax, n.x));
        n.y = Math.max(yMin, Math.min(yMax, n.y));
      });
    }

    function ticked() {
      clampBounds();
      linkEls
        .attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });
      nodeEls
        .attr('cx', function (d) { return d.x; })
        .attr('cy', function (d) { return d.y; });
    }

    function driftForce(alpha) {
      if (state !== STATE.IDLE || !cursorPos) return;
      var strength = 0.15;
      nodes.forEach(function (n) {
        if (n.fx != null) return;
        n.vx = (n.vx || 0) + (Math.random() - 0.5) * strength;
        n.vy = (n.vy || 0) + (Math.random() - 0.5) * strength;
      });
    }

    function proximityForce(alpha) {
      if (state !== STATE.PROXIMITY || !cursorPos) return;
      var influence = 0.04;
      nodes.forEach(function (n) {
        if (n.fx != null) return;
        var d = distToCursor(n);
        if (d > PROXIMITY_RADIUS || d < 4) return;
        var strength = alpha * influence * (1 - d / PROXIMITY_RADIUS);
        var dx = (cursorPos.x - n.x) / d;
        var dy = (cursorPos.y - n.y) / d;
        n.vx = (n.vx || 0) + dx * strength;
        n.vy = (n.vy || 0) + dy * strength;
      });
    }

    sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(36))
      .force('charge', d3.forceManyBody().strength(-45))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius(12))
      .force('drift', driftForce)
      .force('proximity', proximityForce)
      .alphaDecay(0.012)
      .velocityDecay(0.4)
      .alphaTarget(0.06)
      .on('tick', ticked);

    function transitionToStructured() {
      if (state === STATE.STRUCTURED || state === STATE.RELAXING) return;
      state = STATE.STRUCTURED;
      sim.stop();
      nodeEls.interrupt();
      linkEls.interrupt();
      var targetPos = getStructuredPositions(structuredLayoutIndex);
      structuredLayoutIndex = (structuredLayoutIndex + 1) % STRUCTURED_LAYOUTS.length;
      nodes.forEach(function (n) {
        var t = targetPos[n.id];
        n.fx = t.x;
        n.fy = t.y;
      });
      var transition = d3.transition().duration(STRUCTURE_TRANSITION_MS).ease(d3.easeCubicInOut);
      nodeEls.transition(transition)
        .attr('cx', function (d) { return d.fx; })
        .attr('cy', function (d) { return d.fy; });
      linkEls.transition(transition)
        .attr('x1', function (d) { return d.source.fx || d.source.x; })
        .attr('y1', function (d) { return d.source.fy || d.source.y; })
        .attr('x2', function (d) { return d.target.fx || d.target.x; })
        .attr('y2', function (d) { return d.target.fy || d.target.y; })
        .on('end', function () {
          nodes.forEach(function (n) {
            n.x = n.fx;
            n.y = n.fy;
          });
          ticked();
        });
      updateEdgeVisibility(linkEls, nodeEls, true);
    }

    function transitionToChaotic() {
      if (state !== STATE.STRUCTURED) return;
      state = STATE.RELAXING;
      nodeEls.interrupt();
      linkEls.interrupt();
      var targetPos = getChaoticPositions(chaoticLayoutIndex);
      chaoticLayoutIndex = (chaoticLayoutIndex + 1) % CHAOTIC_LAYOUTS.length;
      nodes.forEach(function (n) {
        n.fx = null;
        n.fy = null;
        var t = targetPos[n.id];
        n.targetX = t.x;
        n.targetY = t.y;
      });
      var transition = d3.transition().duration(RELAX_TRANSITION_MS).ease(d3.easeCubicInOut);
      nodeEls
        .transition(transition)
        .attr('cx', function (d) { return d.targetX; })
        .attr('cy', function (d) { return d.targetY; });
      linkEls
        .transition(transition)
        .attr('x1', function (d) {
          var s = d.source;
          return s.targetX != null ? s.targetX : s.x;
        })
        .attr('y1', function (d) {
          var s = d.source;
          return s.targetY != null ? s.targetY : s.y;
        })
        .attr('x2', function (d) {
          var t = d.target;
          return t.targetX != null ? t.targetX : t.x;
        })
        .attr('y2', function (d) {
          var t = d.target;
          return t.targetY != null ? t.targetY : t.y;
        })
        .on('end', function () {
          nodes.forEach(function (n) {
            n.x = n.targetX;
            n.y = n.targetY;
            n.targetX = n.targetY = undefined;
            n.vx = n.vy = 0;
          });
          state = STATE.IDLE;
          updateEdgeVisibility(linkEls, nodeEls, false);
          /* Do NOT restart sim — prevents zoom-out; graph stays static until next hover */
        });
      updateEdgeVisibility(linkEls, nodeEls, false);
    }

    function updateEdgeVisibility(linkSelection, nodeSelection, structured) {
      if (structured) {
        linkSelection.classed('is-emphasized', true).classed('is-dimmed', false);
        nodeSelection.classed('is-emphasized', false).classed('is-dimmed', false);
      } else if (cursorPos) {
        var nearIds = new Set();
        nodes.forEach(function (n) {
          if (distToCursor(n) < PROXIMITY_RADIUS) nearIds.add(n.id);
        });
        linkSelection.each(function (d) {
          var near = nearIds.has(d.source.id) && nearIds.has(d.target.id);
          d3.select(this).classed('is-emphasized', near).classed('is-dimmed', !near);
        });
        nodeSelection.each(function (d) {
          var near = nearIds.has(d.id);
          d3.select(this).classed('is-emphasized', near).classed('is-dimmed', !near);
        });
      } else {
        linkSelection.classed('is-emphasized', false).classed('is-dimmed', false);
        nodeSelection.classed('is-emphasized', false).classed('is-dimmed', false);
      }
    }

    function onCursorUpdate() {
      if (!cursorPos) return;
      if (state === STATE.STRUCTURED) {
        updateEdgeVisibility(linkEls, nodeEls, true);
        return;
      }
      if (state === STATE.IDLE || state === STATE.PROXIMITY) {
        if (cursorInEngageZone()) {
          transitionToStructured();
        } else {
          state = STATE.PROXIMITY;
          sim.alphaTarget(0.12).restart();
          updateEdgeVisibility(linkEls, nodeEls, false);
        }
      }
    }

    function onCursorLeave() {
      cursorPos = null;
      if (leaveTimer) clearTimeout(leaveTimer);
      leaveTimer = setTimeout(function () {
        leaveTimer = null;
        if (state === STATE.STRUCTURED) {
          transitionToChaotic();
        } else if (state === STATE.PROXIMITY) {
          state = STATE.IDLE;
          sim.alphaTarget(0.06);
          updateEdgeVisibility(linkEls, nodeEls, false);
        }
      }, LEAVE_DELAY_MS);
    }

    container.addEventListener('mousemove', function (e) {
      var r = container.getBoundingClientRect();
      if (r.width < 10) return;
      cursorPos = {
        x: ((e.clientX - r.left) / r.width) * W,
        y: ((e.clientY - r.top) / r.height) * H
      };
      if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = null;
      }
      onCursorUpdate();
    });

    container.addEventListener('mouseleave', onCursorLeave);
  }

  function init() {
    var container = document.getElementById('systemDiagram');
    if (!container) return;

    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      W = Math.min(Math.max(rect.width, 400), 560);
      H = Math.min(Math.max(rect.height, 320), 430);
      PAD = Math.min(40, Math.floor(W * 0.08));
      INNER_W = W - PAD * 2;
      INNER_H = H - PAD * 2;
    }

    if (prefersReducedMotion) {
      renderStatic(container);
      return;
    }

    renderInteractive(container);
  }

  function tryInit() {
    var container = document.getElementById('systemDiagram');
    if (!container || container.getBoundingClientRect().width < 10) return false;
    init();
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () {
        if (!tryInit()) {
          var attempts = 0;
          var id = setInterval(function () {
            if (tryInit() || ++attempts > 25) clearInterval(id);
          }, 100);
        }
      }, 200);
    });
  } else {
    setTimeout(function () {
      if (!tryInit()) {
        var attempts = 0;
        var id = setInterval(function () {
          if (tryInit() || ++attempts > 25) clearInterval(id);
        }, 100);
      }
    }, 200);
  }
})();
