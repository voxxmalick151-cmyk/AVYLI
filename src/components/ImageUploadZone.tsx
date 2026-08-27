import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  X,
  Image as ImageIcon,
  CheckCircle2,
  Star,
  RefreshCw,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { UploadedImage } from '../types';
import { api } from '../lib/api';

interface ImageUploadZoneProps {
  id?: string;
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxFiles?: number;
  label?: string;
  sublabel?: string;
  multiple?: boolean;
}

export const ImageUploadZone: React.FC<ImageUploadZoneProps> = ({
  id = 'product-image-upload',
  images,
  onChange,
  maxFiles = 8,
  label = 'Fotos do Produto',
  sublabel = 'Arraste e solte fotos do seu computador ou clique para selecionar',
  multiple = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Clipboard Paste of Images (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        processFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [images]);

  // Read file into Base64 and upload to server
  const processFiles = async (files: FileList | File[]) => {
    setErrorMsg(null);
    const validFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        setErrorMsg(`O arquivo "${file.name}" não é uma imagem válida.`);
        continue;
      }
      if (file.size > 15 * 1024 * 1024) {
        setErrorMsg(`A imagem "${file.name}" é muito grande (máximo 15MB).`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Check max files limit
    const currentCount = images.length;
    const allowedFiles = multiple
      ? validFiles.slice(0, Math.max(0, maxFiles - currentCount))
      : [validFiles[0]];

    if (allowedFiles.length === 0) {
      setErrorMsg(`Limite máximo de ${maxFiles} imagens atingido.`);
      return;
    }

    setUploadingCount((prev) => prev + allowedFiles.length);

    const newUploadedList: UploadedImage[] = [...images];

    for (let i = 0; i < allowedFiles.length; i++) {
      const file = allowedFiles[i];
      try {
        // 1. Instant local preview via FileReader
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // 2. Upload to server
        const uploaded = await api.uploadImage({
          data: base64Data,
          name: file.name,
          type: file.type,
        });

        const isFirst = newUploadedList.length === 0 && i === 0;

        const newImage: UploadedImage = {
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          url: uploaded.url,
          dataUrl: base64Data,
          filename: file.name,
          size: file.size,
          isMain: isFirst,
        };

        if (!multiple) {
          // Replace single image
          newUploadedList.length = 0;
          newImage.isMain = true;
          newUploadedList.push(newImage);
        } else {
          newUploadedList.push(newImage);
        }
      } catch (err: any) {
        console.error('Falha ao processar imagem:', err);
        setErrorMsg(`Erro ao fazer upload de "${file.name}".`);
      } finally {
        setUploadingCount((prev) => Math.max(0, prev - 1));
      }
    }

    // Ensure at least one image is marked as main
    if (newUploadedList.length > 0 && !newUploadedList.some((img) => img.isMain)) {
      newUploadedList[0].isMain = true;
    }

    onChange(newUploadedList);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (idToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = images.filter((img) => img.id !== idToRemove);
    if (updated.length > 0 && !updated.some((img) => img.isMain)) {
      updated[0].isMain = true;
    }
    onChange(updated);
  };

  const handleSetMain = (idToMakeMain: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = images.map((img) => ({
      ...img,
      isMain: img.id === idToMakeMain,
    }));
    onChange(updated);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3" id={id}>
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-bold text-white tracking-wide uppercase">
            {label}
          </label>
          <p className="text-[11px] text-gray-400 font-medium">{sublabel}</p>
        </div>
        {images.length > 0 && (
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[#262626] text-gray-300">
            {images.length} {images.length === 1 ? 'foto' : 'fotos'} {multiple ? `/ máx ${maxFiles}` : ''}
          </span>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="p-1 hover:bg-red-500/20 rounded text-red-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 cursor-pointer text-center ${
          isDragging
            ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
            : 'border-[#333333] hover:border-emerald-500/60 bg-[#161616] hover:bg-[#1a1a1a]'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2.5">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              isDragging
                ? 'bg-emerald-500 text-black scale-110'
                : 'bg-[#222222] text-gray-400 group-hover:text-emerald-400 group-hover:bg-[#282828]'
            }`}
          >
            {uploadingCount > 0 ? (
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            ) : (
              <UploadCloud className="w-6 h-6" />
            )}
          </div>

          <div>
            <p className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
              {uploadingCount > 0
                ? `Enviando ${uploadingCount} imagem(ns)...`
                : isDragging
                ? 'Solte os arquivos de imagem aqui'
                : 'Clique para selecionar fotos ou arraste do seu computador'}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Suporta PNG, JPG, JPEG, WEBP ou GIF (ou cole com <kbd className="px-1.5 py-0.5 bg-[#262626] rounded text-[10px] text-gray-300 font-mono">Ctrl+V</kbd>)
            </p>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Upload Direto do Dispositivo
            </span>
          </div>
        </div>
      </div>

      {/* Uploaded Images Gallery Grid */}
      {images.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold text-gray-300">Imagens Carregadas:</span>
            <span className="text-[11px]">Clique em ★ para definir a capa principal</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img) => (
              <div
                key={img.id}
                className={`group relative rounded-xl border bg-[#111111] overflow-hidden transition-all duration-150 ${
                  img.isMain
                    ? 'border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'border-[#262626] hover:border-[#404040]'
                }`}
              >
                {/* Thumbnail */}
                <div className="aspect-square w-full bg-[#0A0A0A] overflow-hidden relative flex items-center justify-center">
                  <img
                    src={img.dataUrl || img.url}
                    alt={img.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
                    }}
                  />

                  {/* Main / Cover Badge */}
                  {img.isMain && (
                    <div className="absolute top-2 left-2 bg-emerald-500 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-md flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-black" />
                      Capa Principal
                    </div>
                  )}

                  {/* Action Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                    {!img.isMain && (
                      <button
                        type="button"
                        onClick={(e) => handleSetMain(img.id, e)}
                        title="Definir como Foto de Capa"
                        className="p-2 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-transform hover:scale-110 shadow-lg"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleRemove(img.id, e)}
                      title="Remover Imagem"
                      className="p-2 rounded-lg bg-red-500/80 text-white hover:bg-red-600 transition-transform hover:scale-110 shadow-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Meta info */}
                <div className="p-2 bg-[#161616] border-t border-[#262626] flex items-center justify-between text-[10px]">
                  <span className="text-gray-300 font-medium truncate max-w-[100px]" title={img.filename}>
                    {img.filename}
                  </span>
                  <span className="text-gray-500 font-mono">
                    {formatFileSize(img.size)}
                  </span>
                </div>
              </div>
            ))}

            {/* Quick Add Button if not reached max */}
            {images.length < maxFiles && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border border-dashed border-[#333333] hover:border-emerald-500/60 bg-[#161616]/50 hover:bg-[#1a1a1a] flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-emerald-400 transition-all cursor-pointer group"
              >
                <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  + Adicionar
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
