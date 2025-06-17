import * as THREE from 'three';
// create a scene
const scene = new THREE.Scene();
// Perspective camera (field of view, aspect ratio, near, far)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
//create a renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate); // set the animation loop to call animate function
document.body.appendChild(renderer.domElement);
// create a cube
const geometry = new THREE.BoxGeometry(1, 1, 1); // create a box geometry with width, height, depth
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material); // create a mesh with geometry and material
scene.add(cube);

camera.position.z = 5;

function animate() {

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    renderer.render(scene, camera); // render the scene from the perspective of the camera

}
