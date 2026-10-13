import { useState, useRef } from 'react';
import { Upload, X, Image, CheckCircle, AlertCircle } from 'lucide-react';
import { auth } from '../utils/auth';
import { API_URL } from '../api/config';

interface ImageUploadProps {
  currentUrl: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
}

export default function ImageUpload({ currentUrl, onUpload, onRemove }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP');
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 5MB');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = auth.getToken();
      const response = await fetch(`${API_URL}/api/Upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Gagal mengunggah gambar');
      }

      const result = await response.json();
      onUpload(`${API_URL}${result.data.url}`);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Gagal mengunggah gambar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const hasImage = currentUrl && currentUrl.length > 0;

  return (
    <div className="image-upload-wrapper">
      {hasImage ? (
        <div className="image-upload-preview">
          <img
            src={currentUrl}
            alt="Preview"
            className="image-upload-preview-img"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';
            }}
          />
          <div className="image-upload-preview-overlay">
            <button
              type="button"
              className="image-upload-change-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Image size={14} />
              Ganti Gambar
            </button>
            <button
              type="button"
              className="image-upload-remove-btn"
              onClick={onRemove}
            >
              <X size={14} />
              Hapus
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`image-upload-dropzone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <div className="image-upload-loading">
              <div className="spinner" style={{ width: 32, height: 32 }}></div>
              <span>Mengunggah gambar...</span>
            </div>
          ) : (
            <>
              <div className="image-upload-icon">
                <Upload size={28} />
              </div>
              <span className="image-upload-text">
                Seret & lepas gambar ke sini
              </span>
              <span className="image-upload-subtext">
                atau klik untuk memilih file
              </span>
              <span className="image-upload-formats">
                JPG, PNG, GIF, WebP • Maks 5MB
              </span>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />

      {uploadError && (
        <div className="image-upload-error">
          <AlertCircle size={14} />
          {uploadError}
        </div>
      )}

      {uploadSuccess && (
        <div className="image-upload-success">
          <CheckCircle size={14} />
          Gambar berhasil diunggah!
        </div>
      )}
    </div>
  );
}
