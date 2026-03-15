/**
 * Syndicate Systems — System Morph Engine
 * Living systems field → interrogation → engineered holographic objects → dissolve
 * Corrective rebuild: no static zones, strong cursor influence, clear object forms.
 */

(function () {
  'use strict';

  var W = 540, H = 400, PAD = 24, INNER_W = 0, INNER_H = 0;
  var PANEL_W = 0, PANEL_H = 0;
  var FIELD_RADIUS = 0.46;
  var NORM_SCALE = 0.96;
  var CLUSTER_BUST_INTERVAL = 180;
  var CLUSTER_DENSITY_THRESHOLD = 0.32;
  var POINT_COUNT = 750;
  var CONTOUR_RATIO = 0.42, INTERIOR_RATIO = 0.38, AMBIENT_RATIO = 0.2;
  var STRUCTURE_RATIO = CONTOUR_RATIO + INTERIOR_RATIO;
  var K_EDGES_IDLE = 1, K_EDGES_RESOLVED = 2, EDGE_DISTANCE_THRESHOLD = 55;
  var POINT_RADIUS = 2.0, AMBIENT_OPACITY = 0.18, AMBIENT_POINT_SCALE = 0.65;
  var PERSPECTIVE = 0.5;
  var STATE = { CHAOS: 0, TIGHTENING: 1, MORPHING: 2, SETTLING: 3, STRUCTURED: 4, DISSOLVING: 5 };
  var TIGHTEN_MS = 200, MORPH_MS = 850, SETTLE_MS = 180, HOLD_MS = 2200, DISSOLVE_MS = 1000;
  var IDLE_DRIFT_MAX = 0.022;
  var ANCHOR_DRIFT_SPEED = 0.00014;
  var STRUCTURE_MOTION_MAX = 0.005;
  var CURSOR_INFLUENCE_RADIUS = 0.65;
  var CURSOR_ATTRACTION = 0.055;
  var CURSOR_DISPLACEMENT_CAP = 0.008;
  var CURSOR_DAMPING = 0.88;
  var CURSOR_EDGE_BOOST = 0.35;
  var CURSOR_EDGE_RADIUS_PX = 90;
  var HOVER_TO_MORPH_MS = 500;
  var CLUSTER_BUST_FRAMES = 180;
  var GLOBE_SHELL_RADIUS = 0.4;
  var GLOBE_ROT_SPEED = 0.32;
  var GLOBE_INTERIOR_MAX_R = 0.28;
  var clusterBustCounter = 0;
  var quadrantCounts = [0, 0, 0, 0];

  var points = [], edges = [], anchors = [], state = STATE.CHAOS, shapeIndex = 0, holdTimer = null;
  var rafId = null, canvas = null, ctx = null, time = 0, currentShape = null;
  var cursorNorm = null;
  var hoverElapsed = 0;
  var isPointerIn = false;

  function noise1(i, t) {
    var s = Math.sin(i * 12.9898 + t * 0.5) * 43758.5453;
    return s - Math.floor(s);
  }
  function noise2(i, t, o) {
    return noise1(i + o * 100, t + o * 0.3);
  }

  var shapeLibrary = (function () {
    function jetPoints() {
      var contour = [], interior = [];
      var jetEdges = [];
      var idx = 0;
      function pt(x, y, z, part, seq) {
        contour.push({ x: x, y: y, z: z || 0, jetPart: part, jetSeq: seq, jetIdx: idx });
        return idx++;
      }
      function gridEdges(start, nU, nV) {
        for (var v = 0; v < nV; v++) {
          for (var u = 0; u < nU; u++) {
            var i = start + v * nU + u;
            if (u < nU - 1) jetEdges.push([i, i + 1]);
            if (v < nV - 1) jetEdges.push([i, i + nU]);
          }
        }
      }
      var nLen = 20, nRad = 14;
      var x0 = -0.48, x1 = 0.44;
      for (var ul = 0; ul < nLen; ul++) {
        var t = ul / (nLen - 1);
        var x = x0 + t * (x1 - x0);
        var r = 0.008 + 0.05 * Math.sin(t * Math.PI) * (t < 0.12 ? t / 0.12 : (t > 0.82 ? (1 - t) / 0.18 : 1));
        if (t > 0.22 && t < 0.38) r *= 1.18;
        for (var th = 0; th < nRad; th++) {
          var theta = (th / nRad) * Math.PI * 2;
          var y = r * Math.cos(theta);
          var z = r * Math.sin(theta);
          pt(x, y, z, 'fuselage', 0);
        }
      }
      gridEdges(0, nRad, nLen);
      var fuseEnd = idx;
      var nSpan = 14, nChord = 9;
      var sweep = 26 * Math.PI / 180;
      var dihedral = 5 * Math.PI / 180;
      for (var side = 0; side < 2; side++) {
        var sgn = side === 0 ? 1 : -1;
        var wingStart = idx;
        for (var v = 0; v < nChord; v++) {
          for (var u = 0; u < nSpan; u++) {
            var su = u / (nSpan - 1), sv = v / (nChord - 1);
            var span = 0.06 + su * 0.14;
            var chord = 0.065 * (1 - sv * 0.45);
            var x = -0.04 + su * 0.34 - chord * Math.cos(sweep) * 0.5;
            var y = sgn * (span * Math.cos(dihedral));
            var z = span * Math.sin(dihedral) + 0.012 * sv;
            pt(x, y, z, 'wing', 0.15);
          }
        }
        gridEdges(wingStart, nSpan, nChord);
      }
      var wingEnd = idx;
      var nVSpan = 7, nVChord = 6;
      for (var side = 0; side < 2; side++) {
        var sgn = side === 0 ? 1 : -1;
        var vStart = idx;
        for (var v = 0; v < nVChord; v++) {
          for (var u = 0; u < nVSpan; u++) {
            var su = u / (nVSpan - 1), sv = v / (nVChord - 1);
            var h = 0.04 + su * 0.07;
            var c = 0.028 * (1 - sv * 0.35);
            var cant = 12 * Math.PI / 180;
            var x = 0.32 + su * 0.11 - c * 0.5;
            var y = sgn * (0.05 * Math.cos(cant) + h * Math.sin(cant));
            var z = -0.04 - su * 0.02 + h * Math.cos(cant) * 0.3;
            pt(x, y, z, 'vertTail', 0.2);
          }
        }
        gridEdges(vStart, nVSpan, nVChord);
      }
      var vertEnd = idx;
      var nHSpan = 7, nHChord = 6;
      for (var side = 0; side < 2; side++) {
        var sgn = side === 0 ? 1 : -1;
        var hStart = idx;
        for (var v = 0; v < nHChord; v++) {
          for (var u = 0; u < nHSpan; u++) {
            var su = u / (nHSpan - 1), sv = v / (nHChord - 1);
            var span = 0.025 + su * 0.055;
            var chord = 0.024 * (1 - sv * 0.4);
            var x = 0.24 + su * 0.2 - chord * 0.5;
            var y = sgn * span;
            var z = -0.055 - su * 0.015;
            pt(x, y, z, 'horizTail', 0.22);
          }
        }
        gridEdges(hStart, nHSpan, nHChord);
      }
      var horizEnd = idx;
      var nCU = 5, nCV = 4;
      var canopyStart = idx;
      for (var v = 0; v < nCV; v++) {
        for (var u = 0; u < nCU; u++) {
          var su = u / (nCU - 1), sv = v / (nCV - 1);
          var cx = -0.26 + su * 0.12;
          var cy = 0.038 * Math.sin(su * Math.PI) * (0.3 + 0.7 * (1 - sv));
          var cz = 0.045 + 0.025 * Math.sin(su * Math.PI) * Math.sin(sv * Math.PI);
          pt(cx, cy, cz, 'canopy', 0.1);
        }
      }
      gridEdges(canopyStart, nCU, nCV);
      interior = contour.slice(0, Math.floor(contour.length * 0.48));
      var n = contour.length;
      return { contour: contour, interior: interior, jetEdges: jetEdges, jetContourCount: n, isJet: true };
    }
    function globePoints() {
      var contour = [], interior = [];
      var r = 0.4;
      var nLon = 24, nLat = 13;
      for (var lonIdx = 0; lonIdx < nLon; lonIdx++) {
        var lon = (lonIdx / nLon) * Math.PI * 2;
        for (var latIdx = 0; latIdx < nLat; latIdx++) {
          var lat = (latIdx / (nLat - 1)) * Math.PI - Math.PI / 2;
          var x = r * Math.cos(lat) * Math.cos(lon);
          var y = r * Math.sin(lat);
          var z = r * Math.cos(lat) * Math.sin(lon);
          var isEquator = latIdx === Math.floor(nLat / 2);
          var morphPhase = isEquator ? 0.12 : (latIdx === 0 || latIdx === nLat - 1 ? 0 : 0.28);
          var pt = { x: x, y: y, z: z, latIdx: latIdx, lonIdx: lonIdx, isEquator: isEquator, morphPhase: morphPhase };
          contour.push(pt);
        }
      }
      for (var i = 0; i < 20; i++) {
        var a = (i / 20) * Math.PI * 2;
        interior.push({
          x: 0.25 * Math.cos(a * 0.5),
          y: 0.15 * Math.sin(a),
          z: 0.25 * Math.sin(a * 0.5),
          latIdx: -1, lonIdx: -1, isEquator: false, isInterior: true, morphPhase: 0.5
        });
      }
      for (var i = 0; i < 16; i++) {
        var a = (i / 16) * Math.PI * 2;
        interior.push({
          x: 0.18 * Math.cos(a),
          y: 0,
          z: 0.18 * Math.sin(a),
          latIdx: -1, lonIdx: -1, isEquator: false, isInterior: true, morphPhase: 0.55
        });
      }
      for (var latIdx = 1; latIdx < nLat - 1; latIdx++) {
        if (latIdx === Math.floor(nLat / 2)) continue;
        for (var i = 0; i < 8; i++) {
          var lon = (i / 8) * Math.PI * 2;
          var lat = (latIdx / (nLat - 1)) * Math.PI - Math.PI / 2;
          interior.push({
            x: 0.28 * Math.cos(lat) * Math.cos(lon),
            y: 0.28 * Math.sin(lat),
            z: 0.28 * Math.cos(lat) * Math.sin(lon),
            latIdx: latIdx, lonIdx: -1, isEquator: false, isInterior: true, morphPhase: 0.5
          });
        }
      }
      return { contour: contour, interior: interior, isGlobe: true };
    }
    function turbinePoints() {
      var contour = [], interior = [];
      for (var i = 0; i < 24; i++) {
        var a = (i / 24) * Math.PI * 2;
        contour.push({ x: 0.05 * Math.cos(a), y: 0.05 * Math.sin(a), z: 0 });
      }
      for (var b = 0; b < 16; b++) {
        var angle = (b / 16) * Math.PI * 2;
        for (var s = 0; s < 10; s++) {
          var rad = 0.06 + (s / 9) * 0.3;
          contour.push({ x: rad * Math.cos(angle), y: rad * Math.sin(angle), z: 0.01 * (s % 2) });
        }
      }
      for (var r = 0.08; r <= 0.36; r += 0.07) {
        for (var i = 0; i < 20; i++) {
          var a = (i / 20) * Math.PI * 2;
          contour.push({ x: r * Math.cos(a), y: r * Math.sin(a), z: 0.02 });
        }
      }
      for (var i = 0; i < 28; i++) {
        var a = (i / 28) * Math.PI * 2;
        contour.push({ x: 0.38 * Math.cos(a), y: 0.38 * Math.sin(a), z: 0.025 });
      }
      for (var b = 0; b < 8; b++) {
        var angle = (b / 8) * Math.PI * 2 + 0.02;
        for (var s = 1; s < 6; s++) {
          var rad = 0.12 + (s / 5) * 0.22;
          interior.push({ x: rad * Math.cos(angle), y: rad * Math.sin(angle), z: 0.008 });
        }
      }
      interior.push({ x: 0, y: 0, z: 0 });
      return { contour: contour, interior: interior };
    }
    function geometryPoints() {
      var contour = [], interior = [];
      for (var row = 0; row < 11; row++) {
        for (var col = 0; col < 11; col++) {
          var u = (col / 10) * 0.76 - 0.38;
          var v = (row / 10) * 0.76 - 0.38;
          var warp = Math.sin(row * 0.7) * Math.cos(col * 0.7) * 0.02;
          var pt = { x: u + warp, y: v - warp * 0.5, z: Math.sin(row * 0.5) * Math.cos(col * 0.5) * 0.08 };
          if (row === 0 || row === 10 || col === 0 || col === 10) contour.push(pt);
          else interior.push(pt);
        }
      }
      for (var i = 0; i < 12; i++) {
        var a = (i / 12) * Math.PI * 2;
        for (var r = 0; r < 6; r++) {
          var rad = 0.12 + (r / 5) * 0.24;
          contour.push({ x: rad * Math.cos(a), y: rad * Math.sin(a), z: 0.02 * (i % 2) });
        }
      }
      for (var i = 0; i < 8; i++) {
        var cx = 0.26 * Math.cos((i / 8) * Math.PI * 2);
        var cy = 0.26 * Math.sin((i / 8) * Math.PI * 2);
        for (var j = 0; j < 5; j++) {
          interior.push({ x: cx + (j - 2) * 0.05, y: cy, z: 0.015 });
        }
      }
      return { contour: contour, interior: interior };
    }
    return {
      jet: jetPoints(),
      globe: globePoints(),
      turbine: turbinePoints(),
      geometry: geometryPoints()
    };
  })();
  var shapeKeys = Object.keys(shapeLibrary);

  function project(p) {
    var pf = PERSPECTIVE * 2;
    var sx = p.x + p.z * pf;
    var sy = p.y - p.z * pf * 0.5;
    var scale = 1 - p.z * 0.35;
    return { x: sx, y: sy, depth: p.z, scale: Math.max(0.45, scale) };
  }

  function toScreen(proj) {
    var sx = (proj.x * NORM_SCALE + 0.5) * INNER_W + PAD;
    var sy = (0.5 - proj.y * NORM_SCALE) * INNER_H + PAD;
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
  function dist2(pa, pb) { return Math.sqrt(distSq2(pa, pb)); }

  function buildDistributedAnchors() {
    var cols = Math.ceil(Math.sqrt(POINT_COUNT * 1.02));
    var rows = Math.ceil(POINT_COUNT / cols);
    var out = [];
    var t0 = (time + 1) * 0.001;
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        if (out.length >= POINT_COUNT) break;
        var u = (col + 0.5) / cols;
        var v = (row + 0.5) / rows;
        var jx = (noise1(row * cols + col + 100, t0) - 0.5) * 0.7;
        var jy = (noise1(row * cols + col + 200, t0 * 1.1) - 0.5) * 0.7;
        var ax = (u - 0.5) * 2 * FIELD_RADIUS + jx / cols;
        var ay = (v - 0.5) * 2 * FIELD_RADIUS + jy / rows;
        var az = (noise1(row * cols + col + 300, t0 * 0.9) - 0.5) * 0.35;
        out.push({ x: ax, y: ay, z: az, vx: 0, vy: 0, vz: 0 });
      }
    }
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(noise1(i * 7, t0) * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out.slice(0, POINT_COUNT);
  }

  function evolveAnchors() {
    var t = time;
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var n0 = (noise1(i * 3, t) - 0.5) * ANCHOR_DRIFT_SPEED;
      var n1 = (noise1(i * 3 + 77, t * 0.8) - 0.5) * ANCHOR_DRIFT_SPEED;
      var n2 = (noise1(i * 3 + 133, t * 0.6) - 0.5) * ANCHOR_DRIFT_SPEED * 0.4;
      a.vx = a.vx * 0.92 + n0;
      a.vy = a.vy * 0.92 + n1;
      a.vz = a.vz * 0.92 + n2;
      a.x += a.vx;
      a.y += a.vy;
      a.z += a.vz;
      var len = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      if (len > FIELD_RADIUS * 1.08) {
        var s = (FIELD_RADIUS * 1.08) / len;
        a.x *= s; a.y *= s; a.z *= s;
      }
    }
  }

  function syncAnchorsToPoints() {
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var idx = p.anchorIdx != null ? p.anchorIdx : i;
      if (idx >= 0 && idx < anchors.length) {
        var a = anchors[idx];
        p.ax = a.x;
        p.ay = a.y;
        p.az = a.z;
      }
    }
  }

  function buildChaosField() {
    anchors = buildDistributedAnchors();
    var contourCount = Math.floor(POINT_COUNT * CONTOUR_RATIO);
    var interiorCount = Math.floor(POINT_COUNT * INTERIOR_RATIO);
    points = [];
    for (var i = 0; i < POINT_COUNT; i++) {
      var a = anchors[i];
      var role = i < contourCount ? 'contour' : (i < contourCount + interiorCount ? 'interior' : 'ambient');
      points.push({
        x: a.x, y: a.y, z: a.z,
        ax: a.x, ay: a.y, az: a.z,
        anchorIdx: i,
        vx: (noise1(i, 0) - 0.5) * 0.0008,
        vy: (noise1(i + 111, 0) - 0.5) * 0.0008,
        vz: (noise1(i + 222, 0) - 0.5) * 0.00035,
        phaseX: i * 0.7, phaseY: i * 0.9 + 1.3, phaseZ: i * 0.5 + 2.1,
        seed: i * 17.3,
        morphRole: role,
        tx: null, ty: null, tz: null
      });
    }
  }

  function applyClusterBust() {
    clusterBustCounter++;
    if (clusterBustCounter < CLUSTER_BUST_FRAMES) return;
    clusterBustCounter = 0;
    quadrantCounts[0] = quadrantCounts[1] = quadrantCounts[2] = quadrantCounts[3] = 0;
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var q = (p.x < 0 ? 0 : 1) + (p.y < 0 ? 0 : 2);
      quadrantCounts[q]++;
    }
    var maxFrac = 0;
    var denseQuad = -1;
    for (var q = 0; q < 4; q++) {
      var f = quadrantCounts[q] / POINT_COUNT;
      if (f > maxFrac) { maxFrac = f; denseQuad = q; }
    }
    if (maxFrac < CLUSTER_DENSITY_THRESHOLD) return;
    var pushX = (denseQuad === 0 || denseQuad === 2) ? 0.008 : -0.008;
    var pushY = (denseQuad === 0 || denseQuad === 1) ? 0.008 : -0.008;
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var q = (p.x < 0 ? 0 : 1) + (p.y < 0 ? 0 : 2);
      if (q !== denseQuad) continue;
      p.x += pushX * (0.7 + noise1(i * 11, time) * 0.6);
      p.y += pushY * (0.7 + noise1(i * 13, time * 0.9) * 0.6);
    }
  }

  function applyFullyLivingIdleDrift() {
    evolveAnchors();
    syncAnchorsToPoints();
    applyClusterBust();
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var t = time;
      var nx = (noise2(i, t, 0) - 0.5) * 0.0012;
      var ny = (noise2(i, t, 1) - 0.5) * 0.0012;
      var nz = (noise2(i, t, 2) - 0.5) * 0.0005;
      p.vx += nx;
      p.vy += ny;
      p.vz += nz;
      p.vx += Math.sin(t + p.phaseX) * 0.00045;
      p.vy += Math.cos(t * 0.92 + p.phaseY) * 0.00045;
      p.vz += Math.sin(t * 0.85 + p.phaseZ) * 0.0002;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.vz *= 0.96;
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      var dx = p.x - p.ax, dy = p.y - p.ay, dz = p.z - p.az;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > IDLE_DRIFT_MAX) {
        var s = IDLE_DRIFT_MAX / d;
        p.x = p.ax + dx * s;
        p.y = p.ay + dy * s;
        p.z = p.az + dz * s;
      }
    }
  }

  function applyCursorInfluence() {
    if (!cursorNorm || !isPointerIn) return;
    if (state !== STATE.CHAOS) return;
    var cx = cursorNorm.x, cy = cursorNorm.y;
    var r2 = CURSOR_INFLUENCE_RADIUS * CURSOR_INFLUENCE_RADIUS;
    var mult = state === STATE.TIGHTENING ? 0.2 : 1;
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var dx = cx - p.x, dy = cy - p.y;
      var distSq = dx * dx + dy * dy;
      if (distSq < r2 && distSq > 0.0001) {
        var dist = Math.sqrt(distSq);
        var falloff = 1 - (distSq / r2) * (distSq / r2);
        var strength = falloff * falloff * CURSOR_ATTRACTION * mult / (dist + 0.05);
        var pull = Math.min(strength, CURSOR_DISPLACEMENT_CAP);
        p.x += dx * pull;
        p.y += dy * pull;
        p.z += (cursorNorm.z - p.z) * 0.0012 * falloff * mult;
      }
    }
  }

  function applyAmbientDrift() {
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (p.morphRole !== 'ambient') continue;
      var t = time;
      p.vx += (noise2(i, t, 0) - 0.5) * 0.0006;
      p.vy += (noise2(i, t, 1) - 0.5) * 0.0006;
      p.vz += (noise2(i, t, 2) - 0.5) * 0.0002;
      p.vx += Math.sin(t + p.phaseX) * 0.0003;
      p.vy += Math.cos(t * 0.9 + p.phaseY) * 0.0003;
      p.vz *= 0.97;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      var dx = p.x - p.ax, dy = p.y - p.ay, dz = p.z - p.az;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > IDLE_DRIFT_MAX * 0.8) {
        var s = (IDLE_DRIFT_MAX * 0.8) / d;
        p.x = p.ax + dx * s;
        p.y = p.ay + dy * s;
        p.z = p.az + dz * s;
      }
    }
  }

  function recomputeEdges(projected, structured) {
    var edgeSet = {};
    var nLon = 24, nLat = 13;
    if (currentShape === 'globe' && structured) {
      var ptIdxToProj = {};
      for (var i = 0; i < projected.length; i++) ptIdxToProj[projected[i].idx] = i;
      var cellToPtIdx = {};
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var lat = p.globeLatIdx, lon = p.globeLonIdx;
        if (lat != null && lon != null && lat >= 0 && !p.globeIsInterior) {
          var k = lat + '|' + lon;
          if (!cellToPtIdx[k]) cellToPtIdx[k] = [];
          cellToPtIdx[k].push(i);
        }
      }
      function addEdge(pi, pj) {
        if (pi === pj) return;
        var ia = ptIdxToProj[pi], ib = ptIdxToProj[pj];
        if (ia == null || ib == null) return;
        var key = ia < ib ? ia + '|' + ib : ib + '|' + ia;
        edgeSet[key] = true;
      }
      for (var k in cellToPtIdx) {
        var parts = k.split('|');
        var lat = +parts[0], lon = +parts[1];
        var ids = cellToPtIdx[k];
        var nLatNext = (lat + 1), nLatPrev = lat - 1;
        var nLonNext = (lon + 1) % nLon, nLonPrev = (lon - 1 + nLon) % nLon;
        var nkLat = nLatNext + '|' + lon, pkLat = nLatPrev + '|' + lon;
        var nkLon = lat + '|' + nLonNext, pkLon = lat + '|' + nLonPrev;
        for (var ii = 0; ii < ids.length; ii++) {
          var pid = ids[ii];
          if (nLatNext < nLat && cellToPtIdx[nkLat])
            for (var jj = 0; jj < cellToPtIdx[nkLat].length; jj++) addEdge(pid, cellToPtIdx[nkLat][jj]);
          if (nLatPrev >= 0 && cellToPtIdx[pkLat])
            for (var jj = 0; jj < cellToPtIdx[pkLat].length; jj++) addEdge(pid, cellToPtIdx[pkLat][jj]);
          for (var jj = 0; jj < (cellToPtIdx[nkLon] || []).length; jj++) addEdge(pid, (cellToPtIdx[nkLon] || [])[jj]);
          for (var jj = 0; jj < (cellToPtIdx[pkLon] || []).length; jj++) addEdge(pid, (cellToPtIdx[pkLon] || [])[jj]);
        }
      }
      for (var i = 0; i < projected.length; i++) {
        var pti = points[projected[i].idx];
        if (!pti) continue;
        if (pti.globeIsInterior || pti.morphRole === 'ambient') {
          var sorted = [];
          for (var j = 0; j < projected.length; j++) {
            if (i === j) continue;
            var d = dist2(projected[i], projected[j]);
            if (d < EDGE_DISTANCE_THRESHOLD) sorted.push({ j: j, d: d * d });
          }
          sorted.sort(function (a, b) { return a.d - b.d; });
          for (var n = 0; n < 2 && n < sorted.length; n++) {
            var j = sorted[n].j;
            var key = i < j ? i + '|' + j : j + '|' + i;
            edgeSet[key] = true;
          }
        }
      }
    } else if (currentShape === 'jet' && structured) {
      var ptIdxToProj = {};
      for (var i = 0; i < projected.length; i++) ptIdxToProj[projected[i].idx] = i;
      var contourIdxToPtIdx = {};
      for (var i = 0; i < points.length; i++) {
        var ci = points[i].jetContourIdx;
        if (ci != null && contourIdxToPtIdx[ci] == null) contourIdxToPtIdx[ci] = i;
      }
      var jetData = shapeLibrary.jet;
      var jetEdgeList = (jetData && jetData.jetEdges) ? jetData.jetEdges : [];
      function addJetEdge(ci, cj) {
        var pi = contourIdxToPtIdx[ci], pj = contourIdxToPtIdx[cj];
        if (pi == null || pj == null) return;
        var ia = ptIdxToProj[pi], ib = ptIdxToProj[pj];
        if (ia == null || ib == null) return;
        var key = ia < ib ? ia + '|' + ib : ib + '|' + ia;
        edgeSet[key] = true;
      }
      for (var e = 0; e < jetEdgeList.length; e++) {
        var pair = jetEdgeList[e];
        var jetN = (jetData && jetData.jetContourCount != null) ? jetData.jetContourCount : 500;
        if (pair[0] >= 0 && pair[0] < jetN && pair[1] >= 0 && pair[1] < jetN) addJetEdge(pair[0], pair[1]);
      }
      /* Jet hold: no k-NN edges for interior or ambient — aircraft silhouette only */
    } else {
      for (var i = 0; i < projected.length; i++) {
        var pi = projected[i];
        var pti = points[pi.idx];
        var k = structured ? K_EDGES_RESOLVED : (pti.morphRole === 'ambient' ? 1 : K_EDGES_IDLE);
        var sorted = [];
        for (var j = 0; j < projected.length; j++) {
          if (i === j) continue;
          var d = dist2(pi, projected[j]);
          if (d < EDGE_DISTANCE_THRESHOLD) sorted.push({ j: j, d: d * d });
        }
        sorted.sort(function (a, b) { return a.d - b.d; });
        for (var n = 0; n < k && n < sorted.length; n++) {
          var j = sorted[n].j;
          var key = i < j ? i + '|' + j : j + '|' + i;
          edgeSet[key] = true;
        }
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
    if (!coords) return null;
    var contourTargets, interiorTargets;
    if (coords.contour && Array.isArray(coords.contour)) {
      contourTargets = coords.contour.map(function (c, idx) {
        var t = { x: c.x, y: c.y, z: c.z };
        if (c.latIdx != null) t.latIdx = c.latIdx;
        if (c.lonIdx != null) t.lonIdx = c.lonIdx;
        if (c.isEquator != null) t.isEquator = c.isEquator;
        if (c.isInterior != null) t.isInterior = c.isInterior;
        if (c.morphPhase != null) t.morphPhase = c.morphPhase;
        if (c.jetPart != null) { t.jetPart = c.jetPart; t.jetSeq = c.jetSeq; t.jetIdx = c.jetIdx; t.jetContourIdx = idx; }
        return t;
      });
      interiorTargets = (coords.interior || []).map(function (c) {
        var t = { x: c.x, y: c.y, z: c.z };
        if (c.latIdx != null) t.latIdx = c.latIdx;
        if (c.lonIdx != null) t.lonIdx = c.lonIdx;
        if (c.isInterior != null) t.isInterior = c.isInterior;
        if (c.morphPhase != null) t.morphPhase = c.morphPhase;
        if (c.jetPart != null) { t.jetPart = c.jetPart; t.jetSeq = c.jetSeq; t.jetIdx = c.jetIdx; }
        return t;
      });
    } else if (Array.isArray(coords) && coords.length > 0) {
      var nContour = Math.floor(POINT_COUNT * CONTOUR_RATIO);
      var nInterior = Math.floor(POINT_COUNT * INTERIOR_RATIO);
      contourTargets = [];
      interiorTargets = [];
      for (var i = 0; i < nContour; i++) contourTargets.push({ x: coords[i % coords.length].x, y: coords[i % coords.length].y, z: coords[i % coords.length].z });
      for (var j = 0; j < nInterior; j++) interiorTargets.push({ x: coords[(nContour + j) % coords.length].x, y: coords[(nContour + j) % coords.length].y, z: coords[(nContour + j) % coords.length].z });
    } else return null;
    return { contourTargets: contourTargets, interiorTargets: interiorTargets };
  }

  function assignStructurePointsToTargets(shapeData) {
    var contourTargets = shapeData.contourTargets;
    var interiorTargets = shapeData.interiorTargets;
    var contourPoints = points.filter(function (p) { return p.morphRole === 'contour'; });
    var interiorPoints = points.filter(function (p) { return p.morphRole === 'interior'; });
    var contourUsed = {};
    var interiorUsed = {};
    var assignments = {};
    for (var i = 0; i < contourPoints.length; i++) {
      var pi = contourPoints[i];
      var bestJ = -1, bestD = Infinity;
      for (var j = 0; j < contourTargets.length; j++) {
        if (contourUsed[j]) continue;
        var d = distSq3(pi, contourTargets[j]);
        if (d < bestD) { bestD = d; bestJ = j; }
      }
      if (bestJ >= 0) {
        contourUsed[bestJ] = true;
        assignments[points.indexOf(pi)] = contourTargets[bestJ];
      } else {
        assignments[points.indexOf(pi)] = contourTargets[i % contourTargets.length];
      }
    }
    for (var i = 0; i < interiorPoints.length; i++) {
      var pi = interiorPoints[i];
      var bestJ = -1, bestD = Infinity;
      for (var j = 0; j < interiorTargets.length; j++) {
        if (interiorUsed[j]) continue;
        var d = distSq3(pi, interiorTargets[j]);
        if (d < bestD) { bestD = d; bestJ = j; }
      }
      if (bestJ >= 0) {
        interiorUsed[bestJ] = true;
        assignments[points.indexOf(pi)] = interiorTargets[bestJ];
      } else {
        assignments[points.indexOf(pi)] = interiorTargets[i % interiorTargets.length] || contourTargets[0];
      }
    }
    return assignments;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function draw() {
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    var projected = [];
    for (var i = 0; i < points.length; i++) {
      var p = project(points[i]);
      var s = toScreen(p);
      projected.push({ sx: s.sx, sy: s.sy, scale: s.scale, depth: s.depth, idx: i });
    }
    projected.sort(function (a, b) { return a.depth - b.depth; });
    recomputeEdges(projected, state === STATE.STRUCTURED || state === STATE.SETTLING);

    var baseEdgeOpacity = (state === STATE.STRUCTURED || state === STATE.SETTLING) ? 0.26 : 0.2;
    var isGlobeActive = currentShape === 'globe' && (state === STATE.STRUCTURED || state === STATE.SETTLING);
    ctx.lineWidth = 1;
    edges.forEach(function (e) {
      var pa = projected[e.a], pb = projected[e.b];
      if (!pa || !pb) return;
      var midDepth = (pa.depth + pb.depth) / 2;
      var df = 0.55 + 0.45 * Math.max((pa.depth + 0.5), (pb.depth + 0.5));
      var op;
      if (isGlobeActive) {
        op = 0.12 + 0.5 * (midDepth + 0.5);
      } else if (currentShape === 'jet' && (state === STATE.STRUCTURED || state === STATE.SETTLING)) {
        op = 0.14 + 0.42 * (midDepth + 0.5);
      } else {
        op = baseEdgeOpacity * df;
      }
      if (cursorNorm && isPointerIn && (state === STATE.CHAOS || state === STATE.TIGHTENING)) {
        var mx = (cursorNorm.x * NORM_SCALE + 0.5) * INNER_W + PAD;
        var my = (0.5 - cursorNorm.y * NORM_SCALE) * INNER_H + PAD;
        var midX = (pa.sx + pb.sx) / 2, midY = (pa.sy + pb.sy) / 2;
        var dCursor = Math.sqrt((mx - midX) * (mx - midX) + (my - midY) * (my - midY));
        if (dCursor < CURSOR_EDGE_RADIUS_PX) op = Math.min(1, op + CURSOR_EDGE_BOOST);
      }
      ctx.strokeStyle = 'rgba(74, 74, 74, ' + op + ')';
      ctx.beginPath();
      ctx.moveTo(pa.sx, pa.sy);
      ctx.lineTo(pb.sx, pb.sy);
      ctx.stroke();
    });

    projected.forEach(function (proj) {
      var pt = points[proj.idx];
      var df = (proj.depth + 0.5);
      var opacity, sizeMult;
      if (pt.morphRole === 'ambient') {
        var jetHold = currentShape === 'jet' && (state === STATE.STRUCTURED || state === STATE.SETTLING);
        opacity = jetHold ? AMBIENT_OPACITY * 0.28 : ((state === STATE.STRUCTURED || state === STATE.SETTLING) ? AMBIENT_OPACITY * 0.65 : AMBIENT_OPACITY * 0.9);
        sizeMult = jetHold ? AMBIENT_POINT_SCALE * 0.45 : AMBIENT_POINT_SCALE * (0.7 + 0.25 * df);
      } else if (currentShape === 'globe' && (state === STATE.STRUCTURED || state === STATE.SETTLING)) {
        opacity = 0.16 + 0.52 * df;
        sizeMult = 0.7 + 0.6 * df;
      } else if (currentShape === 'jet' && (state === STATE.STRUCTURED || state === STATE.SETTLING)) {
        var fwd = 0.5 - (pt.ax || 0) * 0.4;
        opacity = 0.18 + 0.5 * df * fwd;
        sizeMult = 0.74 + 0.58 * df * fwd;
      } else {
        opacity = 0.22 + 0.32 * df;
        sizeMult = 0.8 + 0.4 * df;
      }
      var r = Math.max(1.0, POINT_RADIUS * proj.scale * sizeMult);
      ctx.fillStyle = 'rgba(74, 74, 74, ' + opacity + ')';
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function applyStructureMotion() {
    var phase = time * 0.2;
    if (currentShape === 'jet') {
      var shimmer = Math.sin(time * 1.2 + 1) * 0.0004;
      var sweep = Math.sin(time * 0.6 + 2) * 0.0003;
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (p.morphRole === 'ambient') continue;
        p.x = p.ax + shimmer * (1 - p.ax * 2);
        p.y = p.ay + sweep * p.ay;
        p.z = p.az + shimmer * 0.5;
      }
    } else if (currentShape === 'globe') {
      var globeRot = time * GLOBE_ROT_SPEED;
      var cy = Math.cos(globeRot), sy = Math.sin(globeRot);
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (p.morphRole === 'ambient') continue;
        var ax = p.ax, ay = p.ay, az = p.az;
        var rx = ax * cy - az * sy;
        var rz = ax * sy + az * cy;
        p.x = rx;
        p.z = rz;
        p.y = ay;
        if (p.globeIsInterior) {
          var parallax = Math.sin(time * 0.8 + i * 0.3) * 0.0006;
          p.y += parallax;
          var rInt = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
          if (rInt > 1e-6 && rInt > GLOBE_INTERIOR_MAX_R) {
            var s = GLOBE_INTERIOR_MAX_R / rInt;
            p.x *= s; p.y *= s; p.z *= s;
          }
        } else {
          var r2 = p.x * p.x + p.y * p.y + p.z * p.z;
          var rCur = Math.sqrt(r2);
          if (rCur > 1e-6) {
            var s = GLOBE_SHELL_RADIUS / rCur;
            p.x *= s; p.y *= s; p.z *= s;
          }
        }
      }
    } else if (currentShape === 'turbine') {
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (p.morphRole === 'ambient') continue;
        var r = Math.sqrt(p.x * p.x + p.y * p.y);
        if (r < 0.04) continue;
        var a = Math.atan2(p.y, p.x);
        p.x = r * Math.cos(a + phase * 0.012);
        p.y = r * Math.sin(a + phase * 0.012);
      }
    } else if (currentShape === 'geometry') {
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (p.morphRole === 'ambient') continue;
        var breath = Math.sin(time * 0.5 + p.x * 5 + p.y * 3) * STRUCTURE_MOTION_MAX;
        p.z += breath;
      }
    }
  }

  function drawFrame() {
    time += 0.016;
    if (state === STATE.CHAOS) {
      applyFullyLivingIdleDrift();
      applyCursorInfluence();
      if (isPointerIn) {
        hoverElapsed += 16;
        if (hoverElapsed >= HOVER_TO_MORPH_MS) transitionToShape();
      } else hoverElapsed = 0;
    } else if (state === STATE.STRUCTURED || state === STATE.SETTLING) {
      if (currentShape !== 'globe' && currentShape !== 'jet') evolveAnchors();
      syncAnchorsToPoints();
      applyStructureMotion();
      applyAmbientDrift();
    } else if (state === STATE.TIGHTENING || state === STATE.MORPHING || state === STATE.DISSOLVING) {
      evolveAnchors();
      syncAnchorsToPoints();
      applyCursorInfluence();
      applyAmbientDrift();
    }
    draw();
    rafId = requestAnimationFrame(drawFrame);
  }

  function runTighten(assignments, onComplete) {
    state = STATE.TIGHTENING;
    var start = performance.now();
    function step() {
      var t = Math.min(1, (performance.now() - start) / TIGHTEN_MS);
      t = easeInOutCubic(t);
      var cx = 0, cy = 0, cz = 0, sc = 0;
      points.forEach(function (p) {
        if ((p.morphRole === 'contour' || p.morphRole === 'interior') && assignments[points.indexOf(p)]) {
          var tg = assignments[points.indexOf(p)];
          cx += tg.x; cy += tg.y; cz += tg.z; sc++;
        }
      });
      if (sc > 0) { cx /= sc; cy /= sc; cz /= sc; }
      points.forEach(function (p) {
        if ((p.morphRole === 'contour' || p.morphRole === 'interior') && assignments[points.indexOf(p)]) {
          var tg = assignments[points.indexOf(p)];
          p.x = lerp(p.x, lerp(p.x, cx, 0.1), t);
          p.y = lerp(p.y, lerp(p.y, cy, 0.1), t);
          p.z = lerp(p.z, lerp(p.z, cz, 0.1), t);
        }
      });
      if (t >= 1) onComplete();
      else requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function runMorph(assignments, onComplete) {
    state = STATE.MORPHING;
    var start = performance.now();
    function step() {
      var t = Math.min(1, (performance.now() - start) / MORPH_MS);
      points.forEach(function (p) {
        if ((p.morphRole === 'contour' || p.morphRole === 'interior')) {
          var idx = points.indexOf(p);
          var tg = assignments[idx];
          if (tg) {
            var tAnim;
            if (currentShape === 'globe' && tg.morphPhase != null) {
              var phaseStart = tg.morphPhase;
              tAnim = phaseStart >= 1 ? 0 : easeInOutCubic(Math.max(0, Math.min(1, (t - phaseStart * 0.5) / (1 - phaseStart * 0.5))));
              p.globeLatIdx = tg.latIdx;
              p.globeLonIdx = tg.lonIdx;
              p.globeIsEquator = tg.isEquator;
              p.globeIsInterior = tg.isInterior;
            } else if (currentShape === 'jet' && tg.jetSeq != null) {
              var seqStart = tg.jetSeq;
              tAnim = easeInOutCubic(Math.max(0, Math.min(1, (t - seqStart * 0.6) / (1 - seqStart * 0.6 + 0.01))));
              p.jetPart = tg.jetPart;
              p.jetSeq = tg.jetSeq;
              p.jetContourIdx = tg.jetContourIdx;
            } else {
              tAnim = p.morphRole === 'contour'
                ? easeInOutCubic(Math.min(1, t * 1.6))
                : easeInOutCubic(Math.max(0, (t - 0.15) / 0.85));
            }
            p.x = lerp(p.x, tg.x, tAnim);
            p.y = lerp(p.y, tg.y, tAnim);
            p.z = lerp(p.z, tg.z, tAnim);
          }
        }
      });
      if (t >= 1) onComplete();
      else requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function transitionToShape() {
    if (state === STATE.MORPHING || state === STATE.STRUCTURED || state === STATE.TIGHTENING || state === STATE.SETTLING) return;
    var key = shapeKeys[shapeIndex % shapeKeys.length];
    shapeIndex++;
    currentShape = key;
    var targets = getShapeTargets(key);
    if (!targets || !targets.contourTargets || targets.contourTargets.length === 0) { state = STATE.CHAOS; return; }
    var assignments = assignStructurePointsToTargets(targets);
    runTighten(assignments, function () {
      runMorph(assignments, function () {
        for (var i = 0; i < points.length; i++) {
          var p = points[i], a = anchors[i];
          if (a) { a.x = p.x; a.y = p.y; a.z = p.z; }
        }
        state = STATE.SETTLING;
        setTimeout(function () {
          state = STATE.STRUCTURED;
          if (holdTimer) clearTimeout(holdTimer);
          holdTimer = setTimeout(transitionToChaos, HOLD_MS);
        }, SETTLE_MS);
      });
    });
  }

  function transitionToChaos() {
    holdTimer = null;
    if (state !== STATE.STRUCTURED && state !== STATE.SETTLING) return;
    state = STATE.DISSOLVING;
    currentShape = null;
    anchors = buildDistributedAnchors();
    var start = performance.now();
    function step() {
      var t = Math.min(1, (performance.now() - start) / DISSOLVE_MS);
      t = easeInOutCubic(t);
      for (var i = 0; i < points.length; i++) {
        var p = points[i], a = anchors[i];
        if ((p.morphRole === 'contour' || p.morphRole === 'interior')) {
          p.x = lerp(p.x, a.x, t);
          p.y = lerp(p.y, a.y, t);
          p.z = lerp(p.z, a.z, t);
        }
      }
      if (t >= 1) {
        state = STATE.CHAOS;
        syncAnchorsToPoints();
        for (var i = 0; i < points.length; i++) {
          points[i].vx = (noise1(i, time) - 0.5) * 0.0008;
          points[i].vy = (noise1(i + 111, time) - 0.5) * 0.0008;
          points[i].vz = (noise1(i + 222, time) - 0.5) * 0.00035;
        }
      } else requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function render(container) {
    container.innerHTML = '';
    canvas = document.createElement('canvas');
    canvas.setAttribute('class', 'hologram-morph__canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');
    if (!ctx) {
      container.innerHTML = '<div class="hologram-morph__static" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(74,74,74,0.4);font-size:0.75rem;letter-spacing:0.06em;">Structure within complexity</div>';
      return;
    }
    container.appendChild(canvas);
    buildChaosField();
    drawFrame();

    function toNorm(ev) {
      var rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1 || INNER_W < 1 || INNER_H < 1) return { x: 0, y: 0, z: 0 };
      var px = (ev.clientX - rect.left) * W / rect.width;
      var py = (ev.clientY - rect.top) * H / rect.height;
      var nx = (px - PAD) / INNER_W - 0.5;
      var ny = 0.5 - (py - PAD) / INNER_H;
      var nz = Math.max(-0.5, Math.min(0.5, nx * 0.3 + ny * 0.2));
      return { x: nx / NORM_SCALE, y: ny / NORM_SCALE, z: nz };
    }

    container.addEventListener('mouseenter', function (e) {
      isPointerIn = true;
      cursorNorm = toNorm(e);
      hoverElapsed = 0;
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    });
    container.addEventListener('mousemove', function (e) {
      cursorNorm = toNorm(e);
      if (state === STATE.CHAOS) hoverElapsed = 0;
    });
    container.addEventListener('mouseleave', function () {
      isPointerIn = false;
      cursorNorm = null;
      hoverElapsed = 0;
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      container.innerHTML = '<div class="hologram-morph__static" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(74,74,74,0.4);font-size:0.75rem;letter-spacing:0.06em;">Structure within complexity</div>';
      return;
    }
    var rect = container.getBoundingClientRect();
    var rw = Math.max(rect.width || 0, 300);
    var rh = Math.max(rect.height || 0, 250);
    W = Math.min(rw, 900);
    H = Math.min(rh, 700);
    PAD = Math.max(16, Math.min(28, Math.floor(Math.min(W, H) * 0.04)));
    INNER_W = Math.max(1, W - PAD * 2);
    INNER_H = Math.max(1, H - PAD * 2);
    PANEL_W = W;
    PANEL_H = H;
    if (canvas) { canvas.width = W; canvas.height = H; }
    if (rafId) cancelAnimationFrame(rafId);
    render(container);
  }

  function tryInit() {
    var container = document.getElementById('systemDiagram');
    if (!container) return false;
    init();
    return true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { if (!tryInit()) { var a = 0; var id = setInterval(function () { if (tryInit() || ++a > 30) clearInterval(id); }, 100); } }, 150); });
  else setTimeout(function () { if (!tryInit()) { var a = 0; var id = setInterval(function () { if (tryInit() || ++a > 30) clearInterval(id); }, 100); } }, 150);

  if (typeof ResizeObserver !== 'undefined') setTimeout(function () {
    var container = document.getElementById('systemDiagram');
    if (container) { var ro = new ResizeObserver(function () { var r = container.getBoundingClientRect(); if (r.width > 10 && r.height > 10) init(); }); ro.observe(container); }
  }, 500);
})();
