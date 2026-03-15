/**
 * Syndicate Systems — System Morph Engine
 * Dense chaotic field → engineered holographic structures → dissolve
 * Complexity → analysis → structure → integration
 */

(function () {
  'use strict';

  var W = 540;
  var H = 400;
  var PAD = 48;
  var INNER_W = 0;
  var INNER_H = 0;
  var POINT_COUNT = 650;
  var CONTOUR_RATIO = 0.45;
  var INTERIOR_RATIO = 0.35;
  var AMBIENT_RATIO = 0.2;
  var STRUCTURE_RATIO = CONTOUR_RATIO + INTERIOR_RATIO;
  var K_EDGES_IDLE_MIN = 1;
  var K_EDGES_IDLE_MAX = 2;
  var K_EDGES_RESOLVED_MIN = 2;
  var K_EDGES_RESOLVED_MAX = 3;
  var EDGE_DISTANCE_THRESHOLD = 65;
  var POINT_RADIUS = 2.0;
  var AMBIENT_OPACITY = 0.22;
  var AMBIENT_POINT_SCALE = 0.7;
  var PERSPECTIVE = 0.4;
  var STATE = {
    CHAOS: 0,
    TIGHTENING: 1,
    MORPHING: 2,
    SETTLING: 3,
    STRUCTURED: 4,
    DISSOLVING: 5
  };
  var TIGHTEN_MS = 150;
  var MORPH_MS = 800;
  var SETTLE_MS = 200;
  var HOLD_MS = 2000;
  var DISSOLVE_MS = 1000;
  var IDLE_DRIFT_MAX = 0.012;
  var STRUCTURE_MOTION_MAX = 0.006;

  var points = [];
  var edges = [];
  var state = STATE.CHAOS;
  var shapeIndex = 0;
  var holdTimer = null;
  var rafId = null;
  var canvas = null;
  var ctx = null;
  var time = 0;
  var currentShape = null;
  var morphPhaseStart = 0;

  /* 3D coordinate maps — normalized -0.5 to 0.5, volumetric structure */
  var shapeLibrary = {
    jet: (function () {
      var pts = [];
      for (var t = 0; t < 24; t++) {
        var u = t / 23;
        var nose = 1 - Math.pow(1 - u, 2);
        var tail = u * u * 0.3;
        var x = -0.42 + u * 0.88;
        var y = 0.04 * Math.sin(u * Math.PI) - 0.02 * nose;
        var z = 0.03 * (1 - 2 * (u - 0.5) * (u - 0.5));
        pts.push({ x: x, y: y, z: z });
      }
      for (var s = 0; s < 12; s++) {
        var wx = -0.15 + (s / 11) * 0.55;
        pts.push({ x: wx, y: -0.13, z: 0.06 });
        pts.push({ x: wx, y: 0.13, z: 0.06 });
        pts.push({ x: wx + 0.02, y: -0.15, z: 0.02 });
        pts.push({ x: wx + 0.02, y: 0.15, z: 0.02 });
      }
      for (var t = 0; t < 8; t++) {
        var tx = -0.38 + (t / 7) * 0.18;
        pts.push({ x: tx, y: 0, z: -0.06 });
      }
      for (var i = 0; i < 16; i++) {
        pts.push({
          x: 0.32 + 0.04 * Math.cos(i * 0.4),
          y: 0.02 * Math.sin(i * 0.7),
          z: 0.03
        });
      }
      for (var r = 0; r < 3; r++) {
        for (var c = 0; c < 6; c++) {
          pts.push({
            x: -0.1 + c * 0.04,
            y: -0.06 + r * 0.06,
            z: 0.04 + r * 0.01
          });
        }
      }
      return pts;
    })(),
    globe: (function () {
      var pts = [];
      for (var i = 0; i < 20; i++) {
        var lon = (i / 20) * Math.PI * 2;
        for (var j = 0; j < 10; j++) {
          var lat = (j / 10) * Math.PI - Math.PI / 2;
          var r = 0.4;
          pts.push({
            x: r * Math.cos(lat) * Math.cos(lon),
            y: r * Math.sin(lat),
            z: r * Math.cos(lat) * Math.sin(lon)
          });
        }
      }
      for (var r = 0.12; r <= 0.36; r += 0.04) {
        for (var i = 0; i < 14; i++) {
          var a = (i / 14) * Math.PI * 2;
          pts.push({
            x: r * 0.72 * Math.cos(a),
            y: 0,
            z: r * Math.sin(a)
          });
        }
      }
      for (var j = 0; j < 6; j++) {
        var lat = (j / 5) * Math.PI - Math.PI / 2;
        if (Math.abs(Math.sin(lat)) > 0.3) continue;
        for (var i = 0; i < 12; i++) {
          var lon = (i / 12) * Math.PI * 2;
          pts.push({
            x: 0.36 * Math.cos(lat) * Math.cos(lon),
            y: 0.36 * Math.sin(lat),
            z: 0.36 * Math.cos(lat) * Math.sin(lon)
          });
        }
      }
      return pts;
    })(),
    turbine: (function () {
      var pts = [];
      for (var i = 0; i < 16; i++) {
        var a = (i / 16) * Math.PI * 2;
        pts.push({ x: 0.055 * Math.cos(a), y: 0.055 * Math.sin(a), z: 0 });
      }
      for (var b = 0; b < 16; b++) {
        var angle = (b / 16) * Math.PI * 2;
        for (var s = 0; s < 7; s++) {
          var rad = 0.06 + (s / 6) * 0.3;
          pts.push({
            x: rad * Math.cos(angle),
            y: rad * Math.sin(angle),
            z: 0.015 * (s % 2) - 0.008
          });
          if (s > 0) pts.push({
            x: rad * 0.92 * Math.cos(angle + 0.04),
            y: rad * 0.92 * Math.sin(angle + 0.04),
            z: -0.015
          });
        }
      }
      for (var r = 0.12; r <= 0.36; r += 0.06) {
        for (var i = 0; i < 20; i++) {
          var a = (i / 20) * Math.PI * 2;
          pts.push({
            x: r * Math.cos(a),
            y: r * Math.sin(a),
            z: 0.02 + (r > 0.25 ? 0.01 : 0)
          });
        }
      }
      for (var i = 0; i < 28; i++) {
        var a = (i / 28) * Math.PI * 2;
        pts.push({ x: 0.38 * Math.cos(a), y: 0.38 * Math.sin(a), z: 0.025 });
      }
      pts.push({ x: 0, y: 0, z: 0 });
      return pts;
    })(),
    geometry: (function () {
      var pts = [];
      for (var row = 0; row < 11; row++) {
        for (var col = 0; col < 11; col++) {
          var u = (col / 10) * 0.76 - 0.38;
          var v = (row / 10) * 0.76 - 0.38;
          var jitter = Math.sin(row * 1.3) * Math.cos(col * 0.9) * 0.02;
          pts.push({
            x: u + jitter,
            y: v - jitter * 0.5,
            z: (Math.sin(row * 0.5) * Math.cos(col * 0.5)) * 0.08
          });
        }
      }
      for (var i = 0; i < 8; i++) {
        var a = (i / 8) * Math.PI * 2;
        for (var r = 0; r < 6; r++) {
          var rad = 0.1 + (r / 5) * 0.32;
          pts.push({
            x: rad * Math.cos(a),
            y: rad * Math.sin(a),
            z: 0.04 * (i % 2)
          });
        }
      }
      for (var i = 0; i < 6; i++) {
        var cx = 0.25 * Math.cos((i / 6) * Math.PI * 2);
        var cy = 0.25 * Math.sin((i / 6) * Math.PI * 2);
        for (var j = 0; j < 5; j++) {
          pts.push({
            x: cx + (j - 2) * 0.06,
            y: cy,
            z: 0.02
          });
        }
      }
      return pts;
    })()
  };

  var shapeKeys = Object.keys(shapeLibrary);

  function project(p) {
    var pf = PERSPECTIVE * 2;
    var sx = p.x + p.z * pf;
    var sy = p.y - p.z * pf * 0.5;
    var scale = 1 - p.z * 0.3;
    return {
      x: sx,
      y: sy,
      depth: p.z,
      scale: Math.max(0.5, scale)
    };
  }

  function toScreen(proj) {
    var sx = (proj.x * 0.9 + 0.5) * INNER_W + PAD;
    var sy = (0.5 - proj.y * 0.9) * INNER_H + PAD;
    return { sx: sx, sy: sy, scale: proj.scale, depth: proj.depth };
  }

  function distSq3(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }

  function distSq2(pa, pb) {
    var dx = pa.sx - pb.sx, dy = pa.sy - pb.sy;
    return dx * dx + dy * dy;
  }

  function dist2(pa, pb) {
    return Math.sqrt(distSq2(pa, pb));
  }

  function isStructurePoint(p) {
    return p.morphRole === 'contour' || p.morphRole === 'interior';
  }

  function buildDistributedAnchors() {
    var anchors = [];
    var span = 0.75;
    var cols = 14;
    var rows = 10;
    for (var i = 0; i < POINT_COUNT; i++) {
      var u = (i / POINT_COUNT) * Math.PI * 2 - Math.PI;
      var v = Math.sin(i * 1.7) * 0.35;
      var r = 0.2 + (i % 7) / 7 * 0.4;
      var ax = Math.cos(u) * r * span * (0.92 + Math.sin(i * 0.5) * 0.08);
      var ay = Math.sin(u) * r * span * 0.88 * (0.92 + Math.cos(i * 0.7) * 0.08);
      var az = (Math.sin(i * 1.3) * 0.4 + v) * 0.4;
      anchors.push({ x: ax, y: ay, z: az });
    }
    return anchors;
  }

  function buildChaosField() {
    var anchors = buildDistributedAnchors();
    var contourCount = Math.floor(POINT_COUNT * CONTOUR_RATIO);
    var interiorCount = Math.floor(POINT_COUNT * INTERIOR_RATIO);
    points = [];
    for (var i = 0; i < POINT_COUNT; i++) {
      var a = anchors[i];
      var role = i < contourCount ? 'contour' : (i < contourCount + interiorCount ? 'interior' : 'ambient');
      points.push({
        x: a.x,
        y: a.y,
        z: a.z,
        ax: a.x,
        ay: a.y,
        az: a.z,
        vx: (Math.sin(i * 0.7) - 0.5) * 0.0004,
        vy: (Math.cos(i * 0.9) - 0.5) * 0.0004,
        vz: (Math.sin(i * 1.1) - 0.5) * 0.0002,
        morphRole: role,
        tx: null,
        ty: null,
        tz: null
      });
    }
  }


  function recomputeEdges(projected, structured) {
    var edgeSet = {};
    var kMin = structured ? K_EDGES_RESOLVED_MIN : K_EDGES_IDLE_MIN;
    var kMax = structured ? K_EDGES_RESOLVED_MAX : K_EDGES_IDLE_MAX;
    var k = kMin + Math.floor((time * 10) % (kMax - kMin + 1));
    if (k > kMax) k = kMax;
    for (var i = 0; i < projected.length; i++) {
      var pi = projected[i];
      var sorted = [];
      for (var j = 0; j < projected.length; j++) {
        if (i === j) continue;
        var d = dist2(pi, projected[j]);
        if (d < EDGE_DISTANCE_THRESHOLD) {
          sorted.push({ j: j, d: d * d });
        }
      }
      sorted.sort(function (a, b) { return a.d - b.d; });
      for (var n = 0; n < k && n < sorted.length; n++) {
        var j = sorted[n].j;
        var key = i < j ? i + '|' + j : j + '|' + i;
        edgeSet[key] = true;
      }
    }
    edges = [];
    for (var key in edgeSet) {
      var p = key.split('|');
      edges.push({ a: +p[0], b: +p[1] });
    }
  }

  function getShapeTargets(shapeKey) {
    var coords = shapeLibrary[shapeKey];
    if (!coords || coords.length === 0) return null;
    var structureCount = Math.floor(POINT_COUNT * STRUCTURE_RATIO);
    var targets = [];
    for (var i = 0; i < structureCount; i++) {
      var c = coords[i % coords.length];
      targets.push({ x: c.x, y: c.y, z: c.z });
    }
    return targets;
  }

  function isStructurePoint(p) { return p.morphRole === 'contour' || p.morphRole === 'interior'; }

  function assignStructurePointsToTargets(targets) {
    var structurePoints = points.filter(isStructurePoint);
    var used = {};
    var assignments = {};
    for (var i = 0; i < structurePoints.length; i++) {
      var pi = structurePoints[i];
      var bestJ = -1, bestD = Infinity;
      for (var j = 0; j < targets.length; j++) {
        if (used[j]) continue;
        var d = distSq3(pi, targets[j]);
        if (d < bestD) { bestD = d; bestJ = j; }
      }
      if (bestJ >= 0) {
        used[bestJ] = true;
        assignments[points.indexOf(pi)] = targets[bestJ];
      } else {
        assignments[points.indexOf(pi)] = targets[i % targets.length];
      }
    }
    return assignments;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function getEdgeOpacity() {
    return (state === STATE.STRUCTURED || state === STATE.SETTLING) ? 0.24 : 0.18;
  }

  function draw() {
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    var projected = [];
    for (var i = 0; i < points.length; i++) {
      var p = project(points[i]);
      var s = toScreen(p);
      projected.push({
        sx: s.sx,
        sy: s.sy,
        scale: s.scale,
        depth: s.depth,
        idx: i
      });
    }
    projected.sort(function (a, b) { return a.depth - b.depth; });
    recomputeEdges(projected, state === STATE.STRUCTURED);

    var baseEdgeOpacity = getEdgeOpacity();
    ctx.lineWidth = 1;
    edges.forEach(function (e) {
      var pa = projected[e.a];
      var pb = projected[e.b];
      if (pa && pb) {
        var depthFactorA = (pa.depth + 0.5);
        var depthFactorB = (pb.depth + 0.5);
        var edgeDepthFade = 0.6 + 0.4 * Math.max(depthFactorA, depthFactorB);
        ctx.strokeStyle = 'rgba(74, 74, 74, ' + (baseEdgeOpacity * edgeDepthFade) + ')';
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }
    });

    projected.forEach(function (proj) {
      var pt = points[proj.idx];
      var depthFactor = (proj.depth + 0.5);
      var opacity, sizeMult;
      if (pt.morphRole === 'ambient') {
        opacity = AMBIENT_OPACITY;
        sizeMult = AMBIENT_POINT_SCALE;
      } else {
        opacity = 0.28 + 0.16 * depthFactor;
        sizeMult = 0.88 + 0.24 * depthFactor;
      }
      var r = Math.max(1.0, POINT_RADIUS * proj.scale * sizeMult);
      ctx.fillStyle = 'rgba(74, 74, 74, ' + opacity + ')';
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function applyIdleDrift(ambientOnly) {
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (ambientOnly && p.morphRole !== 'ambient') continue;
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vx += (Math.sin(time + i * 0.1) * 0.0002);
      p.vy += (Math.cos(time * 0.9 + i * 0.07) * 0.0002);
      p.vz += (Math.sin(time * 0.8 + i * 0.05) * 0.0001);
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.vz *= 0.97;
      var dx = p.x - p.ax, dy = p.y - p.ay, dz = p.z - p.az;
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > IDLE_DRIFT_MAX) {
        var s = IDLE_DRIFT_MAX / dist;
        p.x = p.ax + dx * s;
        p.y = p.ay + dy * s;
        p.z = p.az + dz * s;
      }
    }
  }

  function applyAmbientDrift() {
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (p.morphRole !== 'ambient') continue;
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vx += (Math.sin(time + i * 0.1) * 0.0002);
      p.vy += (Math.cos(time * 0.9 + i * 0.07) * 0.0002);
      p.vz += (Math.sin(time * 0.8 + i * 0.05) * 0.0001);
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.vz *= 0.97;
      var dx = p.x - p.ax, dy = p.y - p.ay, dz = p.z - p.az;
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > IDLE_DRIFT_MAX) {
        var s = IDLE_DRIFT_MAX / dist;
        p.x = p.ax + dx * s;
        p.y = p.ay + dy * s;
        p.z = p.az + dz * s;
      }
    }
  }

  function applyStructureMotion() {
    var phase = time * 0.25;
    if (currentShape === 'jet') {
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (p.morphRole === 'ambient') continue;
        p.y += Math.sin(time + p.x * 8) * STRUCTURE_MOTION_MAX * 0.4;
        p.z += Math.cos(time * 0.8 + p.x * 6) * STRUCTURE_MOTION_MAX * 0.3;
      }
    } else if (currentShape === 'globe') {
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (p.morphRole === 'ambient') continue;
        var ax = p.x, az = p.z;
        p.x = ax * Math.cos(phase * 0.08) - az * Math.sin(phase * 0.08);
        p.z = ax * Math.sin(phase * 0.08) + az * Math.cos(phase * 0.08);
        p.y += Math.sin(time + p.z * 10) * STRUCTURE_MOTION_MAX * 0.2;
      }
    } else if (currentShape === 'turbine') {
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (p.morphRole === 'ambient') continue;
        var r = Math.sqrt(p.x * p.x + p.y * p.y);
        if (r < 0.03) continue;
        var a = Math.atan2(p.y, p.x);
        var bladeSpeed = 0.018;
        p.x = r * Math.cos(a + phase * bladeSpeed);
        p.y = r * Math.sin(a + phase * bladeSpeed);
      }
    } else if (currentShape === 'geometry') {
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (p.morphRole === 'ambient') continue;
        var breath = Math.sin(time * 0.6 + p.x * 4) * STRUCTURE_MOTION_MAX;
        p.z += breath;
      }
    }
  }

  function drawFrame() {
    time += 0.016;

    if (state === STATE.CHAOS) {
      applyIdleDrift();
    } else if (state === STATE.STRUCTURED || state === STATE.SETTLING) {
      applyStructureMotion();
      applyAmbientDrift();
    }

    draw();
    rafId = requestAnimationFrame(drawFrame);
  }

  function runTighten(assignments, onComplete) {
    state = STATE.TIGHTENING;
    var startTime = performance.now();
    function step() {
      var elapsed = performance.now() - startTime;
      var t = Math.min(1, elapsed / TIGHTEN_MS);
      t = easeInOutCubic(t);
      var cx = 0, cy = 0, cz = 0;
      var sc = 0;
      points.forEach(function (p) {
        if ((p.morphRole === 'contour' || p.morphRole === 'interior') && assignments[points.indexOf(p)]) {
          var tg = assignments[points.indexOf(p)];
          cx += tg.x;
          cy += tg.y;
          cz += tg.z;
          sc++;
        }
      });
      if (sc > 0) {
        cx /= sc;
        cy /= sc;
        cz /= sc;
      }
      points.forEach(function (p) {
        if ((p.morphRole === 'contour' || p.morphRole === 'interior') && assignments[points.indexOf(p)]) {
          var tg = assignments[points.indexOf(p)];
          p.x = lerp(p.x, lerp(p.x, cx, 0.08), t);
          p.y = lerp(p.y, lerp(p.y, cy, 0.08), t);
          p.z = lerp(p.z, lerp(p.z, cz, 0.08), t);
        }
      });
      if (t >= 1) {
        onComplete();
      } else {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function runMorph(assignments, onComplete) {
    state = STATE.MORPHING;
    var startTime = performance.now();
    function step() {
      var elapsed = performance.now() - startTime;
      var t = Math.min(1, elapsed / MORPH_MS);
      var tGlobal = easeInOutCubic(t);
      points.forEach(function (p) {
        if ((p.morphRole === 'contour' || p.morphRole === 'interior')) {
          var idx = points.indexOf(p);
          var tg = assignments[idx];
          if (tg) {
            var tAnim = p.morphRole === 'contour'
              ? easeInOutCubic(Math.min(1, t * 1.5))
              : easeInOutCubic(Math.max(0, (t - 0.2) / 0.8));
            p.x = lerp(p.x, tg.x, tAnim);
            p.y = lerp(p.y, tg.y, tAnim);
            p.z = lerp(p.z, tg.z, tAnim);
          }
        }
      });
      if (t >= 1) {
        onComplete();
      } else {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function runSettle(onComplete) {
    state = STATE.SETTLING;
    setTimeout(onComplete, SETTLE_MS);
  }

  function transitionToShape() {
    if (state === STATE.MORPHING || state === STATE.STRUCTURED || state === STATE.TIGHTENING || state === STATE.SETTLING) return;
    var key = shapeKeys[shapeIndex % shapeKeys.length];
    shapeIndex++;
    currentShape = key;
    var targets = getShapeTargets(key);
    if (!targets || targets.length === 0) {
      state = STATE.CHAOS;
      return;
    }
    var assignments = assignStructurePointsToTargets(targets);
    runTighten(assignments, function () {
      runMorph(assignments, function () {
        runSettle(function () {
          state = STATE.STRUCTURED;
          if (holdTimer) clearTimeout(holdTimer);
          holdTimer = setTimeout(transitionToChaos, HOLD_MS);
        });
      });
    });
  }

  function transitionToChaos() {
    holdTimer = null;
    if (state !== STATE.STRUCTURED && state !== STATE.SETTLING) return;
    state = STATE.DISSOLVING;
    currentShape = null;
    var anchors = buildDistributedAnchors();
    var structureCount = Math.floor(POINT_COUNT * STRUCTURE_RATIO);
    var startTime = performance.now();
    function dissolveStep() {
      var elapsed = performance.now() - startTime;
      var t = Math.min(1, elapsed / DISSOLVE_MS);
      t = easeInOutCubic(t);
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var a = anchors[i];
        if ((p.morphRole === 'contour' || p.morphRole === 'interior')) {
          p.x = lerp(p.x, a.x, t);
          p.y = lerp(p.y, a.y, t);
          p.z = lerp(p.z, a.z, t);
        }
      }
      if (t >= 1) {
        state = STATE.CHAOS;
        for (var i = 0; i < points.length; i++) {
          points[i].vx = (Math.sin(i * 0.7) - 0.5) * 0.0004;
          points[i].vy = (Math.cos(i * 0.9) - 0.5) * 0.0004;
          points[i].vz = (Math.sin(i * 1.1) - 0.5) * 0.0002;
        }
      } else {
        requestAnimationFrame(dissolveStep);
      }
    }
    requestAnimationFrame(dissolveStep);
  }

  function render(container) {
    container.innerHTML = '';
    canvas = document.createElement('canvas');
    canvas.setAttribute('class', 'hologram-morph__canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');
    container.appendChild(canvas);
    buildChaosField();
    drawFrame();
    container.addEventListener('mouseenter', function () {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (state === STATE.CHAOS) transitionToShape();
    });
    container.addEventListener('mouseleave', function () {
      if (holdTimer && (state === STATE.STRUCTURED || state === STATE.SETTLING)) {
        clearTimeout(holdTimer);
        holdTimer = null;
        transitionToChaos();
      }
    });
  }

  function init() {
    var container = document.getElementById('systemDiagram');
    if (!container) return;
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      W = Math.min(Math.max(rect.width, 300), 600);
      H = Math.min(Math.max(rect.height, 250), 450);
      PAD = Math.max(36, Math.min(56, Math.floor(W * 0.1)));
      INNER_W = W - PAD * 2;
      INNER_H = H - PAD * 2;
      if (canvas) {
        canvas.width = W;
        canvas.height = H;
      }
    }
    if (prefersReducedMotion) {
      container.innerHTML = '<div class="hologram-morph__static" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(74,74,74,0.4);font-size:0.75rem;letter-spacing:0.06em;">Structure within complexity</div>';
      return;
    }
    if (rafId) cancelAnimationFrame(rafId);
    render(container);
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
            if (tryInit() || ++attempts > 30) clearInterval(id);
          }, 100);
        }
      }, 150);
    });
  } else {
    setTimeout(function () {
      if (!tryInit()) {
        var attempts = 0;
        var id = setInterval(function () {
          if (tryInit() || ++attempts > 30) clearInterval(id);
        }, 100);
      }
    }, 150);
  }

  if (typeof ResizeObserver !== 'undefined') {
    setTimeout(function () {
      var container = document.getElementById('systemDiagram');
      if (container) {
        var ro = new ResizeObserver(function () {
          var r = container.getBoundingClientRect();
          if (r.width > 10 && r.height > 10) init();
        });
        ro.observe(container);
      }
    }, 500);
  }
})();
