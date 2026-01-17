'use client'

import { useState } from 'react'
import { FadeContent, AnimatedContent } from '@/lib/reactbits-custom'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { useModal } from '@/components/contexts/ModalContext'

interface PricingProps {
  lightMode?: boolean
  accentColor?: string
}

export default function Pricing({ lightMode = false, accentColor = '#A2D9F7' }: PricingProps) {
  const t = useTranslations('pricing')
  const [isAnnual, setIsAnnual] = useState(true)
  const { openModal } = useModal()

  const plans = ['basic', 'pro', 'business']

  // Colores según modo
  const bgColor = lightMode ? 'bg-white' : 'bg-[#1a1c20]'
  const textPrimary = lightMode ? 'text-gray-900' : 'text-white'
  const textSecondary = lightMode ? 'text-gray-600' : 'text-gray-400'
  const textMuted = lightMode ? 'text-gray-500' : 'text-gray-500'
  const cardBg = lightMode ? 'bg-gray-50' : 'bg-[#A2D9F7]/5'
  const cardBorder = lightMode ? 'border-gray-200' : 'border-[#A2D9F7]/10'
  const cardBorderHover = lightMode ? 'hover:border-gray-300' : 'hover:border-[#A2D9F7]/30'

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Ondeón - Música Legal sin SGAE",
            "description": "Servicio de música ambiental legal para negocios sin pagos a SGAE/AIE",
            "image": "https://www.ondeon.es/images/ondeon_logo.webp",
            "brand": {
              "@type": "Brand",
              "name": "Ondeón"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "reviewCount": "800",
              "bestRating": "5",
              "worstRating": "1"
            },
            "offers": [
              {
                "@type": "Offer",
                "name": t('plans.basic.name'),
                "price": t.raw('plans.basic.annualPrice'),
                "priceCurrency": "EUR",
                "priceValidUntil": "2026-12-31",
                "availability": "https://schema.org/InStock",
                "url": "https://www.ondeon.es/contratar-hilo-musical"
              },
              {
                "@type": "Offer",
                "name": t('plans.pro.name'),
                "price": t.raw('plans.pro.annualPrice'),
                "priceCurrency": "EUR",
                "priceValidUntil": "2026-12-31",
                "availability": "https://schema.org/InStock",
                "url": "https://www.ondeon.es/contratar-hilo-musical"
              }
            ]
          })
        }}
      />
      <section className={`relative ${bgColor} py-16 md:py-24`} id="pricing">
        {/* Background gradient effect */}
        {!lightMode && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-10 blur-3xl"
              style={{
                background: `radial-gradient(circle, rgba(162, 217, 247, 0.3) 0%, rgba(107, 184, 232, 0.2) 40%, transparent 70%)`
              }}
            />
          </div>
        )}

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <FadeContent>
            <div className="text-center mb-10 md:mb-12">
              <h2 className={`text-3xl md:text-4xl lg:text-5xl font-bold ${textPrimary} mb-3 tracking-tight`}>
                {t('title')}
              </h2>
              <p className={`text-lg md:text-xl ${textSecondary} font-medium`}>
                {t('subtitle')}
              </p>
            </div>
          </FadeContent>

          {/* Toggle */}
          <FadeContent delay={200}>
            <div className="flex items-center justify-center gap-3 mb-12">
              <span className={`text-base font-medium transition-colors ${!isAnnual ? textPrimary : textMuted}`}>
                {t('monthly')}
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className="relative w-14 h-8 rounded-full transition-all duration-300"
                style={{ backgroundColor: isAnnual ? accentColor : (lightMode ? '#d1d5db' : '#374151') }}
                aria-label="Toggle pricing period"
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 ${isAnnual ? 'left-7' : 'left-1'
                    }`}
                />
              </button>
              <span className={`text-base font-medium transition-colors ${isAnnual ? textPrimary : textMuted}`}>
                {t('annual')}
              </span>
              {isAnnual && (
                <span 
                  className="ml-2 px-2.5 py-1 text-xs font-semibold rounded-full border"
                  style={{ 
                    backgroundColor: `${accentColor}20`, 
                    color: lightMode ? accentColor : accentColor,
                    borderColor: `${accentColor}30`
                  }}
                >
                  Ahorra hasta 22%
                </span>
              )}
            </div>
          </FadeContent>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-5 lg:gap-6 pt-10">
            {plans.map((planId, index) => {
              const planData = t.raw(`plans.${planId}`)
              const isPopular = planData.popular
              const price = isAnnual ? planData.annualPrice : planData.monthlyPrice
              const features = Object.values(planData.features) as string[]
              const hasNote = planData.note

              return (
                <AnimatedContent key={planId} direction="vertical" distance={50} delay={index * 100 + 300}>
                  <div 
                    className={`relative h-full ${cardBg} border backdrop-blur-sm rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 ${
                      isPopular
                        ? 'shadow-2xl scale-105'
                        : `${cardBorder} ${cardBorderHover}`
                    }`}
                    style={isPopular ? { borderColor: accentColor, boxShadow: `0 25px 50px -12px ${accentColor}30` } : {}}
                  >
                    {/* Popular Badge */}
                    {isPopular && (
                      <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 z-10">
                        <div 
                          className="px-4 py-1.5 rounded-full text-xs font-bold shadow-lg"
                          style={{ backgroundColor: accentColor, color: lightMode ? 'white' : '#1a1c20' }}
                        >
                          {planData.savings}
                        </div>
                      </div>
                    )}

                    {/* Plan Name & Description */}
                    <div className={`text-xl font-bold ${textPrimary} mb-1.5`}>
                      {planData.name}
                    </div>
                    <p className={`${textSecondary} text-sm mb-5`}>
                      {planData.description}
                    </p>

                    {/* Price */}
                    <div className="mb-2">
                      {price !== null ? (
                        <>
                          <div className="flex items-baseline gap-1.5">
                            <span className={`text-4xl font-bold ${textPrimary}`}>
                              €{price}
                            </span>
                            <span className={`${textSecondary} text-base`}>
                              {planData.period}
                            </span>
                          </div>
                          {isAnnual && planData.billing && (
                            <p className={`text-xs ${textMuted} mt-1.5`}>
                              {planData.billing}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className={`text-2xl font-bold ${textPrimary}`}>
                          {planData.period}
                        </div>
                      )}
                    </div>

                    {/* VAT Included Badge */}
                    {price !== null && (
                      <div className="mb-5">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                          lightMode 
                            ? 'bg-green-100 text-green-700 border-green-200' 
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                        }`}>
                          {t('vatIncluded')}
                        </span>
                      </div>
                    )}

                    {/* Note for Pro plan */}
                    {hasNote && (
                      <p className={`text-xs ${textMuted} mb-5 italic`}>
                        * {hasNote}
                      </p>
                    )}

                    {/* Features */}
                    <ul className="space-y-3 mb-6">
                      {features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <div 
                            className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5"
                            style={{ backgroundColor: `${accentColor}20`, borderColor: `${accentColor}40` }}
                          >
                            <Check className="w-2.5 h-2.5" style={{ color: accentColor }} strokeWidth={3} />
                          </div>
                          <span className={`${lightMode ? 'text-gray-700' : 'text-gray-300'} text-sm leading-relaxed`}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <button
                      onClick={() => openModal(`pricing-${planId}`)}
                      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-105 active:scale-95 ${
                        isPopular
                          ? 'text-white shadow-lg'
                          : lightMode
                            ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200'
                            : planId === 'business'
                              ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                              : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                      }`}
                      style={isPopular ? { backgroundColor: accentColor } : {}}
                    >
                      {planData.cta}
                    </button>
                  </div>
                </AnimatedContent>
              )
            })}
          </div>

          {/* Additional Info */}
          <FadeContent delay={600}>
            <div className="text-center mt-10 md:mt-12">
              <p className={`${textSecondary} text-base`}>
                Todos los planes incluyen certificado libre de regalías y licencia comercial
              </p>
              <p className={`text-xs ${textMuted} mt-1.5`}>
                Cancela cuando quieras • Sin permanencia
              </p>
            </div>
          </FadeContent>
        </div>
      </section>
    </>
  )
}
