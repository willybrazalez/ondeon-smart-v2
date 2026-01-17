; Script simplificado para el instalador NSIS de Windows

; Configuración post-instalación
!macro customInstall
  ; Crear accesos directos adicionales
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  
  ; Registrar en el registro para el autoupdater
  WriteRegStr HKLM "SOFTWARE\${PRODUCT_NAME}" "InstallLocation" "$INSTDIR"
  
  ; Por defecto, configurar auto-inicio (el usuario puede desactivarlo desde la app)
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}" "$INSTDIR\${PRODUCT_FILENAME}.exe"
!macroend

; Limpieza durante desinstalación
!macro customUnInstall
  ; Limpiar registros
  DeleteRegKey HKLM "SOFTWARE\${PRODUCT_NAME}"
  
  ; Eliminar auto-inicio si existe
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
  
  ; Limpiar accesos directos
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}.lnk"
!macroend
