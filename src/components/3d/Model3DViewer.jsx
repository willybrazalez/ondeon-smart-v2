import React, { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Stage, Html } from '@react-three/drei';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

function Model({ url, isPlaying, onPlayPause, onChannelChange, currentChannel, channels }) {
  const { scene } = useGLTF(url);
  const modelRef = useRef();
  const { camera } = useThree();

  // Efecto de profundidad suave
  useFrame(() => {
    if (modelRef.current) {
      modelRef.current.rotation.y = Math.sin(Date.now() * 0.0005) * 0.05;
      modelRef.current.position.z = Math.sin(Date.now() * 0.0003) * 0.05;
    }
  });

  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
    // Posición inicial de la cámara para mejor vista
    camera.position.set(-2, 1, 4);
  }, [scene, camera]);

  return (
    <group>
      <primitive ref={modelRef} object={scene} scale={1} position={[0, 0, 0]} />
      
      {/* Controles HTML sobre el modelo */}
      <Html position={[1, 0, 0]} style={{ pointerEvents: 'auto' }}>
        <div className="bg-background/80 backdrop-blur-md p-4 rounded-lg space-y-4 min-w-[200px]">
          <Button 
            onClick={onPlayPause}
            className="w-full"
            variant={isPlaying ? "destructive" : "default"}
          >
            {isPlaying ? "Pausar" : "Reproducir"}
          </Button>
          
          <select
            value={currentChannel?.id}
            onChange={(e) => onChannelChange(e.target.value)}
            className="w-full bg-background text-foreground border rounded p-2"
          >
            {channels.map(channel => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </div>
      </Html>
    </group>
  );
}

const LoadingSpinner = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
  </div>
);

const ErrorDisplay = () => (
  <div className="absolute inset-0 flex items-center justify-center text-destructive">
    <p>Error al cargar el modelo 3D</p>
  </div>
);

const Model3DViewer = ({ 
  modelUrl, 
  className = '', 
  isPlaying = false,
  onPlayPause,
  onChannelChange,
  currentChannel,
  channels = []
}) => {
  const [error, setError] = useState(false);

  return (
    <div className={`w-full h-full min-h-[400px] relative ${className}`}>
      <Canvas
        shadows
        camera={{ position: [-2, 1, 4], fov: 45 }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.6}>
            <Model 
              url={modelUrl} 
              isPlaying={isPlaying}
              onPlayPause={onPlayPause}
              onChannelChange={onChannelChange}
              currentChannel={currentChannel}
              channels={channels}
            />
          </Stage>
          <OrbitControls 
            enableZoom={false}
            enablePan={false}
            enableRotate={false}
            minPolarAngle={Math.PI/2.5}
            maxPolarAngle={Math.PI/2.5}
          />
        </Suspense>
      </Canvas>
      {error && <ErrorDisplay />}
    </div>
  );
};

// Precarga del modelo
useGLTF.preload('/models/tripo_pbr_model_eba03ec9-75d4-453b-8df8-5960d96a3843.glb');

export default Model3DViewer; 