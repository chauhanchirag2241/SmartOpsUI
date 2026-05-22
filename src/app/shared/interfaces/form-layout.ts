export interface FormSection {
  title: string;
  icon: string;
  layout: 'photo-grid' | 'grid2' | 'grid3' | 'form-array' | 'review' | 'fee-structure' | 'document-grid' | 'custom-fields';
  fields: string[];
  subGroup?: string;
  groupPath?: string;
  formArrayName?: string;
  subGroupMap?: Record<string, string>;
}

export interface FormTab {
  stepIndex: number;
  groupPath?: string;
  hint?: string;
  sections: FormSection[];
}
