import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing } from '../theme';

const { width, height } = Dimensions.get('window');

const FAMOUS_SATELLITES = [
  { id: '25544', name: 'ISS (Zarya)', color: '#FFD500', size: 1.5, type: 'iss' },
  { id: '20580', name: 'Hubble Space Telescope', color: '#00D1FF', size: 1.2, type: 'hubble' },
  { id: '33591', name: 'NOAA 19', color: '#AF9F85', size: 1.0, type: 'sat' },
  { id: '44713', name: 'Starlink-1007', color: '#10B981', size: 0.8, type: 'sat' },
  { id: '44714', name: 'Starlink-1008', color: '#10B981', size: 0.8, type: 'sat' },
];

const STARLINKS = Array.from({ length: 250 }).map((_, i) => ({
  id: `SL-${i}`,
  name: `Starlink-${1000 + i}`,
  color: '#00FFAA',
  size: 0.3,
  type: 'sat'
}));

const ALL_SATELLITES = [...FAMOUS_SATELLITES, ...STARLINKS];

const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    body { margin: 0; background-color: #000; overflow: hidden; font-family: sans-serif; }
    #globeViz { width: 100vw; height: 100vh; }
    #hud {
      position: absolute; top: 10px; right: 10px; width: 180px; padding: 10px;
      background: rgba(0, 0, 0, 0.9); border: 2px solid #FFD500; color: #FFF;
      display: none; pointer-events: none; border-radius: 8px; z-index: 1000;
      backdrop-filter: blur(5px);
    }
    .hud-title { font-weight: 900; font-size: 13px; margin-bottom: 5px; color: #FFD500; text-transform: uppercase; border-bottom: 1px solid rgba(255,213,0,0.3); }
    .hud-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 10px; }
    #error-log { position: absolute; bottom: 0; width: 100%; color: #FFD500; font-size: 8px; background: rgba(0,0,0,0.8); z-index: 9999; max-height: 40px; overflow-y: auto; padding: 5px; }
    #loading-hint { position: absolute; top: 45%; width: 100%; text-align: center; color: #FFD500; font-weight: 900; font-size: 14px; letter-spacing: 2px; }
    #loading-hint span { font-size: 10px; opacity: 0.7; display: block; margin-top: 5px; }
  </style>
