# 🚨 Acción Requerida: Actualizar Lambda de Node.js 20.x

## 📋 Resumen

AWS ha notificado que el soporte para Node.js 20.x en Lambda terminará el **30 de abril de 2026**. Es necesario actualizar las funciones Lambda antes de esa fecha.

---

## ⏰ Cronograma de Deprecación

- **30 de abril de 2026**: Fin de soporte (sin parches de seguridad)
- **1 de junio de 2026**: No se podrán crear nuevas funciones con Node.js 20.x
- **1 de julio de 2026**: No se podrán actualizar funciones existentes con Node.js 20.x

**Recomendación**: Actualizar **antes del 30 de abril de 2026**

---

## 🔍 Paso 1: Identificar Funciones Lambda Afectadas

### Opción A: Usar AWS CLI (Recomendado)

Ejecuta este comando para cada región donde tengas funciones Lambda:

```bash
# Región us-east-1
aws lambda list-functions --region us-east-1 --output text --query "Functions[?Runtime=='nodejs20.x'].FunctionArn"

# Región eu-north-1 (según documentación, probablemente aquí)
aws lambda list-functions --region eu-north-1 --output text --query "Functions[?Runtime=='nodejs20.x'].FunctionArn"

# Región us-west-2
aws lambda list-functions --region us-west-2 --output text --query "Functions[?Runtime=='nodejs20.x'].FunctionArn"
```

### Opción B: AWS Console

1. Ve a [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. Revisa cada función Lambda
3. Verifica el **Runtime** en la configuración
4. Anota las funciones que usen `nodejs20.x`

### Opción C: AWS Health Dashboard

1. Ve a [AWS Health Dashboard](https://phd.aws.amazon.com/)
2. Busca en la pestaña **"Affected resources"**
3. Verás las funciones Lambda afectadas listadas allí

---

## 📝 Paso 2: Identificar Funciones del Proyecto ONDEON

Según la documentación del proyecto, estas son las funciones Lambda que probablemente necesitas actualizar:

### Funciones Relacionadas con S3 Upload

1. **Función Lambda para subida a S3**
   - URL configurada en: `ONDEON_LAMBDA_S3_URL`
   - Usada en: `supabase/functions/generate-ad/index.ts`
   - Probable ubicación: `lambda-dist/index.mjs` o `lambda-dist/lambda-upload/index.mjs`

### Verificar en AWS Console

1. Busca funciones Lambda que:
   - Tengan nombres relacionados con "ondeon", "s3", "upload"
   - Estén en la región `eu-north-1` (según documentación)
   - Tengan runtime `nodejs20.x`

---

## 🔄 Paso 3: Actualizar Runtime a Node.js 22.x

### Opción A: AWS Console (Más Fácil)

1. Ve a [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. Selecciona la función Lambda a actualizar
3. Ve a la pestaña **"Configuration"** > **"Runtime settings"**
4. Haz clic en **"Edit"**
5. Selecciona **"Node.js 22.x"** (o la versión más reciente disponible)
6. Haz clic en **"Save"**

### Opción B: AWS CLI

```bash
# Actualizar runtime de una función específica
aws lambda update-function-configuration \
  --function-name NOMBRE_DE_LA_FUNCION \
  --runtime nodejs22.x \
  --region eu-north-1
```

### Opción C: CloudFormation/SAM/Terraform

Si tus funciones Lambda están definidas como código (IaC):

1. Actualiza el runtime en el archivo de configuración:
   ```yaml
   # Ejemplo CloudFormation/SAM
   Runtime: nodejs22.x
   ```

2. Despliega los cambios:
   ```bash
   sam deploy
   # o
   terraform apply
   ```

---

## ✅ Paso 4: Verificar Actualización

### Verificar Runtime Actualizado

```bash
# Verificar que el runtime se actualizó correctamente
aws lambda get-function-configuration \
  --function-name NOMBRE_DE_LA_FUNCION \
  --region eu-north-1 \
  --query Runtime
```

Debería mostrar: `nodejs22.x`

### Probar Funcionalidad

1. **Probar subida de archivos a S3**:
   - Usa la aplicación ONDEON
   - Intenta subir un archivo de audio
   - Verifica que funcione correctamente

2. **Revisar logs de CloudWatch**:
   - Ve a CloudWatch Logs
   - Busca errores relacionados con el runtime
   - Verifica que no haya problemas de compatibilidad

---

## 🧪 Paso 5: Pruebas de Compatibilidad

### Verificar Compatibilidad de Código

Node.js 22.x es compatible con Node.js 20.x en la mayoría de casos, pero verifica:

1. **Dependencias npm**:
   ```bash
   # En el directorio de la función Lambda
   npm audit
   npm outdated
   ```

2. **APIs deprecadas**:
   - Revisa si usas alguna API que haya sido deprecada
   - Node.js 22.x puede tener cambios menores

3. **Pruebas locales** (si tienes el código):
   ```bash
   # Probar con Node.js 22 localmente
   node --version  # Debe ser 22.x
   npm test
   ```

---

## 📋 Checklist de Actualización

- [ ] Identificar todas las funciones Lambda con Node.js 20.x
- [ ] Documentar nombres y ARNs de las funciones afectadas
- [ ] Actualizar runtime a Node.js 22.x en cada función
- [ ] Verificar que el runtime se actualizó correctamente
- [ ] Probar funcionalidad de subida a S3
- [ ] Revisar logs de CloudWatch para errores
- [ ] Probar en ambiente de desarrollo primero (si aplica)
- [ ] Actualizar documentación si es necesario

---

## 🔗 Referencias

- [AWS Lambda Runtime Support Policy](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
- [Node.js 22 Release Notes](https://nodejs.org/en/blog/release/v22.0.0)
- [AWS Health Dashboard](https://phd.aws.amazon.com/)
- [AWS Lambda Console](https://console.aws.amazon.com/lambda/)

---

## ⚠️ Notas Importantes

1. **Backup**: Antes de actualizar, considera crear una versión de la función Lambda como backup
2. **Testing**: Prueba en un ambiente de desarrollo antes de producción
3. **Rollback**: Si algo falla, puedes revertir al runtime anterior fácilmente desde la consola
4. **Monitoreo**: Después de actualizar, monitorea las funciones durante las primeras 24-48 horas

---

## 📞 Soporte

Si encuentras problemas durante la actualización:

1. Revisa los logs de CloudWatch
2. Consulta la [documentación de AWS Lambda](https://docs.aws.amazon.com/lambda/)
3. Contacta [AWS Support](https://console.aws.amazon.com/support/) si es necesario

---

**Última actualización**: Enero 2025  
**Fecha límite de acción**: 30 de abril de 2026


