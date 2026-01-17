'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Volume2, 
  Mic,
  Home as HomeIcon,
  Radio,
  BookOpen,
  History as HistoryIcon,
  MessageSquare,
  Circle
} from 'lucide-react'
import WaveBackground from '@/components/WaveBackround'
import Image from 'next/image'

type DisplayMode = 'visual' | 'image' | 'iframe'

interface OndeonAppShowcaseProps {
  mode?: DisplayMode
  imageSrc?: string
  iframeSrc?: string
}

const NavItem = ({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) => {
  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
        active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white/80'
      }`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={`text-xs ${active ? 'text-white' : 'text-white/60'}`}>
        {label}
      </span>
    </div>
  )
}

export default function OndeonAppShowcase({ 
  mode = 'visual',
  imageSrc = '/images/ondeon-app-screenshot.png',
  iframeSrc = 'https://ondeon.smart.app'
}: OndeonAppShowcaseProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentChannel, setCurrentChannel] = useState(0)
  const [musicVolume, setMusicVolume] = useState(80)
  const [micVolume, setMicVolume] = useState(100)
  const [isVisible, setIsVisible] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [showLoginOverlay, setShowLoginOverlay] = useState(true)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  // Efecto 3D que sigue el mouse
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const x = ((e.clientX - centerX) / rect.width) * 15
        const y = ((e.clientY - centerY) / rect.height) * 15
        setMousePosition({ x, y })
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
          }
        })
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
      window.addEventListener('mousemove', handleMouseMove)
    }

    return () => {
      if (containerRef.current) {
        observer.disconnect()
      }
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  // Efecto de visualizador de audio simulado
  useEffect(() => {
    if (!isPlaying || !canvasRef.current) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = 50
    const bars = 32
    const angleStep = (Math.PI * 2) / bars
    
    let barHeights = new Array(bars).fill(0)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < bars; i++) {
        let targetHeight = Math.random() * 20 + 5
        
        if (i < 10 || (i > 20 && i < 25)) {
          targetHeight += Math.random() * 15
        }

        barHeights[i] += (targetHeight - barHeights[i]) * 0.2
        
        const height = barHeights[i]
        const angle = i * angleStep - Math.PI / 2

        const x1 = centerX + Math.cos(angle) * radius
        const y1 = centerY + Math.sin(angle) * radius
        const x2 = centerX + Math.cos(angle) * (radius + height)
        const y2 = centerY + Math.sin(angle) * (radius + height)

        let color
        if (i < bars / 3) {
          color = `rgba(100, 200, 255, 0.8)`
        } else if (i < (bars * 2) / 3) {
          color = `rgba(162, 217, 247, 0.8)`
        } else {
          color = `rgba(200, 230, 255, 0.8)`
        }

        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        
        if (height > 20) {
          ctx.shadowBlur = 10
          ctx.shadowColor = color
        } else {
          ctx.shadowBlur = 0
        }
        
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying])

  const channels = [
    { name: 'Tiki Taka R&B', image: null },
    { name: 'Pop Hits', image: null },
    { name: 'Rock Classics', image: null },
  ]

  const currentSong = {
    title: 'Lost Obsidian Horizons',
    artist: 'Ondeón'
  }

  const handlePrevChannel = () => {
    setCurrentChannel((prev) => (prev === 0 ? channels.length - 1 : prev - 1))
  }

  const handleNextChannel = () => {
    setCurrentChannel((prev) => (prev === channels.length - 1 ? 0 : prev + 1))
  }

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  if (mode === 'image') {
    return (
      <div className="relative w-full max-w-md mx-auto aspect-[9/16]">
        <Image 
          src={imageSrc} 
          alt="Ondeon Smart App" 
          fill
          className="object-contain rounded-lg shadow-2xl"
          priority
          onError={() => setImageError(true)}
        />
      </div>
    )
  }

  if (mode === 'iframe') {
    return (
      <div className="relative w-full max-w-md mx-auto aspect-[9/16] rounded-lg overflow-hidden shadow-2xl">
        <iframe
          src={iframeSrc}
          className="w-full h-full border-0"
          title="Ondeon Smart App"
          allow="autoplay; encrypted-media"
        />
      </div>
    )
  }

  return (
    <div className="w-full flex justify-center py-16 md:py-24 overflow-visible">
      <div 
        ref={containerRef}
        className="relative w-[1200px] origin-top transition-transform duration-300"
        style={{
          transform: `scale(var(--scale, 1)) perspective(1000px) rotateY(${mousePosition.x * 0.1}deg) rotateX(${-mousePosition.y * 0.1}deg)`,
          ['--scale' as any]: '0.7',
        }}
      >
        <style jsx>{`
          @media (min-width: 640px) { div[style] { --scale: 0.9; } }
          @media (min-width: 768px) { div[style] { --scale: 1.0; } }
          @media (min-width: 1024px) { div[style] { --scale: 1.25; } }
          @media (min-width: 1400px) { div[style] { --scale: 1.4; } }
        `}</style>

        <div className="absolute inset-0 -z-10">
          <div
            className="w-full h-full rounded-3xl blur-3xl opacity-40"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(162, 217, 247, 0.3) 0%, transparent 70%)',
              transform: 'translateY(60px) scale(1.2)',
            }}
          />
        </div>

        <style>{`
          .ondeon-showcase .volume-slider-vertical {
            -webkit-appearance: none;
            appearance: none;
            background: transparent;
            cursor: pointer;
            outline: none;
          }
          .ondeon-showcase .volume-slider-vertical::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
            box-shadow: 0 0 4px rgba(0,0,0,0.3);
            margin-top: -4px;
          }
          .ondeon-showcase .volume-slider-vertical::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
            border: none;
            box-shadow: 0 0 4px rgba(0,0,0,0.3);
          }
          .ondeon-showcase .volume-slider-vertical::-webkit-slider-runnable-track {
            width: 4px;
            height: 100%;
            background: transparent;
          }
          .ondeon-showcase .volume-slider-vertical::-moz-range-track {
            width: 4px;
            height: 100%;
            background: transparent;
          }
        `}</style>

        {/* Fondo animado SOLO cuando está reproduciendo */}
        {isPlaying && (
          <div className="ondeon-showcase absolute inset-0 rounded-[32px] overflow-hidden -z-10">
            <WaveBackground isPlaying={isPlaying} />
          </div>
        )}

        <div className={`ondeon-showcase relative w-full rounded-[32px] overflow-hidden ${isPlaying ? 'bg-transparent' : 'bg-[#09090b]'} text-white font-sans antialiased shadow-2xl border border-white/5 px-12 py-10`}>
          {/* Fondo estático cuando NO está reproduciendo */}
          {!isPlaying && (
            <div className="absolute inset-0 bg-[#09090b] -z-10" />
          )}

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center shadow-[0_0_24px_rgba(0,0,0,0.7)]">
                  <div className="w-7 h-7 rounded-full border-2 border-white/80 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full border-2 border-[#A2D9F7]" />
                  </div>
                </div>
                <span className="text-sm tracking-[0.35em] text-[#A2D9F7] font-semibold uppercase">
                  SMART
                </span>
              </div>

              <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-lg">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse" />
                <span className="text-xs text-white/90 font-medium">
                  TikiTakaAdministrador
                </span>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#A2D9F7] text-xs border border-white/10">
                  ☀
                </div>
                <div className="w-8 h-8 rounded-full bg-[#FF2E9F]/10 flex items-center justify-center text-[#FF2E9F] text-xs border border-[#FF2E9F]/40">
                  ⚙
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 mb-10">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePrevChannel}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10"
              >
                <ChevronLeft className="w-5 h-5 text-white/70" />
              </motion.button>

              <div className="flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/5 backdrop-blur-lg border border-white/10 shadow-[0_0_25px_rgba(0,0,0,0.6)]">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-purple-500/30 flex items-center justify-center border border-purple-300/40 shadow-[0_0_18px_rgba(168,85,247,0.6)]">
                  <Mic className="w-4 h-4 text-purple-100" />
                </div>
                <span className="text-sm text-white font-medium">
                  {channels[currentChannel].name}
                </span>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNextChannel}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10"
              >
                <ChevronRight className="w-5 h-5 text-white/70" />
              </motion.button>
            </div>

            <div className="text-center mb-10">
              <h2 className="text-[26px] md:text-[30px] font-semibold text-white tracking-wide mb-2">
                {currentSong.title}
              </h2>
              <p className="text-sm md:text-base text-white/70 tracking-[0.4em] uppercase">
                {currentSong.artist}
              </p>
            </div>

            <div className="flex items-center justify-between mb-12">
              <div className="flex flex-col items-center gap-4">
                <div className="text-xs text-white/80 bg-white/5 px-3 py-1 rounded-full">
                  {musicVolume}%
                </div>
                <div className="relative h-44 w-7 flex items-center justify-center">
                  <div
                    className="absolute bottom-6 w-1.5 rounded-full transition-all duration-200"
                    style={{
                      height: `${musicVolume}%`,
                      background: 'linear-gradient(to top, #A2D9F7, #7BC4E8)',
                      boxShadow: '0 0 14px rgba(162,217,247,0.7)',
                    }}
                  />
                  <div className="absolute bottom-6 w-1.5 h-32 rounded-full bg-white/5" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(parseInt(e.target.value))}
                    className="volume-slider-vertical absolute inset-y-2 inset-x-0 opacity-0 cursor-pointer z-10"
                    style={{
                      writingMode: 'vertical-lr',
                      direction: 'rtl',
                    }}
                  />
                </div>
                <Volume2 className="w-5 h-5 text-white/75" />
              </div>

              <div className="relative flex-1 flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={300}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ opacity: isPlaying ? 1 : 0, transition: 'opacity 0.3s ease' }}
                />

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-gradient-to-b from-white/5 via-transparent to-transparent opacity-70" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full border border-white/5" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full border border-white/10" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[170px] h-[170px] rounded-full border border-white/15 shadow-[0_0_25px_rgba(162,217,247,0.35)] opacity-80" />
                </div>

                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePlayPause}
                  className="relative w-24 h-24 rounded-full bg-white/6 border border-white/30 backdrop-blur-xl flex items-center justify-center shadow-[0_0_45px_rgba(162,217,247,0.7)]"
                >
                  {isPlaying ? (
                    <Pause className="w-11 h-11 text-white" />
                  ) : (
                    <Play className="w-11 h-11 text-white ml-1" />
                  )}
                </motion.button>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="text-xs text-white/80 bg-white/5 px-3 py-1 rounded-full">
                  {micVolume}%
                </div>
                <div className="relative h-44 w-7 flex items-center justify-center">
                  <div
                    className="absolute bottom-6 w-1.5 rounded-full transition-all duration-200"
                    style={{
                      height: `${micVolume}%`,
                      background: 'linear-gradient(to top, #22c55e, #a3e635)',
                      boxShadow: '0 0 14px rgba(34,197,94,0.8)',
                    }}
                  />
                  <div className="absolute bottom-6 w-1.5 h-32 rounded-full bg-white/5" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={micVolume}
                    onChange={(e) => setMicVolume(parseInt(e.target.value))}
                    className="volume-slider-vertical absolute inset-y-2 inset-x-0 opacity-0 cursor-pointer z-10"
                    style={{
                      writingMode: 'vertical-lr',
                      direction: 'rtl',
                    }}
                  />
                </div>
                <Mic className="w-5 h-5 text-white/75" />
              </div>
            </div>

            <div className="mt-12">
              <div className="flex items-center justify-center gap-12 mb-3">
                <NavItem icon={HomeIcon} label="Reproductor" active />
                <NavItem icon={Radio} label="Canales" />
                <NavItem icon={BookOpen} label="Contenidos" />
                <NavItem icon={HistoryIcon} label="Historial" />
                <NavItem icon={MessageSquare} label="Soporte" />
              </div>
              <p className="text-center text-xs text-muted-foreground/70">
                Ondeon Smart v0.0.34
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