</head>
<body>
  <div id="loading-hint">STABILIZING ORBITAL LINK...<br/><span id="load-status">Downloading Engines...</span></div>
  <div id="globeViz"></div>
  <div id="error-log"></div>
  <div id="hud">
    <div id="hud-name" class="hud-title">SATELLITE</div>
    <div class="hud-row"><span>ALT</span><span id="hud-alt" style="font-weight:900">0 KM</span></div>
    <div class="hud-row"><span>VEL</span><span id="hud-vel" style="font-weight:900">0 KM/H</span></div>
    <div class="hud-row"><span>COORD</span><span id="hud-coord" style="font-weight:900">0, 0</span></div>
  </div>
  <script>
    const log = (msg) => { 
        document.getElementById('error-log').innerText += msg + '\\n'; 
        document.getElementById('error-log').scrollTop = document.getElementById('error-log').scrollHeight;
    };
    const setStatus = (msg) => { document.getElementById('load-status').innerText = msg; log(msg); };

    function loadScript(url) {
      return new Promise((resolve, reject) => {
        var s = document.createElement('script');
        s.src = url;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load ' + url));
        document.head.appendChild(s);
      });
    }

    async function boot() {
      try {
        setStatus('Downloading Three.js...');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.min.js');
        
        setStatus('UPLINK SUCCESSFUL. INITIALIZING 3D ENGINE...');
        init3D();
      } catch (e) {
        setStatus('Engine Download Failure');
        log(e.message);
      }
    }

    function init3D() {
      try {
        if (typeof THREE === 'undefined') throw new Error('THREE engine failed to compile.');

        let w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth || 400;
        let h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 800;
        if (w === 0) w = 400;
        if (h === 0) h = 800;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
        camera.position.z = 250;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        document.getElementById('globeViz').appendChild(renderer.domElement);

        window.addEventListener('resize', () => {
          w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
          h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
          if (w === 0 || h === 0) return;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        });

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(50, 20, 50);
        scene.add(dirLight);

        // Stars Background
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.5, transparent: true, opacity: 0.8 });
        const starsVertices = [];
        for (let i = 0; i < 2000; i++) {
          const x = (Math.random() - 0.5) * 800;
          const y = (Math.random() - 0.5) * 800;
          const z = -200 - Math.random() * 500;
          starsVertices.push(x, y, z);
        }
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const starField = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(starField);

        // Earth
        const R = 100;
        const earthGroup = new THREE.Group();
        scene.add(earthGroup);

        const textureLoader = new THREE.TextureLoader();
        const earthMat = new THREE.MeshPhongMaterial({
          map: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'),
          bumpMap: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png'),
          bumpScale: 2,
          specular: new THREE.Color(0x333333),
          shininess: 15
        });
        const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), earthMat);
        earthGroup.add(earthMesh);

        // Atmosphere Glow effect inside a slightly larger sphere
        const atmMat = new THREE.MeshPhongMaterial({
          color: 0x3a6699,
          transparent: true,
          opacity: 0.15,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 64, 64), atmMat);
        earthGroup.add(atmosphere);

        // Satellites Group
        const satEntities = [];

        function addSatellite(d) {
          const group = new THREE.Group();
          
          if (d.type === 'iss') {
            const truss = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 12, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 }));
            truss.rotation.z = Math.PI / 2;
            group.add(truss);
            const panelMat = new THREE.MeshStandardMaterial({ color: 0x113388, metalness: 0.3 });
            const p1 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 8), panelMat); p1.position.x = -4; group.add(p1);
            const p2 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 8), panelMat); p2.position.x = 4; group.add(p2);
            const mod = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 6, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2 }));
            group.add(mod);
          } else if (d.type === 'hubble') {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 8, 16), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }));
            group.add(body);
            const panelMat = new THREE.MeshStandardMaterial({ color: 0x224499, metalness: 0.5 });
            const p1 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 2.5), panelMat);
            group.add(p1);
          } else {
            const core = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7 }));
            const panel = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 1.5), new THREE.MeshStandardMaterial({ color: 0x1133aa, metalness: 0.4 }));
            group.add(core, panel);
          }

          // Scale adjusting
          group.scale.set(d.size/2, d.size/2, d.size/2);

          // Pointer interactions
          group.userData = d;

          // Glow ring to make them visible from far away
          const glow = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.4, depthWrite: false }));
          group.add(glow);

          return group;
        }

        // Coordinate projection helper
        function getPos(lat, lng, altRadius) {
          const phi = (90 - lat) * (Math.PI / 180);
          const theta = (lng + 180) * (Math.PI / 180);
          return new THREE.Vector3(
            -altRadius * Math.sin(phi) * Math.cos(theta),
            altRadius * Math.cos(phi),
            altRadius * Math.sin(phi) * Math.sin(theta)
          );
        }

        const INITIAL_SATS = [
          { name: 'ISS (Zarya)', lat: 0, lng: 0, alt: 0.15, color: '#FFD500', size: 1.5, type: 'iss' },
          { name: 'Hubble', lat: 20, lng: -40, alt: 0.2, color: '#00D1FF', size: 1.0, type: 'hubble' }
        ];

        function updateSatellites(data) {
          // Clear old
          satEntities.forEach(s => earthGroup.remove(s));
          satEntities.length = 0;

          data.forEach(d => {
            const mesh = addSatellite(d);
            const r = R * (1 + (d.alt || 0.15));
            mesh.position.copy(getPos(d.lat, d.lng, r));
            mesh.lookAt(new THREE.Vector3(0,0,0));
            mesh.rotateX(Math.PI / 2);
            earthGroup.add(mesh);
            satEntities.push(mesh);
          });
        }

        updateSatellites(INITIAL_SATS);

        // Interaction state
        let isDragging = false;
        let pX = 0, pY = 0;
        let tX = 0, tY = 0;
        
        let initialPinchDistance = null;
        let initialCameraZ = camera.position.z;

        document.addEventListener('touchstart', (e) => {
          if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDistance = Math.sqrt(dx*dx + dy*dy);
            initialCameraZ = camera.position.z;
          } else if (e.touches.length === 1) {
            isDragging = true;
            pX = e.touches[0].clientX; pY = e.touches[0].clientY;
            
            // Check tap on satellite via raycaster
            const mouse = new THREE.Vector2(
              (pX / window.innerWidth) * 2 - 1,
              -(pY / window.innerHeight) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(satEntities, true);
            if (intersects.length > 0) {
              let obj = intersects[0].object;
              while(obj.parent && !obj.userData.name) obj = obj.parent;
              if (obj.userData && obj.userData.name) {
                showHUD(obj.userData);
                try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECTION', data: obj.userData })); } catch(err){}
              }
            }
          }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
          if (e.touches.length === 2 && initialPinchDistance) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Scale camera Z based on pinch ratio
            let newZ = initialCameraZ * (initialPinchDistance / distance);
            
            // Clamp zoom
            if (newZ < 105) newZ = 105;
            if (newZ > 800) newZ = 800;
            camera.position.z = newZ;
            
          } else if (isDragging && e.touches.length === 1) {
            const dx = e.touches[0].clientX - pX;
            const dy = e.touches[0].clientY - pY;
            tX += dx * 0.005;
            tY += dy * 0.005;
            pX = e.touches[0].clientX;
            pY = e.touches[0].clientY;
          }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
          if (e.touches.length < 2) initialPinchDistance = null;
          if (e.touches.length === 0) isDragging = false;
        });

        // Optional scroll wheel support for desktop testing
        document.addEventListener('wheel', (e) => {
           let newZ = camera.position.z + e.deltaY * 0.2;
           if (newZ < 105) newZ = 105;
           if (newZ > 800) newZ = 800;
           camera.position.z = newZ;
        });

        document.getElementById('loading-hint').style.display = 'none';

        function showHUD(d) {
          document.getElementById('hud').style.display = 'block';
          document.getElementById('hud-name').innerText = d.name;
          document.getElementById('hud-alt').innerText = Math.round(d.altitude || 0) + ' KM';
          document.getElementById('hud-vel').innerText = Math.round(d.velocity || 0).toLocaleString() + ' KM/H';
          document.getElementById('hud-coord').innerText = d.lat.toFixed(1) + ', ' + d.lng.toFixed(1);
        }

        // Animation Loop
        const clock = new THREE.Clock();
        function animate() {
          requestAnimationFrame(animate);
          try {
            const delta = clock.getDelta();
            
            // Rotation logic - smooth inertial rotation
            earthGroup.rotation.y += 0.05 * delta;
            earthGroup.rotation.x += (tY - earthGroup.rotation.x) * 0.1;
            earthGroup.rotation.y += tX * 0.1;
            tX *= 0.95; tY *= 0.95;

            renderer.render(scene, camera);
          } catch (err) {
            log('Render Error: ' + err.message);
          }
        }
        animate();

        window.addEventListener('message', (e) => {
          try {
            const sats = JSON.parse(e.data);
            if (Array.isArray(sats)) {
              updateSatellites(sats);
              const curName = document.getElementById('hud-name').innerText;
              const selected = sats.find(s => s.name === curName);
              if (selected) showHUD(selected);
            }
          } catch (err) {}
        });
        
        document.addEventListener('message', (e) => {
          try {
            const sats = JSON.parse(e.data);
            if (Array.isArray(sats)) {
              updateSatellites(sats);
              const curName = document.getElementById('hud-name').innerText;
              const selected = sats.find(s => s.name === curName);
              if (selected) showHUD(selected);
            }
          } catch (err) {}
        });
        
      } catch (e) { log('Engine Failure: ' + e.message); }
    }

    boot();
  </script>
