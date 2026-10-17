# Documentación

| Documento | Estado | Contenido |
|---|---|---|
| `../README.md` | Vigente | Uso, roles, configuración, despliegue, backups y agente. |
| `base.md` | Vigente (especificación funcional) | Roles, reglas de visibilidad y dashboard tal como se definieron. |
| `file_classification.md` | Vigente | Endpoint y herramienta de clasificación de archivos. |
| `analysis_result.json` | Vigente (2026-10-17) | Análisis agéntico del agente actual: patrones, controles, carencias y recomendaciones. |
| `evaluate_agent.md` | Vigente (prompt) | Prompt con el que se genera `analysis_result.json`. Si cambia el agente (`src/agent/`), vuelve a aplicarlo y actualiza el JSON. |
| `build_agent.md` | Histórico | Especificación inicial del agente (intenciones fijas, `POST /chat`). La implementación actual usa tool calling por Socket.IO con confirmación humana. |
| `promp_diagram.md`, `diagram.png` | Histórico | Prompt e ilustración generados a partir del análisis anterior. |
| `../design-system/storify-nas/DESIGN.md` | Vigente | Sistema de diseño de la interfaz. |
