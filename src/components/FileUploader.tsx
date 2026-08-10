'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image, Video, Loader2 } from 'lucide-react';

interface FileUploaderProps {
    onUpload: (url: string) => void;
    type?: 'image' | 'video';
    label?: string;
    currentUrl?: string | null;
    className?: string;
    accept?: string;
}

export default function FileUploader({
    onUpload,
    type = 'image',
    label = 'Загрузить файл',
    currentUrl,
    className = '',
    accept
}: FileUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(currentUrl || null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isVideo = type === 'video';
    const acceptTypes = accept || (isVideo ? 'video/*' : 'image/*');

    const handleFile = async (file: File) => {
        // Проверяем тип
        const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
        const validTypes = isVideo ? validVideoTypes : validImageTypes;

        if (!validTypes.includes(file.type)) {
            setError(`Неподдерживаемый формат. Разрешены: ${validTypes.join(', ')}`);
            return;
        }

        // Проверяем размер (50MB)
        if (file.size > 50 * 1024 * 1024) {
            setError('Файл слишком большой (макс. 50MB)');
            return;
        }

        setError(null);
        setUploading(true);

        // Показываем превью
        const reader = new FileReader();
        reader.onload = (e) => {
            setPreview(e.target?.result as string);
        };
        if (!isVideo) {
            reader.readAsDataURL(file);
        } else {
            setPreview(URL.createObjectURL(file));
        }

        // Отправляем на сервер
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Ошибка загрузки');
            }

            onUpload(data.url);
        } catch (err: any) {
            setError(err.message || 'Ошибка загрузки');
            setPreview(currentUrl || null);
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await handleFile(file);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        await handleFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleRemove = () => {
        setPreview(null);
        onUpload('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className={className}>
            {preview ? (
                <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                    {isVideo ? (
                        <video src={preview} className="w-full aspect-video object-cover" controls />
                    ) : (
                        <img src={preview} alt="Preview" className="w-full aspect-video object-cover" />
                    )}
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    {uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>
                    )}
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                        isDragging ? 'border-teal-500 bg-teal-50' : ''
                    }`}
                    style={{ borderColor: 'var(--border)' }}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept={acceptTypes}
                        className="hidden"
                    />
                    {isVideo ? (
                        <Video className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: 'var(--foreground-secondary)' }} />
                    ) : (
                        <Image className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: 'var(--foreground-secondary)' }} />
                    )}
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                        {label}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                        Кликните или перетащите файл
                    </p>
                    <p className="text-xs mt-2" style={{ color: 'var(--foreground-secondary)' }}>
                        {isVideo ? 'MP4, WebM, OGG до 50MB' : 'JPG, PNG, WEBP, GIF до 50MB'}
                    </p>
                </div>
            )}

            {error && (
                <p className="text-sm text-red-500 mt-2">{error}</p>
            )}
        </div>
    );
}
