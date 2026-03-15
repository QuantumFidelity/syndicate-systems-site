/**
 * Syndicate Systems — Particle Globe with Signals
 * Glowing points on continents, surface grid, orbital rings; signals travel between land points
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function xyzToLatLon(x, y, z) {
  var r = Math.sqrt(x * x + y * y + z * z);
  if (r < 1e-6) return { lat: 0, lon: 0 };
  var lat = Math.asin(Math.max(-1, Math.min(1, y / r))) * (180 / Math.PI);
  var lon = Math.atan2(z, x) * (180 / Math.PI);
  return { lat: lat, lon: lon };
}

function getLandDensity(lat, lon) {
  var toRad = Math.PI / 180;
  var cosLat = Math.cos(lat * toRad);
  var density = 0;
  var centers = [
    [50, -105, 0.42], [35, -95, 0.28], [25, -100, 0.32],
    [-10, -55, 0.35], [-20, -50, 0.22],
    [55, -5, 0.2], [50, 15, 0.25], [45, 25, 0.18],
    [5, 20, 0.28], [-15, 25, 0.22], [-25, 30, 0.18],
    [55, 70, 0.2], [45, 95, 0.32], [30, 105, 0.3],
    [20, 75, 0.25], [-25, 130, 0.28], [-20, 145, 0.15],
    [72, -40, 0.12], [-75, 0, 0.08]
  ];
  for (var i = 0; i < centers.length; i++) {
    var c = centers[i];
    var dLat = (lat - c[0]) * toRad;
    var dLon = ((lon - c[1]) * toRad) * (cosLat > 0.01 ? cosLat : 0.01);
    var distSq = dLat * dLat + dLon * dLon;
    density += c[2] * Math.exp(-distSq * 12);
  }
  var noise = (Math.sin(lat * 2.7) * Math.cos(lon * 1.9) + Math.sin(lon * 2.3) * 0.5 + 1) * 0.5;
  density += noise * 0.12;
  return Math.min(1, Math.max(0, density));
}

function latLonToVec3(lat, lon, radius) {
  var phi = (lat * Math.PI) / 180;
  var theta = (lon * Math.PI) / 180;
  var y = Math.sin(phi) * radius;
  var r = Math.cos(phi) * radius;
  return new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
}

function initGlobe() {
  var container = document.getElementById('systemDiagram');
  if (!container) return;

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  container.setAttribute('data-globe-active', 'true');

  /* Remove D3 diagram if it rendered first (race with module load) */
  var svg = container.querySelector('.system-diagram__svg');
  if (svg) svg.remove();

  var width = Math.max(container.clientWidth || 580, 300);
  var height = Math.max(container.clientHeight || 480, 300);

  var scene = new THREE.Scene();
  var ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  var dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  dirLight.position.set(0.6, 0.9, 0.5);
  scene.add(dirLight);
  /* Fill light — subtle from opposite side so dark side isn't flat black */
  var fillLight = new THREE.DirectionalLight(0xffffff, 0.15);
  fillLight.position.set(-0.5, -0.3, -0.4);
  scene.add(fillLight);
  var camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  /* Orbital rings extend to radius × 1.28 ≈ 1.38; need d ≥ 1.38/tan(25°) ≈ 2.96 */
  camera.position.z = 3.05;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, premultipliedAlpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xffffff, 1);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  var GLOBE_RADIUS = 1.08;
  var SIGNAL_COLOR = 0x888888;

  /* Continent signal targets — land points for signals to travel to */
  var signalTargets = [
    [42, -100], [50, 10], [35, 110], [-5, 35], [-25, 130], [65, -35],
    [-15, -55], [55, 75], [5, 20], [25, 90], [-35, 145]
  ];


  /* Shaded sphere base — softer gradient, ambient terminator, fill light */
  var lightDir = new THREE.Vector3(0.4, 0.9, 0.3).normalize();
  var fillDir = new THREE.Vector3(-0.5, -0.3, 0.4).normalize();
  var shadeMat = new THREE.ShaderMaterial({
    uniforms: {
      lightDir: { value: lightDir },
      fillDir: { value: fillDir }
    },
    vertexShader: [
      'varying vec3 vNormal;',
      'void main() {',
      '  vNormal = normalize(normalMatrix * normal);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 lightDir;',
      'uniform vec3 fillDir;',
      'varying vec3 vNormal;',
      'void main() {',
      '  float diff = max(0.0, dot(vNormal, lightDir));',
      '  float fill = max(0.0, dot(vNormal, fillDir)) * 0.25;',
      '  float ambient = 0.32;',
      '  float terminator = smoothstep(-0.15, 0.12, dot(vNormal, lightDir));',
      '  float lit = ambient + 0.55 * diff + fill + 0.08 * terminator;',
      '  float gray = mix(0.42, 0.91, lit);',
      '  vec3 col = vec3(gray, gray, gray);',
      '  gl_FragColor = vec4(col, 0.5);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: true,
    side: THREE.FrontSide
  });
  var shadeGeom = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 48);
  var shadeSphere = new THREE.Mesh(shadeGeom, shadeMat);
  shadeSphere.renderOrder = -2;
  scene.add(shadeSphere);

  /* Particle globe — dense on continents, sparse on ocean, blue-to-pink gradient */
  var particlePositions = [];
  var particleColors = [];
  var THRESHOLD = 0.38;
  var r = GLOBE_RADIUS;
  for (var lat = -85; lat <= 85; lat += 1.8) {
    for (var lon = -180; lon < 180; lon += 1.8) {
      var density = getLandDensity(lat, lon);
      var isLand = density >= THRESHOLD;
      var isOcean = density < THRESHOLD * 0.5;
      if (isLand || (!isOcean && Math.random() < 0.15)) {
        var v = latLonToVec3(lat, lon, r * 1.002);
        particlePositions.push(v.x, v.y, v.z);
        var n = v.clone().normalize();
        var diff = Math.max(0, n.dot(lightDir));
        var lit = 0.3 + 0.7 * diff;
        var gray = (isLand ? 0.85 : 0.4) * lit;
        particleColors.push(gray, gray, gray);
      }
    }
  }
  var particleGeom = new THREE.BufferGeometry();
  particleGeom.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
  particleGeom.setAttribute('color', new THREE.Float32BufferAttribute(particleColors, 3));
  var particleSizes = [];
  for (var pi = 0; pi < particlePositions.length / 3; pi++) {
    particleSizes.push(0.014 + Math.random() * 0.012);
  }
  particleGeom.setAttribute('size', new THREE.Float32BufferAttribute(particleSizes, 1));
  var particleMat = new THREE.ShaderMaterial({
    uniforms: {
      scale: { value: 180 }
    },
    vertexShader: [
      'attribute float size;',
      'attribute vec3 color;',
      'varying vec3 vColor;',
      'varying float vAlpha;',
      'void main() {',
      '  vColor = color;',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  vAlpha = 1.0 - smoothstep(1.2, 2.2, -mv.z) * 0.4;',
      '  gl_PointSize = size * scale / -mv.z;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vColor;',
      'varying float vAlpha;',
      'void main() {',
      '  vec2 c = gl_PointCoord - 0.5;',
      '  float r = length(c) * 2.0;',
      '  float soft = 1.0 - smoothstep(0.3, 0.85, r);',
      '  gl_FragColor = vec4(vColor, soft * 0.9 * vAlpha);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending
  });
  var particleGlobe = new THREE.Points(particleGeom, particleMat);
  scene.add(particleGlobe);

  /* Surface grid — lat/lon lines, subtle blue glow */
  var gridSegments = [];
  for (var gLat = -60; gLat <= 60; gLat += 30) {
    for (var gLon = 0; gLon < 360; gLon += 2) {
      var a = latLonToVec3(gLat, gLon, r * 1.002);
      var b = latLonToVec3(gLat, gLon + 2, r * 1.002);
      gridSegments.push(a, b);
    }
  }
  for (var gLon = -180; gLon < 180; gLon += 30) {
    for (var gLat = -75; gLat < 75; gLat += 2) {
      var a = latLonToVec3(gLat, gLon, r * 1.002);
      var b = latLonToVec3(gLat + 2, gLon, r * 1.002);
      gridSegments.push(a, b);
    }
  }
  var gridGeom = new THREE.BufferGeometry().setFromPoints(gridSegments);
  var gridDepthMat = new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(0x666666) },
      cameraPosition: { value: camera.position }
    },
    vertexShader: [
      'varying float vViewZ;',
      'void main() {',
      '  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
      '  vViewZ = -mvPos.z;',
      '  gl_Position = projectionMatrix * mvPos;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 baseColor;',
      'varying float vViewZ;',
      'void main() {',
      '  float depthFade = mix(0.35, 1.0, smoothstep(0.8, 1.8, vViewZ));',
      '  gl_FragColor = vec4(baseColor, 0.45 * depthFade);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false
  });
  var gridLines = new THREE.LineSegments(gridGeom, gridDepthMat);
  scene.add(gridLines);

  /* Orbital rings — arcs with front-to-back gradient, subtle glow */
  var orbitalRings = [];
  function addOrbitalRing(inclination, radiusScale) {
    var ringPts = [];
    for (var i = 0; i <= 72; i++) {
      var angle = (i / 72) * Math.PI * 2;
      var x = Math.cos(angle) * r * radiusScale;
      var z = Math.sin(angle) * r * radiusScale;
      var y = Math.sin(inclination) * z;
      var z2 = Math.cos(inclination) * z;
      ringPts.push(new THREE.Vector3(x, y, z2));
    }
    var ringGeom = new THREE.BufferGeometry().setFromPoints(ringPts);
    var ringMat = new THREE.ShaderMaterial({
      uniforms: {
        cameraPosition: { value: camera.position },
        baseColor: { value: new THREE.Color(0x888888) }
      },
      vertexShader: [
        'varying float vViewZ;',
        'void main() {',
        '  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
        '  vViewZ = -mvPos.z;',
        '  gl_Position = projectionMatrix * mvPos;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 baseColor;',
        'varying float vViewZ;',
        'void main() {',
        '  float depthFade = mix(0.35, 1.0, smoothstep(0.8, 1.9, vViewZ));',
        '  float glow = 0.08 + depthFade * 0.5;',
        '  gl_FragColor = vec4(baseColor, glow);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false
    });
    var ringLine = new THREE.Line(ringGeom, ringMat);
    ringLine.userData = { inclination: inclination, radiusScale: radiusScale, phase: Math.random() * Math.PI * 2 };
    orbitalRings.push(ringLine);
    scene.add(ringLine);
  }

  /* Coastline outlines — clearer continent definition */
  var coastSegments = [];
  var step = 2.5;
  var gridR = r * 1.003;
  for (var lat = -88; lat < 88; lat += step) {
    for (var lon = -180; lon < 180; lon += step) {
      var d00 = getLandDensity(lat, lon);
      var d10 = getLandDensity(lat + step, lon);
      var d01 = getLandDensity(lat, lon + step);
      var d11 = getLandDensity(lat + step, lon + step);
      var l00 = d00 >= THRESHOLD ? 1 : 0;
      var l10 = d10 >= THRESHOLD ? 1 : 0;
      var l01 = d01 >= THRESHOLD ? 1 : 0;
      var l11 = d11 >= THRESHOLD ? 1 : 0;
      var code = l00 | (l10 << 1) | (l01 << 2) | (l11 << 3);
      var lerp = function (a, b, t) { return a + (b - a) * t; };
      var lat0 = lat, lat1 = lat + step, lon0 = lon, lon1 = lon + step;
      if (code === 1 || code === 14) {
        coastSegments.push(latLonToVec3(lerp(lat0, lat1, (THRESHOLD - d00) / (d10 - d00 + 1e-6)), lon0, gridR), latLonToVec3(lat0, lerp(lon0, lon1, (THRESHOLD - d00) / (d01 - d00 + 1e-6)), gridR));
      } else if (code === 2 || code === 13) {
        coastSegments.push(latLonToVec3(lerp(lat0, lat1, (THRESHOLD - d00) / (d10 - d00 + 1e-6)), lon0, gridR), latLonToVec3(lat1, lerp(lon0, lon1, (THRESHOLD - d10) / (d11 - d10 + 1e-6)), gridR));
      } else if (code === 4 || code === 11) {
        coastSegments.push(latLonToVec3(lat0, lerp(lon0, lon1, (THRESHOLD - d00) / (d01 - d00 + 1e-6)), gridR), latLonToVec3(lerp(lat0, lat1, (THRESHOLD - d01) / (d11 - d01 + 1e-6)), lon1, gridR));
      } else if (code === 8 || code === 7) {
        coastSegments.push(latLonToVec3(lat1, lerp(lon0, lon1, (THRESHOLD - d10) / (d11 - d10 + 1e-6)), gridR), latLonToVec3(lerp(lat0, lat1, (THRESHOLD - d01) / (d11 - d01 + 1e-6)), lon1, gridR));
      } else if (code === 3 || code === 12) {
        coastSegments.push(latLonToVec3(lat0, lerp(lon0, lon1, (THRESHOLD - d00) / (d01 - d00 + 1e-6)), gridR), latLonToVec3(lat1, lerp(lon0, lon1, (THRESHOLD - d10) / (d11 - d10 + 1e-6)), gridR));
      } else if (code === 6 || code === 9) {
        coastSegments.push(latLonToVec3(lerp(lat0, lat1, (THRESHOLD - d00) / (d10 - d00 + 1e-6)), lon0, gridR), latLonToVec3(lerp(lat0, lat1, (THRESHOLD - d01) / (d11 - d01 + 1e-6)), lon1, gridR));
      } else if (code === 5) {
        coastSegments.push(latLonToVec3(lerp(lat0, lat1, (THRESHOLD - d00) / (d10 - d00 + 1e-6)), lon0, gridR), latLonToVec3(lat0, lerp(lon0, lon1, (THRESHOLD - d00) / (d01 - d00 + 1e-6)), gridR));
        coastSegments.push(latLonToVec3(lat1, lerp(lon0, lon1, (THRESHOLD - d10) / (d11 - d10 + 1e-6)), gridR), latLonToVec3(lerp(lat0, lat1, (THRESHOLD - d01) / (d11 - d01 + 1e-6)), lon1, gridR));
      } else if (code === 10) {
        coastSegments.push(latLonToVec3(lat0, lerp(lon0, lon1, (THRESHOLD - d00) / (d01 - d00 + 1e-6)), gridR), latLonToVec3(lerp(lat0, lat1, (THRESHOLD - d00) / (d10 - d00 + 1e-6)), lon0, gridR));
        coastSegments.push(latLonToVec3(lerp(lat0, lat1, (THRESHOLD - d01) / (d11 - d01 + 1e-6)), lon1, gridR), latLonToVec3(lat1, lerp(lon0, lon1, (THRESHOLD - d10) / (d11 - d10 + 1e-6)), gridR));
      }
    }
  }
  var coastGeom = new THREE.BufferGeometry().setFromPoints(coastSegments);
  var coastDepthMat = new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(0x333333) },
      cameraPosition: { value: camera.position }
    },
    vertexShader: [
      'varying float vViewZ;',
      'void main() {',
      '  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
      '  vViewZ = -mvPos.z;',
      '  gl_Position = projectionMatrix * mvPos;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 baseColor;',
      'varying float vViewZ;',
      'void main() {',
      '  float depthFade = mix(0.5, 1.0, smoothstep(0.8, 1.8, vViewZ));',
      '  gl_FragColor = vec4(baseColor, 0.82 * depthFade);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false
  });
  var coastLines = new THREE.LineSegments(coastGeom, coastDepthMat);
  scene.add(coastLines);

  addOrbitalRing(0.4, 1.15);
  addOrbitalRing(-0.3, 1.22);
  addOrbitalRing(0.7, 1.28);

  /* Atmosphere — subtle outer glow at globe edge */
  var atmosGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 1.06, 48, 32);
  var atmosMat = new THREE.ShaderMaterial({
    vertexShader: [
      'varying vec3 vNormal;',
      'varying vec3 vViewDir;',
      'void main() {',
      '  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
      '  vNormal = normalize(normalMatrix * normal);',
      '  vViewDir = normalize(-mvPos.xyz);',
      '  gl_Position = projectionMatrix * mvPos;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vNormal;',
      'varying vec3 vViewDir;',
      'void main() {',
      '  float f = 1.0 - abs(dot(normalize(vNormal), vViewDir));',
      '  f = pow(f, 2.5);',
      '  float alpha = f * 0.07;',
      '  gl_FragColor = vec4(0.5, 0.5, 0.5, alpha);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide
  });
  var atmosphere = new THREE.Mesh(atmosGeom, atmosMat);
  atmosphere.renderOrder = -3;
  scene.add(atmosphere);

  /* Signals — travel between continents */
  var signalState = null;
  var signalInterval = 0;

  function pickSignalTargets() {
    var a = signalTargets[Math.floor(Math.random() * signalTargets.length)];
    var b = signalTargets[Math.floor(Math.random() * signalTargets.length)];
    while (a === b) b = signalTargets[Math.floor(Math.random() * signalTargets.length)];
    return {
      from: latLonToVec3(a[0], a[1], GLOBE_RADIUS * 1.01),
      to: latLonToVec3(b[0], b[1], GLOBE_RADIUS * 1.01),
      progress: 0,
      color: SIGNAL_COLOR
    };
  }

  function spawnSignal() {
    if (signalState) return;
    signalState = pickSignalTargets();
  }

  var signalLine = null;

  /* OrbitControls — fixed view, no user interaction, slow auto-rotate */
  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableRotate = false;
  controls.minDistance = 3.05;
  controls.maxDistance = 3.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.28;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function animate() {
    requestAnimationFrame(animate);
    var dt = 0.016;
    var time = performance.now() * 0.001;

    if (signalState) {
      signalState.progress += 0.022;
      if (signalState.progress >= 1) {
        signalState.progress = 1;
        if (signalLine) {
          scene.remove(signalLine);
          signalLine.geometry.dispose();
          signalLine.material.dispose();
          signalLine = null;
        }
        signalState = null;
      } else {
        var from = signalState.from;
        var to = signalState.to;
        var t = easeInOutCubic(signalState.progress);
        var mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
        var out = mid.clone().normalize().multiplyScalar(0.4);
        var ctrl = mid.clone().add(out);
        var mt = 1 - t;
        var head = new THREE.Vector3(
          mt * mt * from.x + 2 * mt * t * ctrl.x + t * t * to.x,
          mt * mt * from.y + 2 * mt * t * ctrl.y + t * t * to.y,
          mt * mt * from.z + 2 * mt * t * ctrl.z + t * t * to.z
        );
        if (!signalLine) {
          var geom = new THREE.BufferGeometry().setFromPoints([from.clone(), head]);
          signalLine = new THREE.Line(geom, new THREE.LineBasicMaterial({
            color: signalState.color,
            transparent: true,
            opacity: 0.9
          }));
          scene.add(signalLine);
        } else {
          var pts = [];
          var n = 32;
          for (var i = 0; i <= n; i++) {
            var ti = (i / n) * t;
            var mti = 1 - ti;
            pts.push(new THREE.Vector3(
              mti * mti * from.x + 2 * mti * ti * ctrl.x + ti * ti * to.x,
              mti * mti * from.y + 2 * mti * ti * ctrl.y + ti * ti * to.y,
              mti * mti * from.z + 2 * mti * ti * ctrl.z + ti * ti * to.z
            ));
          }
          signalLine.geometry.dispose();
          signalLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
        }
      }
    }

    signalInterval += dt;
    if (signalInterval > 2.6 && !signalState) {
      signalInterval = 0;
      spawnSignal();
    }

    /* Subtle orbital ring oscillation — bounded, no drift */
    for (var ri = 0; ri < orbitalRings.length; ri++) {
      var rng = orbitalRings[ri];
      rng.rotation.y = Math.sin(time * 0.6 + rng.userData.phase) * 0.035;
    }

    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', function () {
    var w = Math.max(container.clientWidth || 0, 300);
    var h = Math.max(container.clientHeight || 0, 300);
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
  });
}

function tryInitGlobe() {
  var container = document.getElementById('systemDiagram');
  if (!container) return false;
  var w = container.clientWidth;
  var h = container.clientHeight;
  if (w > 0 && h > 0) {
    initGlobe();
    return true;
  }
  return false;
}

function scheduleInit() {
  if (tryInitGlobe()) return;
  var attempts = 0;
  var id = setInterval(function () {
    if (tryInitGlobe() || ++attempts > 20) {
      clearInterval(id);
      if (attempts > 20 && document.getElementById('systemDiagram')) initGlobe();
    }
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleInit);
} else {
  scheduleInit();
}
