import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Volume2, Mic } from 'lucide-react';

const VolumeSliders = ({ 
  musicVolume, 
  setMusicVolume, 
  voiceVolume, 
  setVoiceVolume, 
  isVertical = false,
  showOnlyMusic = false,
  showOnlyVoice = false 
}) => {
  const containerClass = isVertical 
    ? "flex flex-col gap-6 h-48 justify-center items-center" 
    : "flex flex-col gap-3 mt-4 px-2";

  const sliderClass = isVertical
    ? "h-32 cursor-pointer [&>[role=slider]]:bg-[#A2D9F7] [&>[role=slider]]:border-[#A2D9F7] [&_[role=slider]]:hover:bg-[#A2D9F7]/90 [&_[data-orientation=vertical]>.relative>.absolute]:bg-[#A2D9F7]"
    : "cursor-pointer [&>[role=slider]]:bg-[#A2D9F7] [&>[role=slider]]:border-[#A2D9F7] [&_[role=slider]]:hover:bg-[#A2D9F7]/90 [&_[data-orientation=horizontal]>.relative>.absolute]:bg-[#A2D9F7]";

  const iconSize = isVertical ? 18 : 20;

  // Asegurar que los valores estén en formato array para Shadcn UI Slider
  const musicVolumeArray = Array.isArray(musicVolume) ? musicVolume : [musicVolume || 80];
  const voiceVolumeArray = Array.isArray(voiceVolume) ? voiceVolume : [voiceVolume || 100];

  // Funciones wrapper para convertir array a número
  const handleMusicVolumeChange = (value) => {
    const numericValue = Array.isArray(value) ? value[0] : value;
    setMusicVolume(numericValue);
  };

  const handleVoiceVolumeChange = (value) => {
    const numericValue = Array.isArray(value) ? value[0] : value;
    setVoiceVolume(numericValue);
  };

  return (
    <div className={containerClass}>
      {(!showOnlyVoice) && (
        <div className={isVertical ? "flex flex-col items-center gap-2" : "flex items-center gap-3"}>
          <Volume2 size={iconSize} className="text-[#A2D9F7]" />
          <Slider
            value={musicVolumeArray}
            onValueChange={handleMusicVolumeChange}
            max={100}
            step={1}
            orientation={isVertical ? "vertical" : "horizontal"}
            className={sliderClass}
          />
        </div>
      )}
      
      {(!showOnlyMusic) && (
        <div className={isVertical ? "flex flex-col items-center gap-2" : "flex items-center gap-3"}>
          <Mic size={iconSize} className="text-[#A2D9F7]" />
          <Slider
            value={voiceVolumeArray}
            onValueChange={handleVoiceVolumeChange}
            max={100}
            step={1}
            orientation={isVertical ? "vertical" : "horizontal"}
            className={sliderClass}
          />
        </div>
      )}
    </div>
  );
};

export default VolumeSliders;