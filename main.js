/*

This is the main ThreeJS application file for the Solar System Simulation Website

*/

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Constants
const SUN_RADIUS = 10;
const FRAME_SPEED = 0.1;

// Planet data (radius,color and orbit_scale for each)
const planets = [
    { name: "Mercury", file: "mercury_positions.json", radius: 1.25, color: 0xff3333, ORBIT_SCALE: 0.0000005 },
    { name: "Venus", file: "venus_positions.json", radius: 2.5, color: 0xffcc33, ORBIT_SCALE: 0.0000005 },
    { name: "Earth", file: "earth_positions.json", radius: 2.75, color: 0x3399ff, ORBIT_SCALE: 0.0000005 },
    { name: "Mars", file: "mars_positions.json", radius: 1.75, color: 0xff6633, ORBIT_SCALE: 0.0000005 },
    { name: "Jupiter", file: "jupiter_positions.json", radius: 7, color: 0xffcc33, ORBIT_SCALE: 0.0000003 },
    { name: "Saturn", file: "saturn_positions.json", radius: 6, color: 0xffcc33, ORBIT_SCALE: 0.0000003 },
    { name: "Uranus", file: "uranus_positions.json", radius: 4.25, color: 0x66ccff, ORBIT_SCALE: 0.0000003 },
    { name: "Neptune", file: "neptune_positions.json", radius: 4, color: 0x3333ff, ORBIT_SCALE: 0.0000003 },
    { name: "Pluto", file: "pluto_positions.json", radius: 0.75, color: 0xaaaaaa, ORBIT_SCALE: 0.0000003 }
];

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 50, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000011);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = SUN_RADIUS * 1.5;
controls.maxDistance = 10000;

// Lighting
const sunLight = new THREE.PointLight(0xffffff, 2, 1000);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x404040));

// Sun
const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, emissive: 0xffff33, emissiveIntensity: 0.2 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);
controls.target.copy(sun.position);

// Create planet meshes 
const planetMeshes = {};
planets.forEach(p => {
    const geo = new THREE.SphereGeometry(p.radius, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
        color: p.color,
        emissive: p.color,
        emissiveIntensity: 0.3,
        roughness: 0.7,
        metalness: 0.1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = p.name;
    scene.add(mesh);
    planetMeshes[p.name] = mesh;

    // Orbit path line
    const line = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0x888888 })
    );
    scene.add(line);
    p.orbitPath = line;
});

// Store planet positions after loading JSON
const planetPositions = {};
let frameIndex = 0;

// Load all planet JSON files and start animation
const planetPromises = planets.map(planet =>
    fetch(planet.file)
        .then(res => res.json())
        .then(data => {
            planetPositions[planet.name] = data;
            console.log(`Loaded ${data.length} positions for ${planet.name}`);

            // Set orbit path using .pos
            const points = data
                .filter(entry => entry && entry.pos && entry.pos.length === 3)
                .map(entry => new THREE.Vector3(
                    entry.pos[0] * planet.ORBIT_SCALE,
                    entry.pos[1] * planet.ORBIT_SCALE,
                    entry.pos[2] * planet.ORBIT_SCALE
                ));

            planet.orbitPath.geometry.setFromPoints(points);
            console.log(`${planet.name} sample positions:`, data.slice(0, 5));
        })
        .catch(err => console.error(`Error loading ${planet.name}:`, err))
);

Promise.all(planetPromises).then(() => {
    console.log("All planets loaded. Starting animation...");
    animate();
});

// Starfield background
const createStarfield = () => {
    const starsGeometry = new THREE.BufferGeometry();
    const starCount = 5000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 10000;
        positions[i3 + 1] = (Math.random() - 0.5) * 10000;
        positions[i3 + 2] = (Math.random() - 0.5) * 10000;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1, sizeAttenuation: false });
    scene.add(new THREE.Points(starsGeometry, starsMaterial));
};
createStarfield();

// Animate planets
function animate() {
    requestAnimationFrame(animate);

    planets.forEach(p => {
        const positions = planetPositions[p.name];
        const mesh = planetMeshes[p.name];

        if (positions && positions.length > 0 && mesh) {
            const idx = Math.floor(frameIndex) % positions.length;
            const entry = positions[idx];

            if (entry && entry.pos && entry.pos.length === 3) {
                const [x, y, z] = entry.pos;

                mesh.position.set(
                    x * p.ORBIT_SCALE,
                    y * p.ORBIT_SCALE,
                    z * p.ORBIT_SCALE
                );

                if (p.name === "Mars" && frameIndex % 60 === 0) {
                    console.log("Mars pos:", entry.pos, "scaled:", mesh.position);
                }
            }
        }
    });

    frameIndex += FRAME_SPEED;
    controls.update();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
