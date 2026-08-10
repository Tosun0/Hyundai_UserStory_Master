import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const CUBE_SIZE = 12;
const CUBE_RADIUS = 0.45;
const CUBE_SEGMENTS = 2;
const OUTPUT_RELATIVE_PATH = "public/assets/models/rounded-cube-source.glb";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class NodeFileReader {
    result = null;
    error = null;
    onloadend = null;
    onerror = null;

    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((arrayBuffer) => {
          this.result = arrayBuffer;
          queueMicrotask(() => this.onloadend?.({ target: this }));
        })
        .catch((error) => {
          this.error = error;
          queueMicrotask(() => this.onerror?.(error));
        });
    }

    readAsDataURL(blob) {
      blob
        .arrayBuffer()
        .then((arrayBuffer) => {
          const mimeType = blob.type || "application/octet-stream";
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          this.result = `data:${mimeType};base64,${base64}`;
          queueMicrotask(() => this.onloadend?.({ target: this }));
        })
        .catch((error) => {
          this.error = error;
          queueMicrotask(() => this.onerror?.(error));
        });
    }
  };
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(rootDir, OUTPUT_RELATIVE_PATH);
const outputDir = path.dirname(outputPath);

const geometry = new RoundedBoxGeometry(
  CUBE_SIZE,
  CUBE_SIZE,
  CUBE_SIZE,
  CUBE_SEGMENTS,
  CUBE_RADIUS,
);
geometry.computeBoundingBox();
geometry.computeBoundingSphere();
geometry.computeVertexNormals();

const material = new THREE.MeshStandardMaterial({
  name: "Neutral PBR Material",
  color: new THREE.Color("#f7fffb"),
  roughness: 0.35,
  metalness: 0,
});

const mesh = new THREE.Mesh(geometry, material);
mesh.name = "Rounded Cube Source";
mesh.userData = {
  source: "Cube View procedural RoundedBoxGeometry",
  width: CUBE_SIZE,
  height: CUBE_SIZE,
  depth: CUBE_SIZE,
  radius: CUBE_RADIUS,
  segments: CUBE_SEGMENTS,
};

const scene = new THREE.Scene();
scene.name = "Cube View Rounded Cube Source";
scene.add(mesh);

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, {
  binary: true,
  onlyVisible: true,
});

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, Buffer.from(glb));

console.log(`Exported ${OUTPUT_RELATIVE_PATH}`);
console.log(
  `RoundedBoxGeometry(${CUBE_SIZE}, ${CUBE_SIZE}, ${CUBE_SIZE}, ${CUBE_SEGMENTS}, ${CUBE_RADIUS})`,
);
