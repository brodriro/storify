export interface FileClassificationRequest {
    filename: string;
    current_path: string;
    size: string;
    created_at: string;
    modified_at: string;
    mime_type: string;
    extracted_text: string;
    custom_metadata: string;
    existing_folder_structure: string;
}

export interface ClassificationAction {
    type: 'move' | 'rename' | 'flag' | 'index' | 'archive';
    reason: string;
}

export interface FileClassificationResponse {
    category: string;
    subcategory: string;
    confidence_score: number;
    is_sensitive: boolean;
    sensitivity_reason: string;
    suggested_filename: string;
    suggested_path: string;
    tags: string[];
    actions: ClassificationAction[];
    summary: string;
}
