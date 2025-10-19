export interface HisenseFunctionMetadata {
  name: string;
  description: string;
  parameters?: HisenseFunctionParameter[];
  returnType?: string;
  category?: 'system' | 'app' | 'network' | 'media' | 'other';
  example?: string;
}

export interface HisenseFunctionParameter {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  defaultValue?: unknown;
}

export interface HisenseFunctionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: HisenseFunctionMetadata;
}
