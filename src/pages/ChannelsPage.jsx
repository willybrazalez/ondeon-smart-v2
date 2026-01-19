import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Radio, Music, Loader2, Play, Volume2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

// ============================================================================
// ONDEON SMART v2 - CHANNELS PAGE
// ============================================================================
// Diseño tipo Spotify con tarjetas compactas y descripción
// MODO PRUEBA: Datos mock con 10 secciones x 10 canales
// ============================================================================

// ============================================================================
// DATOS DE PRUEBA - 10 SECCIONES x 10 CANALES = 100 CANALES
// ============================================================================
const MOCK_SECTIONS = [
  {
    title: "Para tu cafetería",
    channels: [
      { id: 'cafe-1', nombre: 'Coffee House', descripcion: 'Ambiente cálido y acogedor para cafeterías', imagen_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=500&fit=crop' },
      { id: 'cafe-2', nombre: 'Morning Brew', descripcion: 'Música suave para empezar el día', imagen_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=500&fit=crop' },
      { id: 'cafe-3', nombre: 'Café París', descripcion: 'Sonidos de cafés parisinos', imagen_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=500&fit=crop' },
      { id: 'cafe-4', nombre: 'Barista Beats', descripcion: 'Ritmos para baristas creativos', imagen_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=500&fit=crop' },
      { id: 'cafe-5', nombre: 'Espresso Soul', descripcion: 'Soul suave y aromático', imagen_url: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400&h=500&fit=crop' },
      { id: 'cafe-6', nombre: 'Latte Lounge', descripcion: 'Chill para tardes relajadas', imagen_url: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=400&h=500&fit=crop' },
      { id: 'cafe-7', nombre: 'Cappuccino Jazz', descripcion: 'Jazz suave y cremoso', imagen_url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400&h=500&fit=crop' },
      { id: 'cafe-8', nombre: 'Mocha Moments', descripcion: 'Momentos dulces y melódicos', imagen_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=500&fit=crop' },
      { id: 'cafe-9', nombre: 'Café Acoustic', descripcion: 'Acústico íntimo y cercano', imagen_url: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=400&h=500&fit=crop' },
      { id: 'cafe-10', nombre: 'Brew & Blues', descripcion: 'Blues para cafés con carácter', imagen_url: 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=400&h=500&fit=crop' },
    ]
  },
  {
    title: "Restaurantes elegantes",
    channels: [
      { id: 'rest-1', nombre: 'Fine Dining', descripcion: 'Música para cenas exclusivas', imagen_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=500&fit=crop' },
      { id: 'rest-2', nombre: 'Gourmet Vibes', descripcion: 'Ambiente sofisticado y refinado', imagen_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=500&fit=crop' },
      { id: 'rest-3', nombre: 'Candlelight', descripcion: 'Romántico y elegante', imagen_url: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=500&fit=crop' },
      { id: 'rest-4', nombre: 'Wine & Dine', descripcion: 'Perfecto para maridajes', imagen_url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=500&fit=crop' },
      { id: 'rest-5', nombre: 'Chef\'s Table', descripcion: 'Experiencia gastronómica única', imagen_url: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=400&h=500&fit=crop' },
      { id: 'rest-6', nombre: 'Bistro Chic', descripcion: 'Estilo bistró francés', imagen_url: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=400&h=500&fit=crop' },
      { id: 'rest-7', nombre: 'Tasting Menu', descripcion: 'Para menús degustación', imagen_url: 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=400&h=500&fit=crop' },
      { id: 'rest-8', nombre: 'Sommelier\'s Pick', descripcion: 'Selección del sommelier', imagen_url: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400&h=500&fit=crop' },
      { id: 'rest-9', nombre: 'Haute Cuisine', descripcion: 'Alta cocina, alta música', imagen_url: 'https://images.unsplash.com/photo-1428515613728-6b4607e44363?w=400&h=500&fit=crop' },
      { id: 'rest-10', nombre: 'Michelin Stars', descripcion: 'Nivel estrella Michelin', imagen_url: 'https://images.unsplash.com/photo-1515669097368-22e68427d265?w=400&h=500&fit=crop' },
    ]
  },
  {
    title: "Bares y pubs",
    channels: [
      { id: 'bar-1', nombre: 'Craft Beer', descripcion: 'Para cervecerías artesanales', imagen_url: 'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=400&h=500&fit=crop' },
      { id: 'bar-2', nombre: 'Pub Rock', descripcion: 'Rock clásico de pub británico', imagen_url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=500&fit=crop' },
      { id: 'bar-3', nombre: 'Cocktail Hour', descripcion: 'Hora del cóctel sofisticado', imagen_url: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400&h=500&fit=crop' },
      { id: 'bar-4', nombre: 'Sports Bar', descripcion: 'Energía para ver deportes', imagen_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=500&fit=crop' },
      { id: 'bar-5', nombre: 'Whiskey Lounge', descripcion: 'Ambiente de whiskey bar', imagen_url: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=400&h=500&fit=crop' },
      { id: 'bar-6', nombre: 'Irish Pub', descripcion: 'Sonidos de pub irlandés', imagen_url: 'https://images.unsplash.com/photo-1555658636-6e4a36218be7?w=400&h=500&fit=crop' },
      { id: 'bar-7', nombre: 'Speakeasy', descripcion: 'Estilo años 20 clandestino', imagen_url: 'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=400&h=500&fit=crop' },
      { id: 'bar-8', nombre: 'Rooftop Bar', descripcion: 'Terraza con vistas', imagen_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=400&h=500&fit=crop' },
      { id: 'bar-9', nombre: 'Tiki Bar', descripcion: 'Vibes tropicales y exóticas', imagen_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=500&fit=crop' },
      { id: 'bar-10', nombre: 'Wine Bar', descripcion: 'Ambiente de vinoteca', imagen_url: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400&h=500&fit=crop' },
    ]
  },
  {
    title: "Tiendas y retail",
    channels: [
      { id: 'shop-1', nombre: 'Fashion Store', descripcion: 'Para tiendas de moda', imagen_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=500&fit=crop' },
      { id: 'shop-2', nombre: 'Boutique Chic', descripcion: 'Boutiques exclusivas', imagen_url: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=400&h=500&fit=crop' },
      { id: 'shop-3', nombre: 'Shopping Mall', descripcion: 'Centros comerciales', imagen_url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=500&fit=crop' },
      { id: 'shop-4', nombre: 'Luxury Retail', descripcion: 'Tiendas de lujo', imagen_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=500&fit=crop' },
      { id: 'shop-5', nombre: 'Home & Deco', descripcion: 'Decoración y hogar', imagen_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=500&fit=crop' },
      { id: 'shop-6', nombre: 'Tech Store', descripcion: 'Tiendas de tecnología', imagen_url: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=500&fit=crop' },
      { id: 'shop-7', nombre: 'Bookstore', descripcion: 'Librerías acogedoras', imagen_url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=400&h=500&fit=crop' },
      { id: 'shop-8', nombre: 'Beauty Shop', descripcion: 'Tiendas de belleza', imagen_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=500&fit=crop' },
      { id: 'shop-9', nombre: 'Artisan Market', descripcion: 'Mercados artesanales', imagen_url: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400&h=500&fit=crop' },
      { id: 'shop-10', nombre: 'Concept Store', descripcion: 'Tiendas conceptuales', imagen_url: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&h=500&fit=crop' },
    ]
  },
  {
    title: "Spa y bienestar",
    channels: [
      { id: 'spa-1', nombre: 'Zen Garden', descripcion: 'Jardín zen relajante', imagen_url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=500&fit=crop' },
      { id: 'spa-2', nombre: 'Deep Relax', descripcion: 'Relajación profunda', imagen_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&h=500&fit=crop' },
      { id: 'spa-3', nombre: 'Meditation', descripcion: 'Para meditación guiada', imagen_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=500&fit=crop' },
      { id: 'spa-4', nombre: 'Massage Room', descripcion: 'Salas de masajes', imagen_url: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=500&fit=crop' },
      { id: 'spa-5', nombre: 'Yoga Flow', descripcion: 'Sesiones de yoga', imagen_url: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=500&fit=crop' },
      { id: 'spa-6', nombre: 'Thermal Baths', descripcion: 'Baños termales', imagen_url: 'https://images.unsplash.com/photo-1583416750470-965b2707b355?w=400&h=500&fit=crop' },
      { id: 'spa-7', nombre: 'Aromatherapy', descripcion: 'Aromaterapia sensorial', imagen_url: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=400&h=500&fit=crop' },
      { id: 'spa-8', nombre: 'Wellness Center', descripcion: 'Centros de bienestar', imagen_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=500&fit=crop' },
      { id: 'spa-9', nombre: 'Sauna Chill', descripcion: 'Zona de saunas', imagen_url: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=400&h=500&fit=crop' },
      { id: 'spa-10', nombre: 'Float Tank', descripcion: 'Tanques de flotación', imagen_url: 'https://images.unsplash.com/photo-1559599238-308793637427?w=400&h=500&fit=crop' },
    ]
  },
  {
    title: "Gimnasios y fitness",
    channels: [
      { id: 'gym-1', nombre: 'Power Workout', descripcion: 'Entrenos de alta intensidad', imagen_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=500&fit=crop' },
      { id: 'gym-2', nombre: 'Cardio Rush', descripcion: 'Cardio explosivo', imagen_url: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=500&fit=crop' },
      { id: 'gym-3', nombre: 'Spin Class', descripcion: 'Clases de spinning', imagen_url: 'https://images.unsplash.com/photo-1534787238916-9ba6764efd4f?w=400&h=500&fit=crop' },
      { id: 'gym-4', nombre: 'CrossFit', descripcion: 'Música para CrossFit', imagen_url: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=400&h=500&fit=crop' },
      { id: 'gym-5', nombre: 'Running Mix', descripcion: 'Para correr y trotar', imagen_url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400&h=500&fit=crop' },
      { id: 'gym-6', nombre: 'Pump It Up', descripcion: 'Pesas y musculación', imagen_url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=500&fit=crop' },
      { id: 'gym-7', nombre: 'HIIT Beats', descripcion: 'Intervalos de alta intensidad', imagen_url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=500&fit=crop' },
      { id: 'gym-8', nombre: 'Boxing Ring', descripcion: 'Entreno de boxeo', imagen_url: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&h=500&fit=crop' },
      { id: 'gym-9', nombre: 'Cool Down', descripcion: 'Enfriamiento y stretching', imagen_url: 'https://images.unsplash.com/photo-1518459031867-a89b944bffe4?w=400&h=500&fit=crop' },
      { id: 'gym-10', nombre: 'Pilates Studio', descripcion: 'Clases de pilates', imagen_url: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&h=500&fit=crop' },
    ]
  },
  {
    title: "Hoteles y lobbies",
    channels: [
      { id: 'hotel-1', nombre: 'Grand Lobby', descripcion: 'Lobbies de grandes hoteles', imagen_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=500&fit=crop' },
      { id: 'hotel-2', nombre: 'Boutique Hotel', descripcion: 'Hoteles boutique', imagen_url: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=500&fit=crop' },
      { id: 'hotel-3', nombre: 'Resort Paradise', descripcion: 'Resorts paradisíacos', imagen_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400&h=500&fit=crop' },
      { id: 'hotel-4', nombre: 'Business Class', descripcion: 'Hoteles de negocios', imagen_url: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400&h=500&fit=crop' },
      { id: 'hotel-5', nombre: 'Suite Dreams', descripcion: 'Suites de lujo', imagen_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&h=500&fit=crop' },
      { id: 'hotel-6', nombre: 'Pool Lounge', descripcion: 'Zona de piscina', imagen_url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&h=500&fit=crop' },
      { id: 'hotel-7', nombre: 'Beach Resort', descripcion: 'Resorts de playa', imagen_url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=400&h=500&fit=crop' },
      { id: 'hotel-8', nombre: 'Mountain Lodge', descripcion: 'Lodges de montaña', imagen_url: 'https://images.unsplash.com/photo-1518732714860-b62714ce0c59?w=400&h=500&fit=crop' },
      { id: 'hotel-9', nombre: 'City Hotel', descripcion: 'Hoteles urbanos', imagen_url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=500&fit=crop' },
      { id: 'hotel-10', nombre: 'Wellness Resort', descripcion: 'Resorts de wellness', imagen_url: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=400&h=500&fit=crop' },
    ]
  },
  {
    title: "Oficinas y coworking",
    channels: [
      { id: 'office-1', nombre: 'Focus Mode', descripcion: 'Concentración máxima', imagen_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=500&fit=crop' },
      { id: 'office-2', nombre: 'Startup Vibes', descripcion: 'Energía de startup', imagen_url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=500&fit=crop' },
      { id: 'office-3', nombre: 'Creative Hub', descripcion: 'Espacios creativos', imagen_url: 'https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=400&h=500&fit=crop' },
      { id: 'office-4', nombre: 'Meeting Room', descripcion: 'Salas de reuniones', imagen_url: 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=400&h=500&fit=crop' },
      { id: 'office-5', nombre: 'Break Time', descripcion: 'Zonas de descanso', imagen_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=400&h=500&fit=crop' },
      { id: 'office-6', nombre: 'Coworking Space', descripcion: 'Espacios coworking', imagen_url: 'https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?w=400&h=500&fit=crop' },
      { id: 'office-7', nombre: 'Deep Work', descripcion: 'Trabajo profundo', imagen_url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=500&fit=crop' },
      { id: 'office-8', nombre: 'Tech Office', descripcion: 'Oficinas tech', imagen_url: 'https://images.unsplash.com/photo-1504384764586-bb4cdc1707b0?w=400&h=500&fit=crop' },
      { id: 'office-9', nombre: 'Brainstorm', descripcion: 'Sesiones creativas', imagen_url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=500&fit=crop' },
      { id: 'office-10', nombre: 'Executive Suite', descripcion: 'Despachos ejecutivos', imagen_url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=500&fit=crop' },
    ]
  },
  {
    title: "Clínicas y consultas",
    channels: [
      { id: 'clinic-1', nombre: 'Waiting Room', descripcion: 'Salas de espera', imagen_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=500&fit=crop' },
      { id: 'clinic-2', nombre: 'Dental Care', descripcion: 'Clínicas dentales', imagen_url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=500&fit=crop' },
      { id: 'clinic-3', nombre: 'Medical Center', descripcion: 'Centros médicos', imagen_url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400&h=500&fit=crop' },
      { id: 'clinic-4', nombre: 'Physiotherapy', descripcion: 'Fisioterapia', imagen_url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=500&fit=crop' },
      { id: 'clinic-5', nombre: 'Therapy Room', descripcion: 'Salas de terapia', imagen_url: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=400&h=500&fit=crop' },
      { id: 'clinic-6', nombre: 'Recovery', descripcion: 'Zonas de recuperación', imagen_url: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&h=500&fit=crop' },
      { id: 'clinic-7', nombre: 'Pediatrics', descripcion: 'Consultas pediátricas', imagen_url: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&h=500&fit=crop' },
      { id: 'clinic-8', nombre: 'Ophthalmology', descripcion: 'Clínicas oftalmológicas', imagen_url: 'https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?w=400&h=500&fit=crop' },
      { id: 'clinic-9', nombre: 'Dermatology', descripcion: 'Consultas dermatología', imagen_url: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=400&h=500&fit=crop' },
      { id: 'clinic-10', nombre: 'Veterinary', descripcion: 'Clínicas veterinarias', imagen_url: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400&h=500&fit=crop' },
    ]
  },
  {
    title: "Eventos y celebraciones",
    channels: [
      { id: 'event-1', nombre: 'Wedding Day', descripcion: 'Bodas y ceremonias', imagen_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=500&fit=crop' },
      { id: 'event-2', nombre: 'Birthday Party', descripcion: 'Fiestas de cumpleaños', imagen_url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=500&fit=crop' },
      { id: 'event-3', nombre: 'Corporate Event', descripcion: 'Eventos corporativos', imagen_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=500&fit=crop' },
      { id: 'event-4', nombre: 'Cocktail Party', descripcion: 'Cócteles y recepciones', imagen_url: 'https://images.unsplash.com/photo-1496843916299-590492c751f4?w=400&h=500&fit=crop' },
      { id: 'event-5', nombre: 'Gala Night', descripcion: 'Galas y eventos de gala', imagen_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=500&fit=crop' },
      { id: 'event-6', nombre: 'Garden Party', descripcion: 'Fiestas en jardín', imagen_url: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400&h=500&fit=crop' },
      { id: 'event-7', nombre: 'Holiday Season', descripcion: 'Temporada festiva', imagen_url: 'https://images.unsplash.com/photo-1482517967863-00e15c9b44be?w=400&h=500&fit=crop' },
      { id: 'event-8', nombre: 'New Year\'s Eve', descripcion: 'Nochevieja y año nuevo', imagen_url: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=400&h=500&fit=crop' },
      { id: 'event-9', nombre: 'Summer Festival', descripcion: 'Festivales de verano', imagen_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=500&fit=crop' },
      { id: 'event-10', nombre: 'Anniversary', descripcion: 'Aniversarios especiales', imagen_url: 'https://images.unsplash.com/photo-1529543544277-c31d012be72a?w=400&h=500&fit=crop' },
    ]
  },
];

const channelGradients = {
  pop: 'from-pink-500 to-purple-600',
  rock: 'from-red-600 to-gray-800',
  ambient: 'from-emerald-400 to-teal-600',
  soul: 'from-amber-500 to-orange-600',
  hits: 'from-yellow-400 to-pink-500',
  acoustic: 'from-green-500 to-emerald-600',
  jazz: 'from-indigo-500 to-purple-700',
  classical: 'from-blue-400 to-indigo-600',
  electronic: 'from-cyan-400 to-blue-600',
  default: 'from-slate-500 to-slate-700',
};

// Componente de fila horizontal con scroll - Estilo Spotify
const ChannelRow = ({ title, channels, selectedChannel, onChannelSelect, isManualPlaybackActive, showViewAll = false }) => {
  const scrollRef = useRef(null);

  if (!channels || channels.length === 0) return null;

  return (
    <div className="mb-8">
      {/* Header de la sección */}
      <div className="flex items-center justify-between mb-4 px-4 md:px-6">
        <h2 className="text-base md:text-lg font-semibold text-white/80">{title}</h2>
        {showViewAll && (
          <span className="text-xs text-[#A2D9F7]/70 font-medium cursor-pointer hover:text-[#A2D9F7]">Ver todo</span>
        )}
      </div>

      {/* Contenedor con scroll horizontal */}
      <div 
        ref={scrollRef}
        className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-4 md:px-6 pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {channels.map((channel, index) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            index={index}
            isSelected={selectedChannel === channel.id}
            onSelect={onChannelSelect}
            isManualPlaybackActive={isManualPlaybackActive}
          />
        ))}
      </div>
    </div>
  );
};

// Componente de tarjeta de canal - Estilo vertical alargado
const ChannelCard = ({ channel, index, isSelected, onSelect, isManualPlaybackActive }) => {
  const [isChanging, setIsChanging] = useState(false);

  const getChannelType = (name) => {
    const n = name?.toLowerCase() || '';
    if (n.includes('pop')) return 'pop';
    if (n.includes('rock') || n.includes('legend')) return 'rock';
    if (n.includes('ambient') || n.includes('chill') || n.includes('acoustic') || n.includes('easy')) return 'ambient';
    if (n.includes('soul') || n.includes('funk') || n.includes('r&b')) return 'soul';
    if (n.includes('70') || n.includes('80') || n.includes('hit') || n.includes('disco')) return 'hits';
    if (n.includes('jazz') || n.includes('blues')) return 'jazz';
    if (n.includes('classical') || n.includes('piano')) return 'classical';
    if (n.includes('electro') || n.includes('house') || n.includes('dance')) return 'electronic';
    return 'default';
  };

  const getChannelDescription = (name, desc) => {
    if (desc) return desc;
    const n = name?.toLowerCase() || '';
    if (n.includes('pop')) return 'Los mejores éxitos del pop de todos los tiempos';
    if (n.includes('rock')) return 'Rock clásico y leyendas del género';
    if (n.includes('chill') || n.includes('ambient')) return 'Música relajante de ambiente';
    if (n.includes('acoustic')) return 'Música acústica y relajante';
    if (n.includes('jazz')) return 'Jazz suave y elegante';
    if (n.includes('soul') || n.includes('funk')) return 'Soul, funk y R&B clásico';
    if (n.includes('80')) return 'La música que definió una década';
    if (n.includes('70')) return 'Los grandes éxitos de los años 70';
    if (n.includes('classical')) return 'Música clásica atemporal';
    return 'Selección musical curada';
  };

  const channelType = getChannelType(channel.nombre);
  const gradient = channelGradients[channelType];

  const handleClick = async () => {
    if (isManualPlaybackActive || isChanging) return;
    setIsChanging(true);
    await onSelect(channel);
    setIsChanging(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className={`flex-shrink-0 w-[150px] md:w-[190px] lg:w-[210px] ${isManualPlaybackActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'}`}
      onClick={handleClick}
    >
      {/* Imagen - Proporción 4:5 con bordes rectos */}
      <div 
        className="relative aspect-[4/5] rounded-sm overflow-hidden mb-2 transition-all duration-200 group-hover:scale-[1.02] active:scale-[0.98]"
      >
        {channel.imagen_url ? (
          <img 
            src={channel.imagen_url} 
            alt={channel.nombre}
            className="w-full h-full object-cover border-0"
            style={{ border: 'none', outline: 'none' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.classList.add('bg-gradient-to-br', ...gradient.split(' '));
            }}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <Music size={48} className="text-white/60 md:w-16 md:h-16" />
          </div>
        )}

        {/* Overlay hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />

        {/* Indicador de reproducción */}
        {isSelected && !isManualPlaybackActive && (
          <div className="absolute bottom-2 right-2 bg-[#A2D9F7] rounded-full p-1.5 shadow-lg">
            {isChanging ? (
              <Loader2 size={14} className="text-gray-900 animate-spin" />
            ) : (
              <Volume2 size={14} className="text-gray-900" />
            )}
          </div>
        )}

        {/* Overlay de carga */}
        {isChanging && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 size={28} className="text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Título - Intensidad reducida */}
      <h3 className="text-[13px] md:text-sm font-medium text-white/80 leading-tight">
        {channel.nombre}
      </h3>
      
      {/* Descripción - Intensidad reducida */}
      <p className="text-[11px] md:text-xs text-white/40 line-clamp-2 leading-snug mt-0.5">
        {getChannelDescription(channel.nombre, channel.descripcion)}
      </p>
    </motion.div>
  );
};

const ChannelsPage = ({ setCurrentChannel, currentChannel, isPlaying, togglePlayPause }) => {
  const [selectedVisualChannel, setSelectedVisualChannel] = useState(null);
  const { toast } = useToast();
  
  const { 
    user,
    userData,
    isManualPlaybackActive, 
    manualPlaybackInfo 
  } = useAuth();

  // =========================================================================
  // MODO PRUEBA: Usar datos mock en lugar de datos reales
  // Para volver a producción, descomentar el código original abajo
  // =========================================================================
  const USE_MOCK_DATA = true; // Cambiar a false para usar datos reales

  useEffect(() => {
    if (USE_MOCK_DATA && !selectedVisualChannel) {
      setSelectedVisualChannel(MOCK_SECTIONS[0].channels[0].id);
    }
  }, []);

  useEffect(() => {
    if (currentChannel?.id) {
      setSelectedVisualChannel(currentChannel.id);
    }
  }, [currentChannel]);

  const handleChannelChange = async (channel) => {
    if (isManualPlaybackActive) {
      toast({
        title: "Reproducción en curso",
        description: `Espera a que termine ${manualPlaybackInfo?.contentName || 'el contenido actual'}`,
        variant: "destructive",
      });
      return;
    }

    try {
      setSelectedVisualChannel(channel.id);
      
      const channelFormatted = {
        id: channel.id,
        name: channel.nombre,
        description: channel.descripcion,
        songTitle: channel.nombre,
        artist: "Radio Online",
        imagen_url: channel.imagen_url
      };
      
      setCurrentChannel(channelFormatted);
    
      toast({
        title: `Sintonizando ${channel.nombre}`,
        className: "bg-[#0d1117] text-white border border-[#A2D9F7]/30",
      });

      if (!isPlaying) {
        const handleReady = () => {
          try { togglePlayPause(); } catch (e) {}
          window.removeEventListener('audio-ready', handleReady);
        };
        window.addEventListener('audio-ready', handleReady, { once: true });
      }

    } catch (error) {
      logger.error('Error cambiando canal:', error);
      toast({
        title: "Error",
        description: `Error al cambiar a ${channel.nombre}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full pb-8">
      {/* Header principal - Solo visible en desktop */}
      <div className="hidden md:block px-6 mb-10 pt-6">
        <motion.h1 
          className="text-2xl lg:text-3xl font-bold text-white/90 mb-1"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Canales de música
        </motion.h1>
        <motion.p 
          className="text-sm text-white/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {userData?.establecimiento 
            ? `Para ${userData.establecimiento}`
            : 'Selecciona tu ambiente musical'
          }
        </motion.p>
      </div>
      
      {/* Espaciado en mobile */}
      <div className="md:hidden h-6" />

      {/* MODO PRUEBA: 10 secciones x 10 canales con imágenes de Unsplash */}
      {MOCK_SECTIONS.map((section, idx) => (
        <ChannelRow
          key={section.title}
          title={section.title}
          channels={section.channels}
          selectedChannel={selectedVisualChannel}
          onChannelSelect={handleChannelChange}
          isManualPlaybackActive={isManualPlaybackActive}
          showViewAll
        />
      ))}
    </div>
  );
};

export default ChannelsPage;
