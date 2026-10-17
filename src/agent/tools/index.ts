import { ClassifyFileTool } from './classify-file.tool';
import { CreateBackupTool } from './create-backup.tool';
import { CreateFolderTool } from './create-folder.tool';
import { DiskUsageTool } from './disk-usage.tool';
import { MoveFileTool } from './move-file.tool';
import { RecentFilesTool } from './recent-files.tool';
import { SearchDocumentsTool } from './search-documents.tool';
import { SummarizeDocumentTool } from './summarize-document.tool';
import { SuspiciousActivityTool } from './suspicious-activity.tool';

/** Every tool the assistant can use. To add one: create the class, list it here. */
export const AGENT_TOOL_CLASSES = [
  DiskUsageTool,
  RecentFilesTool,
  SearchDocumentsTool,
  SummarizeDocumentTool,
  ClassifyFileTool,
  SuspiciousActivityTool,
  CreateBackupTool,
  MoveFileTool,
  CreateFolderTool,
];
