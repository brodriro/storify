# SPEC: Conversational NAS Agent

## GOAL

Implement a conversational agent capable of controlling NAS operations
via natural language.

## CAPABILITIES

-   Query system: disk_usage, recent_files, suspicious_activity
-   Trigger operations: backup_incremental, scan_logs, move_files
-   Provide structured responses
-   Map natural language → actionable system commands

## ENDPOINTS

### POST /chat

Input:

    {
      "message": "string"
    }

Output:

    {
      "intent": "disk_usage | recent_files | backup_incremental | suspicious_activity | unknown",
      "action": {},
      "response": "string"
    }

## INTENT MAPPING

-   "cuánto espacio", "espacio disponible" → `disk_usage`
-   "archivos esta semana", "recientes" → `recent_files`
-   "backup", "incremental" → `backup_incremental`
-   "sospechoso", "anómalo" → `suspicious_activity`

## REQUIRED MODULES

-   fs_adapter
-   shell_adapter
-   backup_manager
-   logs_analyzer
-   llm_intent_parser

## LOGIC

1.  Receive message\
2.  LLM → intent\
3.  Execute mapped action\
4.  Return structured result

## SECURITY REQUIREMENTS

-   No arbitrary shell execution\
-   Command allowlist\
-   Log every action
