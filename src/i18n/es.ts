/**
 * Every user-facing string (decision D5: Spanish UI, strings in one place so
 * another language can be added later). `{name}` placeholders are filled by
 * t(). Identifiers, logs and messages meant for the LLM stay in English.
 *
 * `client` is sent to the browser (layout, #i18n) for public/js/*.js.
 * src/i18n/i18n.spec.ts checks that every key used by the views and scripts
 * exists here.
 */
export const es = {
  app: {
    name: 'Storify NAS',
    brand: 'Storify',
    skipToContent: 'Saltar al contenido',
  },
  header: {
    hello: 'Hola, {name}',
    account: 'Cuenta',
    darkTheme: 'Tema oscuro',
    admin: 'Panel de administración',
    logout: 'Cerrar sesión',
  },
  login: {
    title: 'Iniciar sesión',
    username: 'Usuario',
    password: 'Contraseña',
    submit: 'Entrar',
    invalid: 'Usuario o contraseña incorrectos',
  },
  browser: {
    title: 'Archivos',
    storageUsed: 'Almacenamiento usado',
    usedOf: '{used} de {total}',
    sortBy: 'Ordenar por:',
    sortName: 'Nombre',
    sortDate: 'Fecha',
    orderAsc: 'Orden ascendente',
    orderDesc: 'Orden descendente',
    upload: 'Subir',
    newFolder: 'Nueva carpeta',
    breadcrumb: 'Ruta',
    home: 'Inicio',
    files: 'Archivos',
    empty: 'Esta carpeta está vacía.',
    emptyHint: 'Arrastra archivos aquí o usa «Subir».',
    parentFolder: 'Carpeta superior',
    select: 'Seleccionar {name}',
    actionsFor: 'Acciones de {name}',
    rename: 'Renombrar',
    move: 'Mover',
    delete: 'Eliminar',
    pagination: 'Paginación',
    previousPage: 'Anterior',
    nextPage: 'Siguiente',
    pageStatus: 'Página {page} de {pages} · {items} elementos',
    download: 'Descargar',
    close: 'Cerrar',
    previous: 'Anterior',
    next: 'Siguiente',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    selection: 'Selección',
  },
  dashboard: {
    title: 'Panel de administración',
    back: 'Volver a los archivos',
    usage: 'Uso del almacenamiento',
    files: 'archivos',
    totalSize: 'Tamaño total',
    usageLimit: 'Respecto al límite de {gb} GB',
    usageReference:
      'Respecto a una capacidad de referencia de {gb} GB (no se aplica como límite)',
    fileTypes: 'Tipos de archivo',
    perUser: 'Uso por usuario',
    backup: 'Copia de seguridad',
    backupText:
      'Crea y descarga un backup completo de los datos de los usuarios.',
    createBackup: 'Crear backup',
    downloadBackup: 'Descargar el último backup completo',
  },
  chat: {
    open: 'Abrir asistente',
    assistant: 'Asistente',
    title: 'Storify AI',
    subtitle: 'Asistente del NAS',
    close: 'Cerrar asistente',
    conversation: 'Conversación',
    message: 'Mensaje',
    placeholder: 'Pregunta por tus archivos, el espacio…',
    send: 'Enviar',
  },
  client: {
    browser: {
      requestFailed: 'La petición falló ({status})',
      partialFailure: '{label}: {count} con error',
      renamedDuplicates: 'Archivos duplicados renombrados:',
      uploadFailed: 'Error al subir',
      moveFailed: 'Error al mover',
      renameFailed: 'Error al renombrar',
      deleteFailed: 'Error al eliminar',
      createFolderFailed: 'No se pudo crear la carpeta',
      bulkDeleteFailed: 'Error al eliminar la selección',
      bulkMoveFailed: 'Error al mover la selección',
      deleteLabel: 'Eliminar',
      moveLabel: 'Mover',
      previewUnavailable: 'No hay vista previa para este tipo de archivo.',
      selectedCount: '{count} seleccionados',
      renameTitle: 'Renombrar',
      renamePrompt: 'Nuevo nombre:',
      moveTitle: 'Mover',
      movePrompt: 'Carpeta de destino (relativa a la raíz, p. ej. «fotos»):',
      deleteTitle: 'Eliminar',
      deleteConfirm: '¿Eliminar «{name}»?',
      newFolderTitle: 'Nueva carpeta',
      newFolderPrompt: 'Nombre de la carpeta:',
      bulkDeleteTitle: 'Eliminar selección',
      bulkDeleteConfirm: '¿Eliminar {count} elementos? No se puede deshacer.',
      bulkMoveTitle: 'Mover selección',
      bulkMovePrompt:
        'Carpeta de destino (relativa a la raíz) para {count} elementos:',
    },
    dashboard: {
      inProgress: 'Ya hay un backup ejecutándose.',
      started: 'Backup iniciado. Se generará en segundo plano.',
      failed: 'No se pudo iniciar el backup.',
      error: 'Error al iniciar el backup.',
    },
    chat: {
      you: 'Tú',
      assistant: 'Storify AI',
      welcome:
        '¡Hola! Soy el asistente de Storify. Puedo ayudarte con:\n' +
        '- **Espacio disponible**\n' +
        '- **Archivos recientes**\n' +
        '- **Backups del sistema**\n' +
        '- **Preguntas generales**\n\n' +
        '¿En qué te ayudo?',
      noResponse: 'No he recibido respuesta del asistente. Inténtalo de nuevo.',
      disconnected: 'Se ha perdido la conexión con el asistente.',
      confirm: 'Confirmar',
      cancel: 'Cancelar',
      disabled: 'El asistente no está configurado en este servidor.',
      providerNotice:
        'Tus mensajes, y el contenido de los documentos que me pidas resumir o clasificar, se envían a {provider} para procesarlos. Las acciones que modifican archivos siempre te pedirán confirmación.',
    },
  },
  errors: {
    invalidPath: 'Ruta no válida',
    invalidName: 'Nombre no válido',
    accessDenied: 'Acceso denegado',
    storageRootImmutable: 'La raíz del almacenamiento no se puede modificar',
    userFolderImmutable: 'Las carpetas de usuario no se pueden modificar',
    reservedName: 'Ese nombre está reservado para la carpeta de un usuario',
    targetExists: 'Ya existe un elemento con ese nombre',
    moveIntoItself: 'No se puede mover una carpeta dentro de sí misma',
    destinationMissing: 'La carpeta de destino no existe',
    destinationConflict:
      'Ya existe un elemento con el mismo nombre en el destino',
    fileNotFound: 'Archivo no encontrado',
    itemNotFound: 'Elemento no encontrado',
    noThumbnail: 'No hay miniatura para este tipo de archivo',
    storageLimit:
      'Límite de almacenamiento alcanzado ({limit}): libera espacio o pide al administrador que aumente TOTAL_STORAGE_GB',
    noBackup: 'No hay ningún backup disponible',
    insufficientRole: 'Permisos insuficientes',
  },
} as const;
