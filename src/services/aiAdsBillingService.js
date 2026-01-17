/**
 * aiAdsBillingService.js
 * Servicio para tracking y facturación de anuncios con IA
 */

import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';

class AIAdsBillingService {
  
  /**
   * Registrar generación de texto
   * @param {Object} params - Parámetros del tracking
   */
  async trackTextGeneration({ empresaId, aiAdId, adminId, tokensUsed, modelUsed }) {
    try {
      // Costo estimado: $0.03 por 1K tokens = 0.03 EUR / 1000 tokens
      const estimatedCostCents = (tokensUsed / 1000) * 3.0; // 3 céntimos por 1K tokens
      
      const { error } = await supabase
        .from('ai_ads_usage_tracking')
        .insert({
          empresa_id: empresaId,
          ai_ad_id: aiAdId,
          admin_id: adminId,
          action_type: 'text_generated',
          tokens_used: tokensUsed,
          model_used: modelUsed || 'gpt-4',
          estimated_cost_cents: estimatedCostCents
        });
      
      if (error) {
        logger.warn('⚠️ Error tracking text generation:', error);
      } else {
        logger.dev(`✅ Text generation tracked: ${tokensUsed} tokens, ${estimatedCostCents.toFixed(2)}¢`);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to track text generation:', error);
      // No interrumpir el flujo principal
    }
  }

  /**
   * Registrar regeneración de texto
   */
  async trackTextRegeneration({ empresaId, aiAdId, adminId, tokensUsed, modelUsed }) {
    try {
      const estimatedCostCents = (tokensUsed / 1000) * 3.0;
      
      const { error } = await supabase
        .from('ai_ads_usage_tracking')
        .insert({
          empresa_id: empresaId,
          ai_ad_id: aiAdId,
          admin_id: adminId,
          action_type: 'text_regenerated',
          tokens_used: tokensUsed,
          model_used: modelUsed || 'gpt-4',
          estimated_cost_cents: estimatedCostCents
        });
      
      if (error) {
        logger.warn('⚠️ Error tracking text regeneration:', error);
      } else {
        logger.dev(`✅ Text regeneration tracked: ${tokensUsed} tokens`);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to track text regeneration:', error);
    }
  }

  /**
   * Registrar generación de audio
   */
  async trackAudioGeneration({ empresaId, aiAdId, adminId, charactersUsed, durationSeconds, voiceId }) {
    try {
      // Costo estimado: $0.15 por 1K caracteres = 0.15 EUR / 1000 chars
      const estimatedCostCents = (charactersUsed / 1000) * 15.0; // 15 céntimos por 1K chars
      
      const { error } = await supabase
        .from('ai_ads_usage_tracking')
        .insert({
          empresa_id: empresaId,
          ai_ad_id: aiAdId,
          admin_id: adminId,
          action_type: 'audio_generated',
          characters_used: charactersUsed,
          duration_seconds: durationSeconds,
          voice_id: voiceId,
          estimated_cost_cents: estimatedCostCents
        });
      
      if (error) {
        logger.warn('⚠️ Error tracking audio generation:', error);
      } else {
        logger.dev(`✅ Audio generation tracked: ${charactersUsed} chars, ${durationSeconds}s, ${estimatedCostCents.toFixed(2)}¢`);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to track audio generation:', error);
    }
  }

  /**
   * Registrar regeneración de audio (cambio de voz)
   */
  async trackAudioRegeneration({ empresaId, aiAdId, adminId, charactersUsed, durationSeconds, voiceId }) {
    try {
      const estimatedCostCents = (charactersUsed / 1000) * 15.0;
      
      const { error } = await supabase
        .from('ai_ads_usage_tracking')
        .insert({
          empresa_id: empresaId,
          ai_ad_id: aiAdId,
          admin_id: adminId,
          action_type: 'audio_regenerated',
          characters_used: charactersUsed,
          duration_seconds: durationSeconds,
          voice_id: voiceId,
          estimated_cost_cents: estimatedCostCents
        });
      
      if (error) {
        logger.warn('⚠️ Error tracking audio regeneration:', error);
      } else {
        logger.dev(`✅ Audio regeneration tracked: ${charactersUsed} chars`);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to track audio regeneration:', error);
    }
  }

  /**
   * Registrar anuncio guardado
   */
  async trackAdSaved({ empresaId, aiAdId, adminId }) {
    try {
      const { error } = await supabase
        .from('ai_ads_usage_tracking')
        .insert({
          empresa_id: empresaId,
          ai_ad_id: aiAdId,
          admin_id: adminId,
          action_type: 'ad_saved',
          estimated_cost_cents: 0 // Sin costo adicional
        });
      
      if (error) {
        logger.warn('⚠️ Error tracking ad saved:', error);
      } else {
        logger.dev('✅ Ad saved tracked');
      }
    } catch (error) {
      logger.warn('⚠️ Failed to track ad saved:', error);
    }
  }

  /**
   * Registrar anuncio programado
   */
  async trackAdScheduled({ empresaId, aiAdId, adminId, usersCount }) {
    try {
      const { error } = await supabase
        .from('ai_ads_usage_tracking')
        .insert({
          empresa_id: empresaId,
          ai_ad_id: aiAdId,
          admin_id: adminId,
          action_type: 'ad_scheduled',
          estimated_cost_cents: 0, // Sin costo adicional
          metadata: { users_count: usersCount }
        });
      
      if (error) {
        logger.warn('⚠️ Error tracking ad scheduled:', error);
      } else {
        logger.dev(`✅ Ad scheduled tracked: ${usersCount} users`);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to track ad scheduled:', error);
    }
  }

  /**
   * Obtener reporte mensual
   */
  async getMonthlyReport(year, month) {
    try {
      const { data, error } = await supabase
        .rpc('get_monthly_billing_report', {
          p_year: year,
          p_month: month
        });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('❌ Error obteniendo reporte mensual:', error);
      throw error;
    }
  }

  /**
   * Obtener resumen por empresa
   */
  async getCompanySummary(empresaId) {
    try {
      const { data, error } = await supabase
        .from('ai_ads_usage_summary_by_company')
        .select('*')
        .eq('empresa_id', empresaId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('❌ Error obteniendo resumen de empresa:', error);
      throw error;
    }
  }

  /**
   * Obtener uso mensual de una empresa
   */
  async getCompanyMonthlyUsage(empresaId, limit = 12) {
    try {
      const { data, error } = await supabase
        .from('ai_ads_monthly_usage')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('❌ Error obteniendo uso mensual:', error);
      throw error;
    }
  }

  /**
   * Obtener resumen general
   */
  async getBillingSummary() {
    try {
      const { data, error } = await supabase
        .rpc('get_billing_summary');
      
      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      logger.error('❌ Error obteniendo resumen general:', error);
      throw error;
    }
  }

  /**
   * Exportar reporte a CSV
   */
  exportToCSV(data, filename) {
    if (!data || data.length === 0) {
      logger.warn('⚠️ No hay datos para exportar');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escapar valores con comas o comillas
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'reporte_facturacion.csv';
    link.click();
    window.URL.revokeObjectURL(url);
    
    logger.dev(`✅ Reporte exportado: ${filename}`);
  }
}

export default new AIAdsBillingService();