</body>
</html>
`;

export default function SatelliteTrackerScreen() {
  const [loading, setLoading] = useState(true);
  const [selectedSat, setSelectedSat] = useState<any>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    const interval = setInterval(updateSatellitePositions, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'SELECTION') {
        setSelectedSat(msg.data);
      }
    } catch (e) {
      console.log('WebView msg parse error:', e);
    }
  };

  const updateSatellitePositions = async () => {
    try {
      const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      if (!response.ok) return;
      const issJson = await response.json();

      const satelliteData = ALL_SATELLITES.map((sat, index) => {
        const isISS = sat.id === '25544';
        return {
          name: sat.name,
          lat: isISS ? issJson.latitude : (Math.random() * 180 - 90),
          lng: isISS ? issJson.longitude : (Math.random() * 360 - 180),
          alt: 0.15 + (index * 0.02),
          color: sat.color,
          size: sat.size,
          type: sat.type,
          velocity: isISS ? Math.round(issJson.velocity) : (25000 + Math.random() * 5000),
          altitude: isISS ? Math.round(issJson.altitude) : (400 + Math.random() * 500),
        };
      });

      // Update selected
      if (selectedSat && selectedSat.name.includes('ISS')) {
        const issUpdate = satelliteData.find(s => s.name.includes('ISS'));
        if (issUpdate) setSelectedSat(issUpdate);
      }

      webViewRef.current?.postMessage(JSON.stringify(satelliteData));
    } catch (e) {
      console.log('Satellite data fetch error:', e);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: HTML_CONTENT, baseUrl: 'https://localhost' }}
        style={styles.webview}
        onLoadEnd={() => {
          setLoading(false);
          updateSatellitePositions();
        }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        mixedContentMode="always"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mediaPlaybackRequiresUserAction={false}
      />
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Initializing Command Center...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loaderText: {
    color: '#FFF',
    marginTop: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
