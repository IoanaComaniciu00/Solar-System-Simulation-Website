import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 20000);
camera.position.set(0, 500, 1500);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const sunLight = new THREE.PointLight(0xffffff, 10, 0);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

// Texture Loader
const textureLoader = new THREE.TextureLoader();

const planets = [
    { name: 'mercury', size: 10, texture: 'textures/mercury/MercuryAlbedo.jpeg', normal: 'textures/mercury/MercuryNormal.jpeg', scale: 400000, tilt: 0.034, rotationSpeed: 0.004 },
    { name: 'venus', size: 20, texture: 'textures/venus/VenusAlbedo.jpeg', normal: 'textures/venus/VenusNormal.jpeg', scale: 400000, tilt: 177.4 * Math.PI / 180, rotationSpeed: -0.0001 },
    { name: 'earth', size: 22, texture: 'textures/earth/EarthAlbedo.jpeg', normal: 'textures/earth/EarthNormal.jpeg', roughness: 'textures/earth/EarthRoughness.jpeg', clouds: 'textures/earth/cloud_combined_2048.png', scale: 400000, tilt: 23.5 * Math.PI / 180, rotationSpeed: 0.01 },
    { name: 'mars', size: 18, texture: 'textures/mars/MarsAlbedo.jpeg', normal: 'textures/mars/MarsNormal.jpeg', scale: 400000, tilt: 25 * Math.PI / 180, rotationSpeed: 0.009 },
    { name: 'jupiter', size: 70, texture: 'textures/jupiter/JupiterAlbedo.jpeg', normal: 'textures/jupiter/JupiterNormal.jpeg', scale: 520000, tilt: 3.1 * Math.PI / 180, rotationSpeed: 0.04 },
    { name: 'saturn', size: 60, texture: 'textures/saturn/SaturnAlbedo.png', rings: 'textures/saturn/rings.png', normal: 'textures/saturn/SaturnNormal.png', scale: 520000, tilt: 26.7 * Math.PI / 180, rotationSpeed: 0.038 },
    { name: 'uranus', size: 40, texture: 'textures/uranus/UranusAlbedo.png', normal: 'textures/uranus/UranusNormal.png', scale: 520000, tilt: 97.8 * Math.PI / 180, rotationSpeed: 0.03 },
    { name: 'neptune', size: 39, texture: 'textures/neptune/NeptuneColor.jpeg', normal: 'textures/neptune/NeptuneNormal.jpeg', scale: 520000, tilt: 28.3 * Math.PI / 180, rotationSpeed: 0.032 },
    { name: 'pluto', size: 14, texture: 'textures/pluto/PlutoAlbedo.jpeg', normal: 'textures/pluto/PlutoNormal.jpeg', scale: 520000, tilt: 119.6 * Math.PI / 180, rotationSpeed: 0.003 }
];

const planetMeshes = {};
const orbitLines = {};
let orbitsVisible = true;

// Sun Core
const sunGeometry = new THREE.SphereGeometry(100, 64, 64);
const sunMaterial = new THREE.MeshStandardMaterial({
    map: textureLoader.load('textures/sun/SunAlbedo.jpeg'),
    emissive: 0xffaa00,
    emissiveIntensity: 1.2
});
const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sunMesh);

