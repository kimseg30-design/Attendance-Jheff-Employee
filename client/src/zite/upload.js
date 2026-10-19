// File uploads go to the public Supabase Storage bucket "uploads"
// with local object URL fallback if Supabase is not configured.
import { useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const upload = async (file) => {
    setIsUploading(true);
    try {
      if (!isSupabaseConfigured) {
        // Return local object URL for preview
        const url = URL.createObjectURL(file);
        return { url };
      }
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error } = await supabase.storage.from('uploads').upload(path, file);
      if (error) throw new Error(error.message);
      return { url: supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl };
    } finally {
      setIsUploading(false);
    }
  };
  return { upload, isUploading };
}
