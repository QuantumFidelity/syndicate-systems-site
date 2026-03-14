/**
 * Syndicate Systems — Particle Globe with Signals
 * Glowing points on continents, surface grid, orbital rings; signals trigger color ripple
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
  var ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  var dirLight = new THREE.DirectionalLight(0xaaccff, 0.9);
  dirLight.position.set(0.6, 0.9, 0.5);
  scene.add(dirLight);
  var camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.z = 2.25;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, premultipliedAlpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xfafafa, 1);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  var GLOBE_RADIUS = 1.08;
  var RIPPLE_COLORS = [0xffffff, 0xe0e0e0, 0xc0c0c0, 0xa0a0a0];

  /* Continent signal targets — land points for signals to travel to */
  var signalTargets = [
    [42, -100], [50, 10], [35, 110], [-5, 35], [-25, 130], [65, -35],
    [-15, -55], [55, 75], [5, 20], [25, 90], [-35, 145]
  ];


  /* Shaded sphere base — gives globe volume, not flat wire */
  var lightDir = new THREE.Vector3(0.4, 0.9, 0.3).normalize();
  var shadeMat = new THREE.ShaderMaterial({
    uniforms: {
      lightDir: { value: lightDir }
    },
    vertexShader: [
      'varying vec3 vNormal;',
      'varying vec3 vWorldPos;',
      'void main() {',
      '  vNormal = normalize(normalMatrix * normal);',
      '  vec4 w = modelMatrix * vec4(position, 1.0);',
      '  vWorldPos = w.xyz;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 lightDir;',
      'varying vec3 vNormal;',
      'varying vec3 vWorldPos;',
      'void main() {',
      '  float diff = max(0.0, dot(vNormal, lightDir));',
      '  float ambient = 0.25;',
      '  float lit = ambient + 0.65 * diff;',
      '  float gray = mix(0.35, 0.92, lit);',
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
  var particleMat = new THREE.PointsMaterial({
    size: 0.02,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    sizeAttenuation: true,
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
  var gridLines = new THREE.LineSegments(gridGeom, new THREE.LineBasicMaterial({
    color: 0x666666,
    transparent: true,
    opacity: 0.45
  }));
  scene.add(gridLines);

  /* Orbital rings — arcs around the globe */
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
    var gray = 0.5;
    var ringMat = new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.5
    });
    scene.add(new THREE.Line(ringGeom, ringMat));
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
  var coastLines = new THREE.LineSegments(coastGeom, new THREE.LineBasicMaterial({
    color: 0x333333,
    transparent: true,
    opacity: 0.75
  }));
  scene.add(coastLines);

  addOrbitalRing(0.4, 1.15);
  addOrbitalRing(-0.3, 1.22);
  addOrbitalRing(0.7, 1.28);

  var rippleState = { active: false, origin: new THREE.Vector3(), progress: 0, color: new THREE.Color(0xffffff), intensity: 0 };
  var globeMat = new THREE.ShaderMaterial({
    uniforms: {
      rippleOrigin: { value: new THREE.Vector3() },
      rippleProgress: { value: 0 },
      rippleColor: { value: new THREE.Color(0xffffff) },
      rippleIntensity: { value: 0 }
    },
    vertexShader: [
      'varying vec3 vWorldPosition;',
      'void main() {',
      '  vec4 p = modelMatrix * vec4(position, 1.0);',
      '  vWorldPosition = p.xyz;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 rippleOrigin;',
      'uniform float rippleProgress;',
      'uniform vec3 rippleColor;',
      'uniform float rippleIntensity;',
      'varying vec3 vWorldPosition;',
      'void main() {',
      '  gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);',
      '  if (rippleIntensity > 0.0) {',
      '    vec3 n = normalize(vWorldPosition);',
      '    vec3 o = normalize(rippleOrigin);',
      '    float ang = acos(clamp(dot(n, o), -1.0, 1.0));',
      '    float ring = rippleProgress * 3.14159;',
      '    float d = abs(ang - ring);',
      '    float falloff = exp(-d * 1.8) * (1.0 - rippleProgress * 0.2);',
      '    float glow = exp(-ang * 0.9) * (1.0 - rippleProgress * 0.3);',
      '    vec3 col = rippleColor * (falloff * 1.0 + glow * 0.6) * rippleIntensity;',
      '    gl_FragColor = vec4(col, min(0.55, length(col) * 0.8) * rippleIntensity);',
      '  }',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false
  });
  var globeFillGeom = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 48);
  var globeFill = new THREE.Mesh(globeFillGeom, globeMat);
  globeFill.renderOrder = -1;
  scene.add(globeFill);

  /* Signals — travel between continents, trigger ripple on arrival */
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
      color: RIPPLE_COLORS[Math.floor(Math.random() * RIPPLE_COLORS.length)]
    };
  }

  function spawnSignal() {
    if (signalState) return;
    signalState = pickSignalTargets();
  }

  var signalLine = null;

  /* OrbitControls — fixed zoom, slow auto-rotate */
  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.minDistance = 2.25;
  controls.maxDistance = 2.25;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;

  function hexToRgb255(hex) {
    return [((hex >> 16) & 255), ((hex >> 8) & 255), (hex & 255)];
  }

  function updateRippleCSS() {
    var root = document.documentElement;
    var hero = document.getElementById('hero');
    if (rippleState.active && rippleState.intensity > 0) {
      var rgb = hexToRgb255(rippleState.color.getHex());
      root.style.setProperty('--ripple-r', String(rgb[0]));
      root.style.setProperty('--ripple-g', String(rgb[1]));
      root.style.setProperty('--ripple-b', String(rgb[2]));
      root.style.setProperty('--ripple-intensity', String(rippleState.intensity));
      if (hero) hero.setAttribute('data-ripple', 'true');
    } else {
      root.style.setProperty('--ripple-intensity', '0');
      if (hero) hero.removeAttribute('data-ripple');
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    var dt = 0.016;

    if (signalState) {
      signalState.progress += 0.012;
      if (signalState.progress >= 1) {
        signalState.progress = 1;
        if (signalLine) {
          scene.remove(signalLine);
          signalLine.geometry.dispose();
          signalLine.material.dispose();
          signalLine = null;
        }
        rippleState.active = true;
        rippleState.origin.copy(signalState.to);
        rippleState.progress = 0;
        rippleState.color.setHex(typeof signalState.color === 'number' ? signalState.color : 0xffffff);
        rippleState.intensity = 1;
        signalState = null;
      } else {
        var from = signalState.from;
        var to = signalState.to;
        var t = signalState.progress;
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

    if (rippleState.active) {
      rippleState.progress += 0.018;
      rippleState.intensity = Math.max(0, 1 - rippleState.progress * 0.4);
      if (rippleState.progress >= 1) {
        rippleState.active = false;
        rippleState.intensity = 0;
      }
      globeMat.uniforms.rippleOrigin.value.copy(rippleState.origin);
      globeMat.uniforms.rippleProgress.value = rippleState.progress;
      globeMat.uniforms.rippleColor.value.copy(rippleState.color);
      globeMat.uniforms.rippleIntensity.value = rippleState.intensity;
      updateRippleCSS();
    } else {
      updateRippleCSS();
    }

    signalInterval += dt;
    if (signalInterval > 3.5 && !signalState && !rippleState.active) {
      signalInterval = 0;
      spawnSignal();
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
