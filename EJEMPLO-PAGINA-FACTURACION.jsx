/**
 * EJEMPLO: Página de Facturación de Anuncios IA
 * 
 * Esta página es un EJEMPLO de cómo podrías implementar un dashboard
 * de facturación en tu frontend-desktop-admin (proyecto separado).
 * 
 * NO es necesario implementarla inmediatamente, el sistema funciona
 * perfectamente con queries SQL directamente en Supabase.
 * 
 * Funcionalidades:
 * - Ver resumen mensual de todas las empresas
 * - Filtrar por mes/año
 * - Exportar a CSV
 * - Ver estadísticas en tiempo real
 * - Gráficas de evolución
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Download, Calendar, TrendingUp, 
  DollarSign, FileText, Users, RefreshCw
} from 'lucide-react';

const FacturacionIAPage = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [reportData, setReportData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Cargar reporte mensual
  const loadMonthlyReport = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_monthly_billing_report', {
          p_year: selectedYear,
          p_month: selectedMonth
        });
      
      if (error) throw error;
      setReportData(data || []);
      
      // Calcular totales
      const totals = (data || []).reduce((acc, row) => ({
        totalEmpresas: acc.totalEmpresas + 1,
        totalAnuncios: acc.totalAnuncios + parseInt(row.anuncios_creados || 0),
        totalEuros: acc.totalEuros + parseFloat(row.costo_total_euros || 0)
      }), { totalEmpresas: 0, totalAnuncios: 0, totalEuros: 0 });
      
      setSummaryData(totals);
    } catch (error) {
      console.error('Error:', error);
      alert('Error cargando reporte: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlyReport();
  }, [selectedYear, selectedMonth]);

  // Exportar a CSV
  const exportToCSV = () => {
    const headers = [
      'Razón Social', 'CIF', 'Anuncios Creados', 
      'Textos Generados', 'Textos Regenerados',
      'Audios Generados', 'Audios Regenerados',
      'Anuncios Guardados', 'Anuncios Programados', 
      'Costo Total (EUR)'
    ];
    
    const csvContent = [
      headers.join(','),
      ...reportData.map(row => [
        `"${row.razon_social}"`,
        row.cif || '',
        row.anuncios_creados,
        row.textos_generados,
        row.textos_regenerados,
        row.audios_generados,
        row.audios_regenerados,
        row.anuncios_guardados,
        row.anuncios_programados,
        row.costo_total_euros
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturacion_ia_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Filtrar por término de búsqueda
  const filteredData = reportData.filter(row => 
    row.razon_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.cif?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Facturación Anuncios IA
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Reporte de uso de servicios de IA (OpenAI + ElevenLabs)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadMonthlyReport}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              onClick={exportToCSV}
              disabled={reportData.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Selector de Mes/Año y Búsqueda */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-700">Periodo:</span>
          </div>
          
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {meses.map((mes, idx) => (
              <option key={idx} value={idx + 1}>{mes}</option>
            ))}
          </select>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {[2024, 2025, 2026, 2027].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Buscar empresa por nombre o CIF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Cards de Resumen */}
        {summaryData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium uppercase tracking-wide">
                    Empresas Activas
                  </p>
                  <p className="text-4xl font-bold text-blue-900 mt-2">
                    {summaryData.totalEmpresas}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    con anuncios generados
                  </p>
                </div>
                <Users className="w-12 h-12 text-blue-400 opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium uppercase tracking-wide">
                    Total Anuncios
                  </p>
                  <p className="text-4xl font-bold text-green-900 mt-2">
                    {summaryData.totalAnuncios}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    creados este mes
                  </p>
                </div>
                <FileText className="w-12 h-12 text-green-400 opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium uppercase tracking-wide">
                    Ingresos del Mes
                  </p>
                  <p className="text-4xl font-bold text-purple-900 mt-2">
                    {summaryData.totalEuros.toFixed(2)} €
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    costo servicios IA
                  </p>
                </div>
                <DollarSign className="w-12 h-12 text-purple-400 opacity-80" />
              </div>
            </div>
          </div>
        )}

        {/* Tabla de Datos */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Empresa
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    CIF
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Anuncios
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Textos
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Audios
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Guardados
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Programados
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Costo (EUR)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-12 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-gray-600">Cargando datos...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                      {searchTerm ? 
                        `No se encontraron empresas que coincidan con "${searchTerm}"` :
                        'No hay datos para este periodo'
                      }
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <tr key={row.empresa_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{row.razon_social}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {row.cif || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {row.anuncios_creados}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {row.textos_generados}
                        {row.textos_regenerados > 0 && (
                          <span className="text-xs text-orange-600 ml-1">
                            (+{row.textos_regenerados})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {row.audios_generados}
                        {row.audios_regenerados > 0 && (
                          <span className="text-xs text-orange-600 ml-1">
                            (+{row.audios_regenerados})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {row.anuncios_guardados}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {row.anuncios_programados}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-green-600">
                          {parseFloat(row.costo_total_euros || 0).toFixed(2)} €
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredData.length > 0 && (
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">
                      {filteredData.reduce((sum, row) => sum + parseInt(row.anuncios_creados || 0), 0)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">
                      {filteredData.reduce((sum, row) => sum + parseInt(row.textos_generados || 0), 0)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">
                      {filteredData.reduce((sum, row) => sum + parseInt(row.audios_generados || 0), 0)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">
                      {filteredData.reduce((sum, row) => sum + parseInt(row.anuncios_guardados || 0), 0)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">
                      {filteredData.reduce((sum, row) => sum + parseInt(row.anuncios_programados || 0), 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                      {filteredData.reduce((sum, row) => sum + parseFloat(row.costo_total_euros || 0), 0).toFixed(2)} €
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Info footer */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Nota sobre los costos:</p>
              <p className="text-blue-700">
                Los costos mostrados son <strong>estimaciones</strong> basadas en las tarifas públicas de OpenAI (~3¢/1K tokens) 
                y ElevenLabs (~15¢/1K caracteres). Los costos reales pueden variar según tus contratos empresariales 
                con estos proveedores.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacturacionIAPage;

