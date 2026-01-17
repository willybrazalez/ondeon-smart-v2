import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ChevronRight, ChevronLeft, Wand2, Volume2 as VoiceIcon, Check, Loader2, UploadCloud, Lightbulb, Mic, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const STEPS_CONFIG = [
  { id: 1, name: 'Texto del Anuncio', icon: Wand2, cleanName: 'Concepto Creativo' },
  { id: 2, name: 'Voz y Tono', icon: VoiceIcon, cleanName: 'Selección de Voz' },
  { id: 3, name: 'Publicación', icon: UploadCloud, cleanName: 'Finalizar y Publicar' },
];

const AI_VOICES = [
  { id: 'voice_professional_multi', name: 'Profesional (Multilingüe Clara)', lang: 'multi', gender: 'Neutra' },
  { id: 'voice_narrator_es', name: 'Narrador (Español Sereno)', lang: 'es-ES', gender: 'Calmada' },
  { id: 'voice_clear_en', name: 'Clear Voice (Inglés Nítido)', lang: 'en-US', gender: 'Directa' },
  { id: 'voice_soft_fr', name: 'Voix Douce (Francés Suave)', lang: 'fr-FR', gender: 'Amable' },
];

const AD_GROUPS = ['Ofertas Destacadas', 'Avisos Generales', 'Novedades', 'Eventos Especiales'];
const PHARMACY_NAME = "Farmacia EsenciaVerde";


