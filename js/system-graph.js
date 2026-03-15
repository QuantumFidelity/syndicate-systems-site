/**
 * Syndicate Systems — System Morph Engine
 * Chaotic distributed system → inspection → integrated structure → dissolve
 */

(function () {
  'use strict';

  var W = 540;
  var H = 400;
  var PAD = 56;
  var INNER_W = W - PAD * 2;
  var INNER_H = H - PAD * 2;
  var NODE_COUNT = 110;
  var K_NEIGHBORS = 4;
  var NODE_RADIUS = 2.25;
  var STATE = { CHAOS: 0, MORPHING: 1, STRUCTURED: 2, DISSOLVING: 3 };
  var MORPH_DURATION_MS = 850;
  var DISSOLVE_DURATION_MS = 900;
  var STRUCTURED_HOLD_MS = 2000;

  var nodes = [];
  var links = [];
  var linkForce = null;
  var sim = null;
  var state = STATE.CHAOS;
  var cursorPos = null;
  var shapeIndex = 0;
  var holdTimer = null;
  var prefersReducedMotion = false;

  /* Vector target maps — normalized 0–1; fixed coordinates (no procedural generation) */
  var shapeLibrary = {
    globe: (function () {
      var pts = [], cx = 0.5, cy = 0.5;
      for (var i = 0; i < 32; i++) {
        var a = (i / 32) * Math.PI * 2 - Math.PI / 2;
        pts.push({ x: cx + 0.43 * Math.cos(a), y: cy + 0.43 * Math.sin(a) });
      }
      for (var r = 0.08; r <= 0.38; r += 0.05) {
        for (var i = 0; i < 14; i++) {
          var a = (i / 14) * Math.PI * 2;
          pts.push({ x: cx + r * Math.cos(a), y: cy + r * 0.72 * Math.sin(a) });
        }
      }
      return pts;
    })(),
    jet: (function () {
      var pts = [];
      var nose = [{ x: 0.74, y: 0.5 }, { x: 0.7, y: 0.48 }, { x: 0.66, y: 0.465 }, { x: 0.62, y: 0.455 }];
      var body = [{ x: 0.58, y: 0.46 }, { x: 0.52, y: 0.475 }, { x: 0.46, y: 0.49 }, { x: 0.4, y: 0.505 }, { x: 0.34, y: 0.52 }, { x: 0.28, y: 0.53 }, { x: 0.22, y: 0.53 }, { x: 0.17, y: 0.51 }];
      var tail = [{ x: 0.13, y: 0.49 }];
      var wingL = [{ x: 0.48, y: 0.42 }, { x: 0.44, y: 0.38 }, { x: 0.42, y: 0.36 }, { x: 0.4, y: 0.38 }, { x: 0.38, y: 0.42 }];
      var wingR = [{ x: 0.48, y: 0.58 }, { x: 0.44, y: 0.62 }, { x: 0.42, y: 0.64 }, { x: 0.4, y: 0.62 }, { x: 0.38, y: 0.58 }];
      var cockpit = [{ x: 0.6, y: 0.47 }, { x: 0.56, y: 0.465 }];
      pts = pts.concat(nose, cockpit, body, tail, wingL, wingR);
      for (var i = 0; i < 5; i++) pts.push({ x: 0.5 + i * 0.04, y: 0.5 });
      for (var i = 0; i < 5; i++) pts.push({ x: 0.32 + i * 0.025, y: 0.51 + i * 0.005 });
      for (var s = 0; s < 3; s++) for (var t = 0; t < 15; t++) {
        var u = 0.2 + (t / 14) * 0.5, v = 0.38 + s * 0.08 + (t % 3) * 0.02;
        pts.push({ x: u, y: v });
      }
      return pts.slice(0, 110);
    })(),
    skyline: (function () {
      var pts = [], h = [0.25, 0.55, 0.38, 0.72, 0.48, 0.88, 0.62, 0.42, 0.78, 0.52, 0.68];
      for (var b = 0; b < 18; b++) {
        var bx = 0.06 + (b / 17) * 0.88, bh = h[b % h.length];
        for (var f = 0; f < 5; f++) pts.push({ x: bx + f * 0.012, y: 0.92 - bh * 0.48 });
      }
      return pts.slice(0, 110);
    })(),
    cpu: (function () {
      var pts = [], cx = 0.5, cy = 0.5, w = 0.36, h = 0.28;
      for (var i = 0; i < 14; i++) pts.push({ x: cx - w / 2 + (i / 13) * w, y: cy - h / 2 });
      for (var i = 0; i < 14; i++) pts.push({ x: cx + w / 2, y: cy - h / 2 + (i / 13) * h });
      for (var i = 0; i < 14; i++) pts.push({ x: cx + w / 2 - (i / 13) * w, y: cy + h / 2 });
      for (var i = 0; i < 14; i++) pts.push({ x: cx - w / 2, y: cy + h / 2 - (i / 13) * h });
      for (var r = 0; r < 4; r++) for (var c = 0; c < 5; c++)
        pts.push({ x: cx - 0.1 + c * 0.045, y: cy - 0.06 + r * 0.04 });
      for (var r = 0; r < 6; r++) for (var c = 0; c < 6; c++)
        pts.push({ x: cx - 0.08 + c * 0.032, y: cy - 0.04 + r * 0.024 });
      return pts.slice(0, 110);
    })(),
    satellite: (function () {
      var pts = [], cx = 0.5, cy = 0.5;
      pts.push({ x: cx, y: cy });
      for (var i = 0; i < 24; i++) {
        var a = (i / 24) * Math.PI * 2;
        pts.push({ x: cx + 0.41 * Math.cos(a), y: cy + 0.41 * Math.sin(a) });
      }
      for (var i = 0; i < 18; i++) {
        var a = (i / 18) * Math.PI * 2 + 0.15;
        pts.push({ x: cx + 0.26 * Math.cos(a), y: cy + 0.26 * Math.sin(a) });
      }
      for (var i = 0; i < 12; i++) {
        var a = (i / 12) * Math.PI * 2 + 0.4;
        pts.push({ x: cx + 0.12 * Math.cos(a), y: cy + 0.12 * Math.sin(a) });
      }
      for (var s = 0; s < 4; s++) for (var t = 0; t < 12; t++) {
        var a = (s / 4) * Math.PI * 2 + (t / 12) * 0.5;
        pts.push({ x: cx + (0.15 + t * 0.02) * Math.cos(a), y: cy + (0.15 + t * 0.02) * Math.sin(a) });
      }
      return pts.slice(0, 110);
    })(),
    mesh: (function () {
      var pts = [];
      for (var row = 0; row < 9; row++) {
        for (var col = 0; col < 11; col++) {
          pts.push({ x: 0.1 + (col / 10) * 0.8, y: 0.12 + (row / 8) * 0.76 });
        }
      }
      for (var i = 0; i < 12; i++) pts.push({ x: 0.15 + (i % 4) * 0.22, y: 0.2 + Math.floor(i / 4) * 0.25 });
      return pts.slice(0, 110);
    })()
  };

  var shapeKeys = Object.keys(shapeLibrary);

  function buildNodes() {
    var ids = [];
    for (var i = 0; i < NODE_COUNT; i++) ids.push('n' + i);
    nodes = ids.map(function (id, i) {
      var cx = 0.5, cy = 0.5;
      var r = 0.35 * (0.85 + Math.sin(i * 1.3) * 0.15);
      var a = (i / NODE_COUNT) * Math.PI * 2 - Math.PI / 2;
      return {
        id: id,
        x: PAD + INNER_W * (cx + Math.cos(a) * r),
        y: PAD + INNER_H * (cy + Math.sin(a) * r),
        vx: 0, vy: 0,
        fx: null, fy: null
      };
    });
  }

  function distSq(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function recomputeLinks() {
    var linkSet = {};
    function addLink(i, j) {
      if (i === j) return;
      var key = i < j ? i + '|' + j : j + '|' + i;
      linkSet[key] = true;
    }
    nodes.forEach(function (n, i) {
      var sorted = nodes.map(function (m, j) { return { j: j, d: distSq(n, m) }; });
      sorted.sort(function (a, b) { return a.d - b.d; });
      for (var k = 1; k <= K_NEIGHBORS && k < sorted.length; k++) addLink(i, sorted[k].j);
    });
    links = [];
    for (var key in linkSet) {
      var p = key.split('|');
      links.push({ source: nodes[+p[0]], target: nodes[+p[1]] });
    }
    if (linkForce) linkForce.links(links);
  }

  function linkKey(l) {
    var a = l.source.id || nodes.indexOf(l.source);
    var b = l.target.id || nodes.indexOf(l.target);
    var i = typeof a === 'number' ? a : parseInt(a.replace('n', ''), 10);
    var j = typeof b === 'number' ? b : parseInt(b.replace('n', ''), 10);
    return (i < j ? i + '|' + j : j + '|' + i);
  }

  function getShapeTargets(shapeKey) {
    var coords = shapeLibrary[shapeKey];
    if (!coords || coords.length === 0) return null;
    var targets = [];
    var xMin = PAD, yMin = PAD, xSpan = INNER_W, ySpan = INNER_H;
    for (var i = 0; i < Math.min(NODE_COUNT, coords.length); i++) {
      var c = coords[i];
      targets.push({
        x: xMin + c.x * xSpan,
        y: yMin + c.y * ySpan
      });
    }
    while (targets.length < NODE_COUNT && coords.length > 0) {
      var c = coords[targets.length % coords.length];
      targets.push({ x: xMin + c.x * xSpan, y: yMin + c.y * ySpan });
    }
    return targets;
  }

  function assignNodesToTargets(targets) {
    var used = {};
    var assignments = new Array(NODE_COUNT);
    for (var i = 0; i < NODE_COUNT; i++) {
      var bestJ = -1, bestD = Infinity;
      for (var j = 0; j < targets.length; j++) {
        if (used[j]) continue;
        var d = distSq(nodes[i], targets[j]);
        if (d < bestD) { bestD = d; bestJ = j; }
      }
      if (bestJ >= 0) {
        used[bestJ] = true;
        assignments[i] = targets[bestJ];
      } else assignments[i] = targets[i % targets.length];
    }
    return assignments;
  }

  function clampBounds() {
    var xMin = PAD, xMax = W - PAD, yMin = PAD, yMax = H - PAD;
    nodes.forEach(function (n) {
      if (n.fx != null) return;
      n.x = Math.max(xMin, Math.min(xMax, n.x));
      n.y = Math.max(yMin, Math.min(yMax, n.y));
      if (n.x <= xMin && n.vx < 0) n.vx = 0;
      if (n.x >= xMax && n.vx > 0) n.vx = 0;
      if (n.y <= yMin && n.vy < 0) n.vy = 0;
      if (n.y >= yMax && n.vy > 0) n.vy = 0;
    });
  }

  function renderStatic(container) {
    buildNodes();
    recomputeLinks();
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'system-graph__svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    links.forEach(function (l) {
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'system-graph__link');
      line.setAttribute('x1', l.source.x);
      line.setAttribute('y1', l.source.y);
      line.setAttribute('x2', l.target.x);
      line.setAttribute('y2', l.target.y);
      g.appendChild(line);
    });
    nodes.forEach(function (n) {
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('class', 'system-graph__node');
      c.setAttribute('r', NODE_RADIUS);
      c.setAttribute('cx', n.x);
      c.setAttribute('cy', n.y);
      g.appendChild(c);
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
    buildNodes();
    recomputeLinks();

    var svg = d3.select(container).append('svg')
      .attr('class', 'system-graph__svg')
      .attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    var clipInset = 2; /* trim stroke overflow at edges */
    svg.append('defs').append('clipPath').attr('id', 'system-graph-clip')
      .append('rect')
      .attr('x', PAD + clipInset).attr('y', PAD + clipInset)
      .attr('width', INNER_W - clipInset * 2).attr('height', INNER_H - clipInset * 2);
    var g = svg.append('g').attr('clip-path', 'url(#system-graph-clip)');
    var linkEls = g.selectAll('.system-graph__link').data(links, linkKey).enter().append('line').attr('class', 'system-graph__link');
    var nodeEls = g.selectAll('.system-graph__node').data(nodes).enter().append('circle').attr('class', 'system-graph__node').attr('r', NODE_RADIUS);

    function ticked() {
      clampBounds();
      linkEls.attr('x1', function (d) { return d.source.x; }).attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; }).attr('y2', function (d) { return d.target.y; });
      nodeEls.attr('cx', function (d) { return d.x; }).attr('cy', function (d) { return d.y; });
    }

    function driftForce(alpha) {
      if (state !== STATE.CHAOS) return;
      nodes.forEach(function (n) {
        if (n.fx != null) return;
        n.vx += (Math.random() - 0.5) * 0.05;
        n.vy += (Math.random() - 0.5) * 0.05;
      });
    }

    var cx = W / 2, cy = H / 2;
    linkForce = d3.forceLink(links).id(function (d) { return d.id; }).distance(18);
    sim = d3.forceSimulation(nodes)
      .force('link', linkForce)
      .force('charge', d3.forceManyBody().strength(-2).distanceMax(100))
      .force('center', d3.forceCenter(cx, cy))
      .force('x', d3.forceX(cx).strength(0.25))
      .force('y', d3.forceY(cy).strength(0.25))
      .force('collision', d3.forceCollide().radius(3))
      .force('drift', driftForce)
      .alphaDecay(0.015)
      .velocityDecay(0.35)
      .alphaTarget(0.04)
      .on('tick', ticked);

    ticked();

    function transitionToShape() {
      if (state === STATE.MORPHING || state === STATE.STRUCTURED) return;
      state = STATE.MORPHING;
      sim.stop();
      nodeEls.interrupt();
      linkEls.interrupt();

      var key = shapeKeys[shapeIndex % shapeKeys.length];
      shapeIndex++;
      var targets = getShapeTargets(key);
      if (!targets || targets.length === 0) { state = STATE.CHAOS; sim.alpha(0.1).restart(); return; }
      var assignments = assignNodesToTargets(targets);

      nodes.forEach(function (n, i) {
        var t = assignments[i];
        n.fx = t.x;
        n.fy = t.y;
      });

      var tr = d3.transition().duration(MORPH_DURATION_MS).ease(d3.easeCubicInOut);
      nodeEls.transition(tr).attr('cx', function (d) { return d.fx; }).attr('cy', function (d) { return d.fy; });
      linkEls.transition(tr)
        .attr('x1', function (d) { return d.source.fx; }).attr('y1', function (d) { return d.source.fy; })
        .attr('x2', function (d) { return d.target.fx; }).attr('y2', function (d) { return d.target.fy; })
        .on('end', function () {
          nodes.forEach(function (n) { n.x = n.fx; n.y = n.fy; });
          recomputeLinks();
          linkEls = g.selectAll('.system-graph__link').data(links, linkKey);
          linkEls.exit().remove();
          linkEls = linkEls.enter().append('line').attr('class', 'system-graph__link').merge(linkEls)
            .attr('x1', function (d) { return d.source.x; }).attr('y1', function (d) { return d.source.y; })
            .attr('x2', function (d) { return d.target.x; }).attr('y2', function (d) { return d.target.y; });
          state = STATE.STRUCTURED;
          if (holdTimer) clearTimeout(holdTimer);
          holdTimer = setTimeout(transitionToChaos, STRUCTURED_HOLD_MS);
        });
    }

    function transitionToChaos() {
      holdTimer = null;
      if (state !== STATE.STRUCTURED && state !== STATE.MORPHING) return;
      state = STATE.DISSOLVING;
      nodeEls.interrupt();
      linkEls.interrupt();

      var cx = W / 2, cy = H / 2, r = Math.min(INNER_W, INNER_H) * 0.36;
      nodes.forEach(function (n, i) {
        n.fx = null;
        n.fy = null;
        var a = (i / NODE_COUNT) * Math.PI * 2 - Math.PI / 2;
        var jitter = 0.82 + Math.sin(i * 2.1) * 0.18;
        n.targetX = cx + Math.cos(a) * r * jitter;
        n.targetY = cy + Math.sin(a) * r * jitter;
      });

      recomputeLinks();
      linkEls = g.selectAll('.system-graph__link').data(links, linkKey);
      linkEls.exit().remove();
      linkEls = linkEls.enter().append('line').attr('class', 'system-graph__link').merge(linkEls)
        .attr('x1', function (d) { return d.source.x; }).attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; }).attr('y2', function (d) { return d.target.y; });

      var tr = d3.transition().duration(DISSOLVE_DURATION_MS).ease(d3.easeCubicInOut);
      nodeEls.transition(tr).attr('cx', function (d) { return d.targetX; }).attr('cy', function (d) { return d.targetY; });
      linkEls.transition(tr)
        .attr('x1', function (d) { return d.source.targetX != null ? d.source.targetX : d.source.x; })
        .attr('y1', function (d) { return d.source.targetY != null ? d.source.targetY : d.source.y; })
        .attr('x2', function (d) { return d.target.targetX != null ? d.target.targetX : d.target.x; })
        .attr('y2', function (d) { return d.target.targetY != null ? d.target.targetY : d.target.y; })
        .on('end', function () {
          nodes.forEach(function (n) {
            n.x = n.targetX;
            n.y = n.targetY;
            n.targetX = n.targetY = undefined;
            n.vx = n.vy = 0;
          });
          state = STATE.CHAOS;
          updateLinkSelection();
          sim.alpha(0.06).restart();
        });

      function updateLinkSelection() {
        linkEls = g.selectAll('.system-graph__link').data(links, linkKey);
        linkEls.exit().remove();
        linkEls = linkEls.enter().append('line').attr('class', 'system-graph__link').merge(linkEls)
          .attr('x1', function (d) { return d.source.x; }).attr('y1', function (d) { return d.source.y; })
          .attr('x2', function (d) { return d.target.x; }).attr('y2', function (d) { return d.target.y; });
      }
    }

    container.addEventListener('mouseenter', function () {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
      if (state === STATE.CHAOS) transitionToShape();
    });

    container.addEventListener('mouseleave', function () {
      /* Only cancel hold; morph continues if already started */
      if (holdTimer && state === STATE.STRUCTURED) {
        clearTimeout(holdTimer);
        holdTimer = null;
        transitionToChaos();
      }
    });
  }

  function init() {
    var container = document.getElementById('systemDiagram');
    if (!container) return;
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      W = Math.min(Math.max(rect.width, 200), 560);
      H = Math.min(Math.max(rect.height, 200), 430);
      PAD = Math.max(52, Math.min(64, Math.floor(W * 0.11)));
      INNER_W = W - PAD * 2;
      INNER_H = H - PAD * 2;
    }
    if (prefersReducedMotion) { renderStatic(container); return; }
    renderInteractive(container);

    if (typeof ResizeObserver !== 'undefined') {
      var lastW = rect.width, lastH = rect.height;
      var ro = new ResizeObserver(function () {
        var r = container.getBoundingClientRect();
        if (r.width > 10 && r.height > 10 && (Math.abs(r.width - lastW) > 5 || Math.abs(r.height - lastH) > 5)) {
          lastW = r.width; lastH = r.height;
          init();
        }
      });
      ro.observe(container);
    }
  }

  function tryInit() {
    var container = document.getElementById('systemDiagram');
    if (!container || container.getBoundingClientRect().width < 10) return false;
    init();
    return true;
  }

  function scheduleInit() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(runInit, 200);
      });
    } else {
      setTimeout(runInit, 200);
    }
  }

  function runInit() {
    if (!tryInit()) {
      var attempts = 0;
      var id = setInterval(function () { if (tryInit() || ++attempts > 25) clearInterval(id); }, 100);
    } else {
      var container = document.getElementById('systemDiagram');
      if (container && typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(function () {
          var r = container.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { init(); }
        });
        ro.observe(container);
      }
    }
  }

  scheduleInit();
})();
