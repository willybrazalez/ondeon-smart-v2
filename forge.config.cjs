module.exports = {
  packagerConfig: {
    name: 'Ondeon-Smart',
    executableName: 'Ondeon-Smart',
    appBundleId: 'com.ondeon.smart',
    appCategoryType: 'public.app-category.music',
    icon: 'assets/icono-ondeon',
    arch: ['x64', 'arm64'],  // Compilar para ambas arquitecturas
    
    // Registrar protocolo personalizado para OAuth deep links
    protocols: [
      {
        name: 'Ondeon OAuth',
        schemes: ['ondeon']
      }
    ],
    
    // Incluir archivos adicionales necesarios
    extraResource: [
      'app-update.yml'
    ],
    
    // Excluir archivos innecesarios (Electron Forge incluirá automáticamente los node_modules necesarios)
    ignore: [
      /^\/src/,           // Excluir código fuente
      /^\/public/,        // Excluir archivos públicos (ya están en dist)
      /^\/scripts/,       // Excluir scripts de desarrollo
      /^\/out/,           // Excluir carpeta out
      /^\/release/,       // Excluir carpeta release
      /^\/XcodeProject/,  // 🔥 CRÍTICO: Excluir proyecto Xcode (causa problemas de notarización)
      /^\/lambda/,        // Excluir funciones Lambda
      /^\/database/,      // Excluir scripts SQL
      /^\/jmeter/,        // Excluir tests JMeter
      /^\/n8n/,           // Excluir workflows n8n
      /^\/supabase/,      // Excluir funciones Edge
      /^\/reports/,       // Excluir reportes
      /^\/results/,       // Excluir resultados
      /^\/documentación/, // Excluir documentación
      /\.map$/,           // Excluir source maps
      /\.md$/,            // Excluir archivos markdown
      /\.sql$/,           // Excluir archivos SQL
      /^\/\.git/,         // Excluir git
      /\.DS_Store/,       // Excluir archivos de macOS
      /^\/\.vscode/,      // Excluir configuración VSCode
      /^\/\.cursor/,      // Excluir configuración Cursor
      /package-lock\.json/,
      /yarn\.lock/
    ],
    
    // Configuración de firma para macOS
    osxSign: {
      identity: '4B930682DF655FB17E7755F466223B8979D9F6F1',
      'hardened-runtime': true,
      'gatekeeper-assess': true,
      entitlements: 'build/entitlements.mac.plist',
      'entitlements-inherit': 'build/entitlements.mac.plist'
    },
    
    // Notarización automática DESACTIVADA
    // Usamos el flujo manual: package -> notarize (script) -> make
    // Esto evita el Error 65 del stapler automático
    // osxNotarize: {
    //   tool: 'notarytool',
    //   keychainProfile: 'ondeon-notarization'
    // }
  },
  
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'Ondeon Smart',
        icon: 'assets/icono-ondeon.icns'
      },
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {}
    }
  ]
};