// Sun Glow using Sprite
const coronaTexture = textureLoader.load('textures/sun/SunCrown.png');
const coronaMaterial = new THREE.SpriteMaterial({
    map: coronaTexture,
    color: 0xffcc00,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const coronaSprite = new THREE.Sprite(coronaMaterial);
coronaSprite.scale.set(250, 250, 1);
sunMesh.add(coronaSprite);

// Load Planets
async function loadPlanets() {
    for (const planet of planets) {
        const geometry = new THREE.SphereGeometry(planet.size, 32, 32);
        const texture = textureLoader.load(planet.texture);
        if (planet.name !== 'earth') {
            texture.rotation = Math.PI / 4;
        }

        const normalMap = planet.normal ? textureLoader.load(planet.normal) : null;
        const roughnessMap = planet.roughness ? textureLoader.load(planet.roughness) : null;

        const material = new THREE.MeshStandardMaterial({
            map: texture,
            normalMap: normalMap,
            roughnessMap: roughnessMap,
            emissive: 0x111111,
            emissiveIntensity: 0.2
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.z = planet.tilt; // Axial tilt
        mesh.userData.rotationSpeed = planet.rotationSpeed;
        scene.add(mesh);
        planetMeshes[planet.name] = mesh;

        // Clouds for Earth
        if (planet.clouds) {
            const cloudTexture = textureLoader.load(planet.clouds);
            const cloudGeo = new THREE.SphereGeometry(planet.size * 1.01, 32, 32);
            const cloudMat = new THREE.MeshStandardMaterial({
                map: cloudTexture,
                transparent: true,
                opacity: 0.8
            });
            const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
            cloudMesh.name = 'clouds';
            mesh.add(cloudMesh);
        }

        // Saturn rings
        if (planet.rings) {
            const ringGeometry = new THREE.RingGeometry(planet.size * 1.2, planet.size * 2, 64);
            const ringMaterial = new THREE.MeshBasicMaterial({
                map: textureLoader.load(planet.rings),
                side: THREE.DoubleSide,
                transparent: true
            });
            const rings = new THREE.Mesh(ringGeometry, ringMaterial);
            rings.rotation.z = Math.PI / 2; // correct orientation
            mesh.add(rings);
        }

        // Load orbits from JSON
        const response = await fetch(`orbits/${planet.name}_positions.json`);
        const orbitData = await response.json();

        const orbitPoints = orbitData.map(d => new THREE.Vector3(d.pos[0] / planet.scale, d.pos[1] / planet.scale, d.pos[2] / planet.scale));
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const orbitLine = new THREE.LineLoop(orbitGeometry, orbitMaterial);
        scene.add(orbitLine);
        orbitLines[planet.name] = orbitLine;
    }

    document.getElementById('loading').style.display = 'none';
}

function createStarField() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 10000;
    const positions = [];

    for (let i = 0; i < starCount; i++) {
        const x = (Math.random() - 0.5) * 20000;
        const y = (Math.random() - 0.5) * 20000;
        const z = (Math.random() - 0.5) * 20000;
        positions.push(x, y, z);
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

loadPlanets();

let speed = 1;
let t = 0;
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Rotate sun
    sunMesh.rotation.z += 0.002;

    // Animate planets along orbit
    t += speed;
    for (const planet of planets) {
        const mesh = planetMeshes[planet.name];
        if (mesh) {
            const orbit = orbitLines[planet.name];
            if (orbit) {
                const position = orbit.geometry.attributes.position;
                const index = Math.floor((t / 2) % position.count);
                mesh.position.fromBufferAttribute(position, index);
                mesh.rotation.z += mesh.userData.rotationSpeed;

                // Rotate clouds 
                const cloudMesh = mesh.getObjectByName('clouds');
                if (cloudMesh) {
                    cloudMesh.rotation.z += 0.002;
                }
            }
        }
    }

    renderer.render(scene, camera);
}

animate();
createStarField();

// Toggle Orbits Button
document.getElementById('toggleOrbits').addEventListener('click', () => {
    orbitsVisible = !orbitsVisible;
    for (const line of Object.values(orbitLines)) {
        line.visible = orbitsVisible;
    }
});

// Speed Control Buttons
document.getElementById('speedUp').addEventListener('click', () => {
    speed *= 1.5;
});

document.getElementById('speedDown').addEventListener('click', () => {
    speed *= 0.7;
});

// Reset camera
document.getElementById('resetView').addEventListener('click', () => {
    camera.position.set(0, 500, 1500);
    controls.target.set(0, 0, 0);
    controls.update();
});
