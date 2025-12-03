import imageCompression from 'browser-image-compression';
import heic2any from 'heic2any';

export interface ProcessedImage {
  file: File;
  preview: string;
  originalSize: number;
  compressedSize: number;
}

export interface ImageProcessingOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: ImageProcessingOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  quality: 0.8,
};

export async function processImage(
  file: File,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;
  
  let processedFile = file;
  
  try {
    if (isHeicFile(file)) {
      console.log(`🔄 Converting HEIC file: ${file.name}`);
      processedFile = await convertHeicToJpeg(file);
      console.log(`✅ HEIC conversion complete: ${processedFile.name}`);
    }
    
    if (processedFile.size > mergedOptions.maxSizeMB! * 1024 * 1024) {
      console.log(`🔄 Compressing image: ${processedFile.name} (${formatFileSize(processedFile.size)})`);
      
      processedFile = await imageCompression(processedFile, {
        maxSizeMB: mergedOptions.maxSizeMB,
        maxWidthOrHeight: mergedOptions.maxWidthOrHeight,
        useWebWorker: true,
        fileType: 'image/jpeg',
      });
      
      console.log(`✅ Compression complete: ${formatFileSize(processedFile.size)}`);
    }
    
    const preview = await createPreview(processedFile);
    
    return {
      file: processedFile,
      preview,
      originalSize,
      compressedSize: processedFile.size,
    };
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function isHeicFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  
  return (
    fileName.endsWith('.heic') ||
    fileName.endsWith('.heif') ||
    fileType === 'image/heic' ||
    fileType === 'image/heif'
  );
}

async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
    
    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    
    return new File([blob], newFileName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('HEIC conversion error:', error);
    throw new Error('Failed to convert HEIC image. Please try a different image format.');
  }
}

async function createPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to create preview'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getCompressionRatio(original: number, compressed: number): string {
  if (original === 0) return '0%';
  const ratio = ((original - compressed) / original) * 100;
  return ratio.toFixed(1) + '%';
}