const CreativeStep = ({ adText, setAdText, isGenerating, handleGenerateText, isListening, handleDictateText, adTextRef }) => (
  <div className="space-y-5">
    <div>
      <Label htmlFor="adText" className="text-secondary font-sans text-md mb-1.5 block">Escribe tu Mensaje (o deja que la IA te inspire para {PHARMACY_NAME}):</Label>
      <div className="relative">
        <Textarea
          ref={adTextRef}
          id="adText"
          placeholder={`Ej: "En ${PHARMACY_NAME}, cuidamos de ti..." o pulsa "Generar Borrador"`}
          value={adText}
          onChange={(e) => setAdText(e.target.value)}
          rows={6}
          useCleanStyle={true}
          className="pr-10"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDictateText}
          disabled={isListening}
          className="absolute right-1.5 top-1.5 text-primary hover:text-accent disabled:opacity-70"
          title="Dictar Texto"
        >
          {isListening ? <Loader2 size={20} className="animate-spin text-accent" /> : <Mic size={20} />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1 text-right">Caracteres: {adText.length}</p>
    </div>
    <Button onClick={handleGenerateText} disabled={isGenerating} variant="secondary" className="w-full clean-button-secondary">
      {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
      Generar Borrador con IA
    </Button>
  </div>
);

const VoiceStep = ({ selectedVoice, setSelectedVoice, adText, isPlayingPreview, handlePlayPreview }) => (
  <div className="space-y-5">
    <div>
      <Label htmlFor="aiVoice" className="text-secondary font-sans text-md mb-1.5 block">Selecciona una Voz:</Label>
      <Select value={selectedVoice} onValueChange={setSelectedVoice} useCleanStyle={true}>
        <SelectTrigger useCleanStyle={true}>
          <SelectValue placeholder="Elige una voz..." />
        </SelectTrigger>
        <SelectContent useCleanStyle={true}>
          {AI_VOICES.map(voice => (
            <SelectItem key={voice.id} value={voice.id} useCleanStyle={true}>{voice.name} ({voice.gender})</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <Button onClick={handlePlayPreview} disabled={!adText || isPlayingPreview} variant="outline" className="w-full clean-button-outline">
      {isPlayingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
      Escuchar Muestra de Voz
    </Button>
    <div className="text-sm text-muted-foreground p-3.5 rounded-md bg-input/90 border border-border/80">
      <p className="font-sans text-secondary mb-1">Texto a Vocalizar:</p>
      <p className="italic font-sans max-h-20 overflow-y-auto">{adText || "El texto de tu anuncio aparecerá aquí..."}</p>
    </div>
  </div>
);

const PublishStep = ({ adName, setAdName, selectedGroup, setSelectedGroup, selectedVoice, adText, handleSubmitAd }) => (
  <div className="space-y-5">
    <div>
      <Label htmlFor="adName" className="text-secondary font-sans text-md mb-1.5 block">Nombre del Anuncio:</Label>
      <Input
        id="adName"
        placeholder="Ej: Consejo Bienestar Semanal"
        value={adName}
        onChange={(e) => setAdName(e.target.value)}
        useCleanStyle={true}
      />
    </div>
    <div>
      <Label htmlFor="adGroup" className="text-secondary font-sans text-md mb-1.5 block">Grupo de Publicación:</Label>
      <Select value={selectedGroup} onValueChange={setSelectedGroup} useCleanStyle={true}>
        <SelectTrigger useCleanStyle={true}>
          <SelectValue placeholder="Elige un grupo..." />
        </SelectTrigger>
        <SelectContent useCleanStyle={true}>
          {AD_GROUPS.map(group => (
            <SelectItem key={group} value={group} useCleanStyle={true}>{group}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="text-sm text-muted-foreground p-3.5 rounded-md bg-input/90 border border-border/80">
      <p><span className="font-sans text-secondary">Voz Seleccionada:</span> {AI_VOICES.find(v => v.id === selectedVoice)?.name}</p>
      <p className="font-sans text-secondary mt-1.5 mb-1">Texto a Publicar:</p>
      <p className="italic font-sans max-h-16 overflow-y-auto">{adText || "No hay texto para publicar..."}</p>
    </div>
    <Button onClick={handleSubmitAd} disabled={!adName.trim() || !adText.trim()} className="w-full clean-button-primary">
      <UploadCloud className="mr-2 h-4 w-4" /> Publicar Anuncio
    </Button>
  </div>
);

const StepperIndicator = ({ steps, currentStep }) => (
  <div className="mb-8 flex justify-center items-end space-x-2 sm:space-x-3">
    {steps.map((step, index) => (
      <React.Fragment key={step.id}>
        <motion.div
          className={`flex flex-col items-center transition-all duration-400 ${currentStep >= step.id ? 'text-primary' : 'text-muted-foreground/80'}`}
          animate={{ scale: currentStep === step.id ? 1.1 : 1, y: currentStep === step.id ? -4 : 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 18 }}
        >
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center border-2 transition-all duration-400
            ${currentStep >= step.id ? 'bg-primary/10 border-primary shadow-primary/15 shadow-md' : 'border-muted bg-input/80'}`}>
            {currentStep > step.id ? <Check size={22} className="text-green-500" /> : <step.icon size={22} />}
          </div>
          <p className={`text-xs mt-1.5 w-24 text-center font-medium font-sans ${currentStep === step.id ? 'text-accent font-semibold' : ''}`}>{step.cleanName}</p>
        </motion.div>
        {index < steps.length - 1 && (
          <div className={`flex-auto h-0.5 rounded-full transition-all duration-400 ease-in-out ${currentStep > step.id ? 'bg-gradient-to-r from-primary to-[#A2D9F7] shadow-sm' : 'bg-muted/70'}`} style={{ minWidth: '25px', transform: 'translateY(-16px)' }}></div>
        )}
      </React.Fragment>
    ))}
  </div>
);


const NewAdPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [adText, setAdText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(AI_VOICES[0].id);
  const [selectedGroup, setSelectedGroup] = useState(AD_GROUPS[0]);
  const [adName, setAdName] = useState('');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const adTextRef = useRef(null);

  const nextStep = useCallback(() => setCurrentStep(prev => Math.min(prev + 1, STEPS_CONFIG.length)), []);
  const prevStep = useCallback(() => setCurrentStep(prev => Math.max(prev - 1, 1)), []);

  const handleGenerateText = useCallback(() => {
    setIsGenerating(true);
    const generatedPrompt = `Crea un anuncio para ${PHARMACY_NAME} que transmita confianza y bienestar. Enfócate en el cuidado y el consejo experto más que en la venta directa de un producto. Menciona cómo el equipo de ${PHARMACY_NAME} está disponible para ayudar. Cierra con una frase como: "Pregunta a nuestro equipo, en ${PHARMACY_NAME}, sabemos cómo ayudarte" o similar, invitando a la consulta personalizada.`;
    const exampleAdText = `En ${PHARMACY_NAME}, tu bienestar es nuestra prioridad. Más que productos, te ofrecemos consejo y acompañamiento para cuidar de tu salud integral. ¿Tienes dudas sobre tu tratamiento o buscas una recomendación personalizada? Pregunta a nuestro equipo, en ${PHARMACY_NAME}, sabemos cómo ayudarte y estamos aquí para escucharte.`;

    setTimeout(() => {
      setAdText(exampleAdText);
      setIsGenerating(false);
      toast({
        title: "Borrador Inspirado Generado",
        description: (
          <div className="text-xs">
            <p className="font-medium">Texto para tu anuncio:</p>
            <p className="mt-1 italic">"{exampleAdText}"</p>
            <p className="mt-2 font-medium">Prompt utilizado (simulación):</p>
            <p className="mt-1 italic text-muted-foreground/80">"{generatedPrompt}"</p>
          </div>
        ),
        className: "clean-button-primary border-transparent text-primary-foreground",
        duration: 9000,
      });
    }, 1700);
  }, [toast]);

  const handlePlayPreview = useCallback(() => {
    if (!adText) {
      toast({ variant: "destructive", title: "Texto Vacío", description: "Por favor, primero escribe o genera el mensaje de tu anuncio." });
      return;
    }
    setIsPlayingPreview(true);
    toast({ title: "Escuchando Previsualización...", description: "Sintonizando la muestra de voz...", className: "clean-button-primary border-transparent text-primary-foreground" });
    setTimeout(() => {
      setIsPlayingPreview(false);
      toast({ title: "Previsualización Finalizada", description: "Has escuchado una muestra de tu anuncio." });
    }, 2200);
  }, [adText, toast]);

  const handleDictateText = useCallback(() => {
    setIsListening(true);
    toast({ title: "Escuchando Dictado...", description: "Habla ahora, tus palabras serán transcritas. (Simulación)", className: "clean-button-primary border-transparent text-primary-foreground" });
    setTimeout(() => {
      setAdText(prev => prev + (prev ? " " : "") + "Texto dictado por el usuario... (simulación).");
      setIsListening(false);
      adTextRef.current?.focus();
      toast({ title: "Dictado Transcrito", description: "Tus palabras han sido capturadas." });
    }, 2800);
  }, [toast]);

  const handleSubmitAd = useCallback(() => {
    if (!adName.trim() || !adText.trim()) {
      toast({ variant: "destructive", title: "Anuncio Incompleto", description: "El nombre y el texto son necesarios para publicar." });
      return;
    }
    toast({ title: "¡Anuncio Publicado!", description: `"${adName}" ahora está activo en el grupo "${selectedGroup}".`, className: "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-transparent clean-button" });
    setAdText('');
    setAdName('');
    setSelectedVoice(AI_VOICES[0].id);
    setSelectedGroup(AD_GROUPS[0]);
    setCurrentStep(1);
  }, [adName, adText, selectedGroup, toast]);

  const cleanStepName = STEPS_CONFIG.find(s => s.id === currentStep)?.cleanName || "Paso Desconocido";

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <CreativeStep 
                  adText={adText} 
                  setAdText={setAdText} 
                  isGenerating={isGenerating} 
                  handleGenerateText={handleGenerateText} 
                  isListening={isListening} 
                  handleDictateText={handleDictateText} 
                  adTextRef={adTextRef} 
                />;
      case 2:
        return <VoiceStep 
                  selectedVoice={selectedVoice} 
                  setSelectedVoice={setSelectedVoice} 
                  adText={adText} 
                  isPlayingPreview={isPlayingPreview} 
                  handlePlayPreview={handlePlayPreview} 
                />;
      case 3:
        return <PublishStep 
                  adName={adName} 
                  setAdName={setAdName} 
                  selectedGroup={selectedGroup} 
                  setSelectedGroup={setSelectedGroup} 
                  selectedVoice={selectedVoice} 
                  adText={adText} 
                  handleSubmitAd={handleSubmitAd} 
                />;
      default:
        return null;
    }
  };

  const isNextDisabled = 
    (currentStep === 1 && !adText.trim()) ||
    (currentStep === 2 && !selectedVoice) ||
    currentStep === STEPS_CONFIG.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 25, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: "circOut" }}
      className="p-4 sm:p-6 md:p-8"
    >
      <h1 className="text-4xl sm:text-5xl font-sans font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary/90 via-[#A2D9F7]/80 to-accent/90 mb-3 text-center animate-clean-float">
        Asistente de Creación de Anuncios
      </h1>
      <p className="text-muted-foreground mb-8 text-center font-sans text-sm sm:text-base">Diseña tus mensajes en tres sencillos pasos, ahora más personalizados para {PHARMACY_NAME}.</p>

      <StepperIndicator steps={STEPS_CONFIG} currentStep={currentStep} />

      <Card useCleanStyle={true} className="w-full max-w-xl mx-auto animate-clean-pulse" style={{ animationDuration: '6.5s' }}>
        <CardHeader className="text-center">
          <CardTitle useCleanStyle={true} className="text-2xl sm:text-3xl text-secondary font-sans">{cleanStepName}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: currentStep === 1 ? 0 : (currentStep > (STEPS_CONFIG.find(s => s.name === STEPS_CONFIG[currentStep - 2]?.name)?.id || 0) ? 40 : -40), scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: currentStep === STEPS_CONFIG.length ? 0 : (currentStep < (STEPS_CONFIG.find(s => s.name === STEPS_CONFIG[currentStep]?.name)?.id || Infinity) ? -40 : 40), scale: 0.95 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.25, 1] }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
        <CardFooter className="flex justify-between pt-6">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 1} className="clean-button-outline">
            <ChevronLeft className="mr-1.5 h-4 w-4" /> Anterior
          </Button>
          <Button variant="default" onClick={nextStep} disabled={isNextDisabled} className="clean-button-primary">
            Siguiente <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default NewAdPage;