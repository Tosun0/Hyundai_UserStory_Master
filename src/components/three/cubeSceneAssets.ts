// @ts-nocheck
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  PLAYBOOK_CATALOG,
  getPlaybookFallbackThumbnailSrc,
  getPlaybookThumbnailSrc,
  type PlaybookId,
} from "../../data/playbookCatalog";
import { CUBE_MAP_UNIT } from "./cubeMapData";

export function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
}

export function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose?.();

    if (mesh.material) {
      disposeMaterial(mesh.material);
    }
  });
}

function findFirstMesh(object: THREE.Object3D) {
  let result: THREE.Mesh | null = null;

  object.traverse((child) => {
    if (!result && (child as THREE.Mesh).isMesh) {
      result = child as THREE.Mesh;
    }
  });

  return result;
}

function normalizeCubeGeometry(sourceGeometry: THREE.BufferGeometry) {
  const geometry = sourceGeometry;
  geometry.computeBoundingBox();

  const bounds = geometry.boundingBox;

  if (!bounds) {
    return geometry;
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  geometry.translate(-center.x, -center.y, -center.z);

  const maxDimension = Math.max(size.x, size.y, size.z);

  if (Number.isFinite(maxDimension) && maxDimension > 0) {
    const scale = CUBE_MAP_UNIT / maxDimension;

    if (Math.abs(scale - 1) > 0.0001) {
      geometry.scale(scale, scale, scale);
    }
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

export async function loadCubeModelGeometry(src: string) {
  const gltf = await new GLTFLoader().loadAsync(src);
  gltf.scene.updateMatrixWorld(true);

  const sourceMesh = findFirstMesh(gltf.scene);

  if (!sourceMesh?.geometry) {
    throw new Error(`Cube model does not contain a mesh: ${src}`);
  }

  if (!sourceMesh.geometry.getAttribute("uv")) {
    throw new Error(`Cube model is missing UV Channel 1 data: ${src}`);
  }

  sourceMesh.updateWorldMatrix(true, false);
  const geometry = sourceMesh.geometry.clone();
  geometry.applyMatrix4(sourceMesh.matrixWorld);
  disposeObject(gltf.scene);

  return normalizeCubeGeometry(geometry);
}

function configureCubeMaskTexture(texture: THREE.Texture) {
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

export async function loadCubeMaskTexture(src: string, loader: THREE.TextureLoader) {
  return configureCubeMaskTexture(await loader.loadAsync(src));
}

function configureStoryThumbnailTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

export async function loadStoryThumbnailTextures(
  srcs: readonly string[],
  loader: THREE.TextureLoader,
) {
  const textures = await Promise.all(
    srcs.map(async (src) => {
      try {
        return configureStoryThumbnailTexture(await loader.loadAsync(src));
      } catch (error) {
        console.warn(`Story thumbnail failed to load: ${src}`, error);
        return null;
      }
    }),
  );

  return textures.filter((texture): texture is THREE.Texture => texture !== null);
}

export async function loadPlaybookThumbnailTextures(loader: THREE.TextureLoader) {
  const textures = await Promise.all(
    PLAYBOOK_CATALOG.map(async (playbook) => {
      const source = getPlaybookThumbnailSrc(playbook);

      try {
        return configureStoryThumbnailTexture(await loader.loadAsync(source));
      } catch (error) {
        const fallbackSource = getPlaybookFallbackThumbnailSrc(playbook);

        if (!fallbackSource || fallbackSource === source) {
          console.warn(`Playbook thumbnail failed to load: ${source}`, error);
          return null;
        }

        try {
          return configureStoryThumbnailTexture(await loader.loadAsync(fallbackSource));
        } catch (fallbackError) {
          console.warn(
            `Playbook thumbnail fallback failed to load: ${fallbackSource}`,
            fallbackError,
          );
          return null;
        }
      }
    }),
  );

  return new Map<PlaybookId, THREE.Texture | null>(
    PLAYBOOK_CATALOG.map((playbook, index) => [playbook.id, textures[index] ?? null]),
  );
}
