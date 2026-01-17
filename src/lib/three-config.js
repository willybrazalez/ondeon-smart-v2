import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

// Configurar el cargador DRACO para mejor compresión
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');

// Configurar el cargador GLTF
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

export { gltfLoader, dracoLoader }; 