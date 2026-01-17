import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Plus, 
  Search, 
  Edit2, 
  Trash2,
  Users,
  Link as LinkIcon,
  X,
  Check,
  Loader2,
  FileText,
  CreditCard,
  MapPin,
  Building,
  Hash,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

/**
 * Página de Gestión de Empresas
 * Administra empresas y muestra sus relaciones con usuarios
 */
const CompaniesManagementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [saving, setSaving] = useState(false);
  const [adminEmpresaIds, setAdminEmpresaIds] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    withUsers: 0,
    withGroups: 0
  });

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Formulario
  const [formData, setFormData] = useState({
    razon_social: '',
    cif: '',
    direccion_postal: '',
    codigo_postal: '',
    comunidad_autonoma: '',
    provincia: '',
    localidad: '',
    pais: '',
    metodo_pago: '',
    datos_bancarios: '',
    documento_sepa_url: ''
  });

  const [uploadingSepa, setUploadingSepa] = useState(false);

  // Subir documento SEPA
  const handleUploadSepa = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploadingSepa(true);

      // Validar tipo de archivo (PDF)
      if (file.type !== 'application/pdf') {
        alert('Solo se permiten archivos PDF');
        return;
      }

      // Validar tamaño (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('El archivo no puede superar los 10MB');
        return;
      }

      // Generar nombre único para el archivo
      const fileExt = file.name.split('.').pop();
      const fileName = `sepa_${Date.now()}.${fileExt}`;

      // Subir archivo al bucket
      const { data, error: uploadError } = await supabase.storage
        .from('sepa_docs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('sepa_docs')
        .getPublicUrl(fileName);

      setFormData({ ...formData, documento_sepa_url: publicUrl });
      logger.dev('✅ Documento SEPA subido:', publicUrl);
    } catch (error) {
      logger.error('Error subiendo documento SEPA:', error);
      alert('Error al subir el documento: ' + error.message);
    } finally {
      setUploadingSepa(false);
    }
  };

  // Obtener empresas asignadas al admin
  useEffect(() => {
    const fetchAdminEmpresas = async () => {
      if (!user) return;

      const userId = user?.id || user?.usuario_id || user?.user_id;

      try {
        // Obtener marcas asignadas al admin
        const { data: adminMarcas, error: errorMarcas } = await supabase
          .from('admin_asignaciones')
          .select('marca_id')
          .eq('admin_id', userId);

        if (errorMarcas) {
          logger.error('Error obteniendo marcas del admin:', errorMarcas);
          setAdminEmpresaIds([]);
          return;
        }

        if (!adminMarcas || adminMarcas.length === 0) {
          logger.dev('Admin sin marcas asignadas');
          setAdminEmpresaIds([]);
          return;
        }

        const marcasIds = adminMarcas.map(m => m.marca_id).filter(Boolean);

        // Obtener empresas de esas marcas
        const { data: marcaEmpresas, error: errorMarcaEmpresas } = await supabase
          .from('marca_empresas')
          .select('empresa_id')
          .in('marca_id', marcasIds);

        if (errorMarcaEmpresas) {
          logger.error('Error obteniendo empresas de las marcas:', errorMarcaEmpresas);
          setAdminEmpresaIds([]);
          return;
        }

        const empresasIds = (marcaEmpresas || []).map(me => me.empresa_id).filter(Boolean);
        logger.dev(`Admin tiene acceso a ${empresasIds.length} empresa(s)`);
        setAdminEmpresaIds(empresasIds);
      } catch (e) {
        logger.error('Excepción obteniendo empresas del admin:', e);
        setAdminEmpresaIds([]);
      }
    };

    fetchAdminEmpresas();
  }, [user]);

  // Cargar empresas
  const loadCompanies = async () => {
    try {
      setLoading(true);

      if (adminEmpresaIds.length === 0) {
        setCompanies([]);
        setFilteredCompanies([]);
        setStats({ total: 0, withUsers: 0, withGroups: 0 });
        setLoading(false);
        return;
      }
      
      // Obtener empresas con estadísticas de usuarios y grupos
      const { data: companiesData, error: companiesError } = await supabase
        .from('empresas')
        .select('*')
        .in('id', adminEmpresaIds)
        .order('razon_social');

      if (companiesError) throw companiesError;

      // Obtener conteo de usuarios por empresa
      const { data: usuariosCount } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .in('empresa_id', adminEmpresaIds);

      // Mapear conteos
      const usuariosMap = new Map();

      (usuariosCount || []).forEach(u => {
        usuariosMap.set(u.empresa_id, (usuariosMap.get(u.empresa_id) || 0) + 1);
      });

      // Agregar conteos a las empresas
      const companiesWithCounts = (companiesData || []).map(company => ({
        ...company,
        usuarios_count: usuariosMap.get(company.id) || 0
      }));

      setCompanies(companiesWithCounts);
      setFilteredCompanies(companiesWithCounts);

      // Calcular estadísticas
      const total = companiesWithCounts.length;
      const withUsers = companiesWithCounts.filter(c => c.usuarios_count > 0).length;

      setStats({ total, withUsers, withGroups: 0 });

      logger.dev('📊 Empresas cargadas:', companiesWithCounts.length);
    } catch (error) {
      logger.error('Error cargando empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminEmpresaIds.length > 0) {
      loadCompanies();
    } else if (!loading) {
      setLoading(false);
    }
  }, [adminEmpresaIds]);

  // Filtrar empresas
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCompanies(companies);
      return;
    }

    const filtered = companies.filter(company =>
      company.razon_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.cif?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.localidad?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredCompanies(filtered);
    setCurrentPage(1); // Reset página al buscar
  }, [searchTerm, companies]);

  // Paginación
  const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCompanies = filteredCompanies.slice(startIndex, endIndex);

  // Abrir modal para crear nueva empresa
  const handleCreateNew = () => {
    setEditingCompany(null);
    setFormData({
      razon_social: '',
      cif: '',
      direccion_postal: '',
      codigo_postal: '',
      comunidad_autonoma: '',
      provincia: '',
      localidad: '',
      pais: 'España',
      metodo_pago: '',
      datos_bancarios: '',
      documento_sepa_url: ''
    });
    setShowModal(true);
  };

  // Abrir modal para editar empresa
  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      razon_social: company.razon_social || '',
      cif: company.cif || '',
      direccion_postal: company.direccion_postal || '',
      codigo_postal: company.codigo_postal || '',
      comunidad_autonoma: company.comunidad_autonoma || '',
      provincia: company.provincia || '',
      localidad: company.localidad || '',
      pais: company.pais || 'España',
      metodo_pago: company.metodo_pago || '',
      datos_bancarios: company.datos_bancarios || '',
      documento_sepa_url: company.documento_sepa_url || ''
    });
    setShowModal(true);
  };

  // Guardar empresa (crear o actualizar)
  const handleSave = async () => {
    try {
      // Validaciones
      if (!formData.razon_social?.trim()) {
        alert('La razón social es obligatoria');
        return;
      }

      setSaving(true);

      if (editingCompany) {
        // Actualizar empresa existente
        const { error } = await supabase
          .from('empresas')
          .update({
            razon_social: formData.razon_social.trim(),
            cif: formData.cif.trim() || null,
            direccion_postal: formData.direccion_postal.trim() || null,
            codigo_postal: formData.codigo_postal.trim() || null,
            comunidad_autonoma: formData.comunidad_autonoma.trim() || null,
            provincia: formData.provincia.trim() || null,
            localidad: formData.localidad.trim() || null,
            pais: formData.pais.trim() || null,
            metodo_pago: formData.metodo_pago.trim() || null,
            datos_bancarios: formData.datos_bancarios.trim() || null,
            documento_sepa_url: formData.documento_sepa_url.trim() || null
          })
          .eq('id', editingCompany.id);

        if (error) throw error;

        logger.dev('✅ Empresa actualizada:', formData.razon_social);
      } else {
        // Crear nueva empresa
        const { data: newCompany, error } = await supabase
          .from('empresas')
          .insert({
            razon_social: formData.razon_social.trim(),
            cif: formData.cif.trim() || null,
            direccion_postal: formData.direccion_postal.trim() || null,
            codigo_postal: formData.codigo_postal.trim() || null,
            comunidad_autonoma: formData.comunidad_autonoma.trim() || null,
            provincia: formData.provincia.trim() || null,
            localidad: formData.localidad.trim() || null,
            pais: formData.pais.trim() || null,
            metodo_pago: formData.metodo_pago.trim() || null,
            datos_bancarios: formData.datos_bancarios.trim() || null,
            documento_sepa_url: formData.documento_sepa_url.trim() || null
          })
          .select()
          .single();

        if (error) throw error;

        // Asignar la nueva empresa a la marca del admin
        if (newCompany && user) {
          const userId = user?.id || user?.usuario_id || user?.user_id;
          logger.dev('🔍 Intentando asignar empresa a marca. User ID:', userId);
          
          try {
            // Obtener marca del admin
            const { data: adminMarca, error: marcaError } = await supabase
              .from('admin_asignaciones')
              .select('marca_id')
              .eq('admin_id', userId)
              .limit(1)
              .single();

            if (marcaError) {
              logger.error('❌ Error obteniendo marca del admin:', marcaError);
            } else if (!adminMarca?.marca_id) {
              logger.warn('⚠️ Admin no tiene marca asignada en admin_asignaciones');
            } else {
              logger.dev('✅ Marca encontrada:', adminMarca.marca_id);
              
              // Insertar en marca_empresas
              const { error: insertError } = await supabase
                .from('marca_empresas')
                .insert({
                  marca_id: adminMarca.marca_id,
                  empresa_id: newCompany.id,
                  created_by: userId
                });
              
              if (insertError) {
                logger.error('❌ Error insertando en marca_empresas:', insertError);
              } else {
                logger.dev('✅ Empresa asignada a marca exitosamente:', adminMarca.marca_id);
              }
            }
          } catch (error) {
            logger.error('❌ Excepción asignando empresa a marca:', error);
          }
        }

        logger.dev('✅ Empresa creada:', formData.razon_social);
      }

      // Recargar lista y cerrar modal
      await loadCompanies();
      setShowModal(false);
    } catch (error) {
      logger.error('Error guardando empresa:', error);
      alert('Error al guardar la empresa: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Eliminar empresa
  const handleDelete = async (company) => {
    if (!confirm(`¿Estás seguro de eliminar la empresa "${company.razon_social}"?\n\nEsto eliminará también todos sus usuarios, grupos y relaciones.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('empresas')
        .delete()
        .eq('id', company.id);

      if (error) throw error;

      logger.dev('🗑️ Empresa eliminada:', company.razon_social);
      await loadCompanies();
    } catch (error) {
      logger.error('Error eliminando empresa:', error);
      alert('Error al eliminar la empresa: ' + error.message);
    }
  };

  // Estadísticas
  const statCards = [
    {
      title: 'Total Empresas',
      value: stats.total,
      icon: Building2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    }
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Gestión de Empresas</h1>
              <p className="text-muted-foreground mt-1">
                Administra empresas y visualiza sus usuarios y grupos
              </p>
            </div>
          </div>
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus size={18} />
            Nueva Empresa
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {loading ? '...' : stat.value}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Buscador */}
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Buscar por razón social, CIF o localidad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Lista de empresas */}
        <Card className="p-6">
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="w-12 h-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">No se encontraron empresas</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza creando tu primera empresa'}
                </p>
                {!searchTerm && (
                  <Button onClick={handleCreateNew} className="gap-2">
                    <Plus size={18} />
                    Nueva Empresa
                  </Button>
                )}
              </div>
            ) : (
              paginatedCompanies.map((company, index) => (
                <motion.div
                  key={company.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-all"
                >
                  {/* Información de la empresa */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">
                        {company.razon_social || 'Sin nombre'}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {company.cif && (
                          <span>CIF: {company.cif}</span>
                        )}
                        {company.localidad && (
                          <>
                            <span>•</span>
                            <span className="truncate">
                              {company.localidad}
                              {company.provincia && `, ${company.provincia}`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Usuarios count */}
                  <div className="flex items-center gap-2 px-4">
                    <Users size={16} className="text-green-500" />
                    <span className="text-sm font-medium">{company.usuarios_count}</span>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleEdit(company)}
                    >
                      <Edit2 size={14} />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => handleDelete(company)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </motion.div>
              ))
            )}

            {/* Paginación */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Mostrando {startIndex + 1}-{Math.min(endIndex, filteredCompanies.length)} de {filteredCompanies.length} empresas
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="gap-1"
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="gap-1"
                  >
                    Siguiente
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Modal de creación/edición */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-background rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                {/* Header del modal */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {editingCompany ? 'Editar Empresa' : 'Nueva Empresa'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {editingCompany ? 'Modifica los datos de la empresa' : 'Completa la información de la nueva empresa'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                  >
                    <X size={18} />
                  </Button>
                </div>

                {/* Formulario */}
                <div className="space-y-4">
                  {/* Datos Básicos */}
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Building size={16} />
                      Datos Básicos
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="razon_social">Razón Social *</Label>
                        <Input
                          id="razon_social"
                          value={formData.razon_social}
                          onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                          placeholder="Ej: Mi Empresa S.L."
                          disabled={saving}
                        />
                      </div>

                      <div>
                        <Label htmlFor="cif">CIF/NIF</Label>
                        <Input
                          id="cif"
                          value={formData.cif}
                          onChange={(e) => setFormData({ ...formData, cif: e.target.value })}
                          placeholder="Ej: B12345678"
                          disabled={saving}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dirección */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-semibold flex items-center gap-2">
                      <MapPin size={16} />
                      Dirección
                    </h3>
                    
                    <div>
                      <Label htmlFor="direccion_postal">Dirección Postal</Label>
                      <Input
                        id="direccion_postal"
                        value={formData.direccion_postal}
                        onChange={(e) => setFormData({ ...formData, direccion_postal: e.target.value })}
                        placeholder="Calle, número, piso..."
                        disabled={saving}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="codigo_postal">Código Postal</Label>
                        <Input
                          id="codigo_postal"
                          value={formData.codigo_postal}
                          onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                          placeholder="Ej: 28001"
                          disabled={saving}
                        />
                      </div>

                      <div>
                        <Label htmlFor="localidad">Localidad</Label>
                        <Input
                          id="localidad"
                          value={formData.localidad}
                          onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                          placeholder="Ej: Madrid"
                          disabled={saving}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="provincia">Provincia</Label>
                        <Input
                          id="provincia"
                          value={formData.provincia}
                          onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                          placeholder="Ej: Madrid"
                          disabled={saving}
                        />
                      </div>

                      <div>
                        <Label htmlFor="comunidad_autonoma">Comunidad Autónoma</Label>
                        <Input
                          id="comunidad_autonoma"
                          value={formData.comunidad_autonoma}
                          onChange={(e) => setFormData({ ...formData, comunidad_autonoma: e.target.value })}
                          placeholder="Ej: Comunidad de Madrid"
                          disabled={saving}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="pais">País</Label>
                      <Input
                        id="pais"
                        value={formData.pais}
                        onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                        placeholder="España"
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* Datos de Pago */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-semibold flex items-center gap-2">
                      <CreditCard size={16} />
                      Datos de Pago
                    </h3>
                    
                    <div>
                      <Label htmlFor="metodo_pago">Método de Pago</Label>
                      <Input
                        id="metodo_pago"
                        value={formData.metodo_pago}
                        onChange={(e) => setFormData({ ...formData, metodo_pago: e.target.value })}
                        placeholder="Ej: Transferencia, Domiciliación..."
                        disabled={saving}
                      />
                    </div>

                    <div>
                      <Label htmlFor="datos_bancarios">Datos Bancarios</Label>
                      <Textarea
                        id="datos_bancarios"
                        value={formData.datos_bancarios}
                        onChange={(e) => setFormData({ ...formData, datos_bancarios: e.target.value })}
                        placeholder="IBAN, entidad bancaria, etc..."
                        rows={3}
                        disabled={saving}
                      />
                    </div>

                    {/* Documento SEPA */}
                    <div>
                      <Label htmlFor="documento_sepa">Documento SEPA (PDF)</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          id="documento_sepa"
                          accept="application/pdf"
                          onChange={handleUploadSepa}
                          disabled={saving || uploadingSepa}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('documento_sepa').click()}
                          disabled={saving || uploadingSepa}
                          className="gap-2"
                        >
                          {uploadingSepa ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              Subiendo...
                            </>
                          ) : (
                            <>
                              <FileText size={16} />
                              Subir Documento
                            </>
                          )}
                        </Button>
                        {formData.documento_sepa_url && (
                          <a
                            href={formData.documento_sepa_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline flex items-center gap-1"
                          >
                            <Check size={14} />
                            Ver documento
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Máximo 10MB. Solo archivos PDF.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-3 mt-6 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !formData.razon_social.trim()}
                    className="flex-1 gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        {editingCompany ? 'Actualizar' : 'Crear'} Empresa
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default CompaniesManagementPage;

