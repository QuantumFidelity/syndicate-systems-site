/**
 * Syndicate Systems — 3D Globe with Network
 * Nodes protruding outward from globe surface, evolving connections
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

var graph = {
  nodes: [
    { id: 'structure' }, { id: 'clarity' }, { id: 'independence' }, { id: 'judgement' }, { id: 'risk' },
    { id: 'qualification' }, { id: 'inspection' }, { id: 'advisory' }, { id: 'optional' },
    { id: 'ambiguity' }, { id: 'dependencies' }, { id: 'architecture' }, { id: 'order' }, { id: 'resilience' },
    { id: 'governance' }, { id: 'complexity' }, { id: 'technical-debt' }, { id: 'scalability' },
    { id: 'observability' }, { id: 'integration' }, { id: 'boundaries' }, { id: 'constraints' },
    { id: 'failure-modes' }, { id: 'legacy' }, { id: 'modernization' }, { id: 'vendor-lock' },
    { id: 'compliance' }, { id: 'migration' }
  ],
  coreLinks: [
    { source: 'structure', target: 'clarity' }, { source: 'structure', target: 'independence' },
    { source: 'structure', target: 'architecture' }, { source: 'clarity', target: 'judgement' },
    { source: 'clarity', target: 'order' }, { source: 'independence', target: 'advisory' },
    { source: 'judgement', target: 'risk' }, { source: 'risk', target: 'resilience' },
    { source: 'qualification', target: 'inspection' }, { source: 'inspection', target: 'advisory' },
    { source: 'advisory', target: 'optional' }, { source: 'ambiguity', target: 'inspection' },
    { source: 'dependencies', target: 'inspection' }, { source: 'dependencies', target: 'architecture' },
    { source: 'ambiguity', target: 'structure' }, { source: 'architecture', target: 'order' },
    { source: 'order', target: 'resilience' }, { source: 'optional', target: 'order' },
    { source: 'advisory', target: 'clarity' }, { source: 'inspection', target: 'structure' }
  ],
  potentialLinks: [
    { source: 'complexity', target: 'structure' }, { source: 'technical-debt', target: 'inspection' },
    { source: 'scalability', target: 'architecture' }, { source: 'observability', target: 'resilience' },
    { source: 'integration', target: 'dependencies' }, { source: 'boundaries', target: 'structure' },
    { source: 'constraints', target: 'architecture' }, { source: 'failure-modes', target: 'inspection' },
    { source: 'legacy', target: 'ambiguity' }, { source: 'modernization', target: 'order' },
    { source: 'vendor-lock', target: 'independence' }, { source: 'compliance', target: 'governance' },
    { source: 'migration', target: 'advisory' }, { source: 'governance', target: 'structure' },
    { source: 'complexity', target: 'ambiguity' }, { source: 'technical-debt', target: 'legacy' },
    { source: 'scalability', target: 'resilience' }, { source: 'observability', target: 'clarity' },
    { source: 'boundaries', target: 'architecture' }, { source: 'constraints', target: 'dependencies' },
    { source: 'failure-modes', target: 'risk' }, { source: 'legacy', target: 'migration' },
    { source: 'modernization', target: 'architecture' }, { source: 'vendor-lock', target: 'dependencies' },
    { source: 'compliance', target: 'structure' }
  ]
};

function fibonacciSphere(n, i) {
  var phi = Math.PI * (3 - Math.sqrt(5));
  var y = 1 - (i / (n - 1)) * 2;
  var r = Math.sqrt(1 - y * y);
  var theta = phi * i;
  return {
    x: Math.cos(theta) * r,
    y: y,
    z: Math.sin(theta) * r
  };
}

function getConnectedIds(links, nodeId) {
  var ids = new Set([nodeId]);
  links.forEach(function (l) {
    var s = typeof l.source === 'object' ? l.source.id : l.source;
    var t = typeof l.target === 'object' ? l.target.id : l.target;
    if (s === nodeId || t === nodeId) { ids.add(s); ids.add(t); }
  });
  return ids;
}

function initGlobe() {
  var container = document.getElementById('systemDiagram');
  if (!container) return;

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  var width = container.clientWidth || 580;
  var height = container.clientHeight || 480;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.z = 3.2;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  var GLOBE_RADIUS = 0.85;
  var NODE_PROTRUSION = 0.35;
  var NODE_RADIUS = 0.028;
  var colors = {
    node: 0x111111,
    nodeActive: 0x5E7383,
    link: 0x111111,
    linkPulse: 0x5E7383,
    globe: 0xE8E8E8
  };

  var nodePositions = {};
  graph.nodes.forEach(function (n, i) {
    var p = fibonacciSphere(graph.nodes.length, i);
    var len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    var r = GLOBE_RADIUS + NODE_PROTRUSION;
    nodePositions[n.id] = {
      base: new THREE.Vector3(p.x / len * GLOBE_RADIUS, p.y / len * GLOBE_RADIUS, p.z / len * GLOBE_RADIUS),
      current: new THREE.Vector3(p.x / len * r, p.y / len * r, p.z / len * r),
      drift: { phi: 0, theta: 0 }
    };
  });

  var globeGeom = new THREE.SphereGeometry(GLOBE_RADIUS, 32, 24);
  var globeMat = new THREE.MeshBasicMaterial({
    color: colors.globe,
    transparent: true,
    opacity: 0.25,
    wireframe: true
  });
  var globe = new THREE.Mesh(globeGeom, globeMat);
  scene.add(globe);

  var nodeMeshes = {};
  var nodeGroup = new THREE.Group();
  graph.nodes.forEach(function (n) {
    var geom = new THREE.SphereGeometry(NODE_RADIUS, 12, 8);
    var mat = new THREE.MeshBasicMaterial({
      color: colors.node,
      transparent: true,
      opacity: 0.5
    });
    var mesh = new THREE.Mesh(geom, mat);
    var pos = nodePositions[n.id].current;
    mesh.position.copy(pos);
    mesh.userData = { id: n.id };
    nodeMeshes[n.id] = mesh;
    nodeGroup.add(mesh);
  });
  scene.add(nodeGroup);

  var links = graph.coreLinks.map(function (l) {
    return { source: l.source, target: l.target };
  });
  var activePotential = [];
  var linkLines = {};
  var linkGroup = new THREE.Group();

  function createLinkLine(sourceId, targetId, isPulse) {
    var p1 = nodePositions[sourceId].current;
    var p2 = nodePositions[targetId].current;
    var geom = new THREE.BufferGeometry().setFromPoints([p1.clone(), p2.clone()]);
    var mat = new THREE.LineBasicMaterial({
      color: isPulse ? colors.linkPulse : colors.link,
      transparent: true,
      opacity: isPulse ? 0.9 : 0.15
    });
    var line = new THREE.Line(geom, mat);
    line.userData = { source: sourceId, target: targetId };
    return line;
  }

  function addLink(sourceId, targetId, pulse) {
    var k = sourceId < targetId ? sourceId + '|' + targetId : targetId + '|' + sourceId;
    if (linkLines[k]) return;
    var line = createLinkLine(sourceId, targetId, pulse);
    linkLines[k] = line;
    linkGroup.add(line);
    links.push({ source: sourceId, target: targetId });
    if (pulse) {
      line.material.opacity = 0.9;
      setTimeout(function () {
        line.material.color.setHex(colors.link);
        line.material.opacity = 0.35;
      }, 900);
    }
  }

  function removeLink(sourceId, targetId) {
    var k = sourceId < targetId ? sourceId + '|' + targetId : targetId + '|' + sourceId;
    var line = linkLines[k];
    if (line) {
      linkGroup.remove(line);
      line.geometry.dispose();
      line.material.dispose();
      delete linkLines[k];
    }
    var idx = links.findIndex(function (l) {
      var sk = l.source < l.target ? l.source + '|' + l.target : l.target + '|' + l.source;
      return sk === k;
    });
    if (idx >= 0) links.splice(idx, 1);
  }

  graph.coreLinks.forEach(function (l) { addLink(l.source, l.target, false); });
  scene.add(linkGroup);

  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();

  function updateLinkPositions() {
    for (var k in linkLines) {
      var parts = k.split('|');
      var p1 = nodePositions[parts[0]].current;
      var p2 = nodePositions[parts[1]].current;
      var geom = linkLines[k].geometry;
      geom.attributes.position.setXYZ(0, p1.x, p1.y, p1.z);
      geom.attributes.position.setXYZ(1, p2.x, p2.y, p2.z);
      geom.attributes.position.needsUpdate = true;
    }
  }

  function setHighlight(id) {
    var connected = id ? getConnectedIds(links, id) : null;
    graph.nodes.forEach(function (n) {
      var mesh = nodeMeshes[n.id];
      var active = !id || connected.has(n.id);
      mesh.material.color.setHex(active ? (n.id === id ? colors.nodeActive : colors.node) : 0x111111);
      mesh.material.opacity = active ? (n.id === id ? 1 : 0.5) : 0.15;
    });
    for (var k in linkLines) {
      var parts = k.split('|');
      var active = !id || (connected.has(parts[0]) && connected.has(parts[1]));
      linkLines[k].material.opacity = active ? 0.35 : 0.05;
    }
  }

  container.addEventListener('mousemove', function (e) {
    var rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var intersects = raycaster.intersectObjects(nodeGroup.children);
    if (intersects.length > 0) {
      setHighlight(intersects[0].object.userData.id);
    } else {
      setHighlight(null);
    }
  });

  container.addEventListener('mouseleave', function () {
    setHighlight(null);
  });

  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2.2;
  controls.maxDistance = 5;

  var driftTime = 0;
  function animate() {
    requestAnimationFrame(animate);
    driftTime += 0.012;

    graph.nodes.forEach(function (n, i) {
      var pos = nodePositions[n.id];
      var base = pos.base;
      var drift = pos.drift;
      drift.phi += (Math.sin(i * 0.7 + driftTime) * 0.002);
      drift.theta += (Math.cos(i * 0.5 + driftTime * 1.1) * 0.002);
      var r = GLOBE_RADIUS + NODE_PROTRUSION;
      var x = base.x + Math.sin(drift.phi) * 0.08;
      var y = base.y + Math.cos(drift.theta) * 0.08;
      var z = base.z + Math.sin(drift.phi + drift.theta) * 0.06;
      var len = Math.sqrt(x * x + y * y + z * z);
      pos.current.set(
        (x / len) * r,
        (y / len) * r,
        (z / len) * r
      );
      nodeMeshes[n.id].position.copy(pos.current);
    });
    updateLinkPositions();

    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  function addOrRemoveLink() {
    if (Math.random() < 0.55 && activePotential.length < graph.potentialLinks.length) {
      var available = graph.potentialLinks.filter(function (p) {
        var k = p.source < p.target ? p.source + '|' + p.target : p.target + '|' + p.source;
        return !linkLines[k];
      });
      if (available.length > 0) {
        var chosen = available[Math.floor(Math.random() * available.length)];
        addLink(chosen.source, chosen.target, true);
        activePotential.push(chosen);
      }
    } else if (activePotential.length > 0) {
      var idx = Math.floor(Math.random() * activePotential.length);
      var removed = activePotential.splice(idx, 1)[0];
      removeLink(removed.source, removed.target);
    }
  }
  setInterval(addOrRemoveLink, 3500);

  window.addEventListener('resize', function () {
    var w = container.clientWidth;
    var h = container.clientHeight;
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlobe);
} else {
  initGlobe();
}
