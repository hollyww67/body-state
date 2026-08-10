import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Максимальный размер файла: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Разрешённые типы файлов
const ALLOWED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/webm', 'video/ogg']
};

// Путь к папке загрузок
const UPLOAD_DIR = '/var/www/doctor-site-uploads/media';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as string || 'image'; // image | video

        if (!file) {
            return NextResponse.json({ error: 'Файл не найден' }, { status: 400 });
        }

        // Проверяем размер
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'Файл слишком большой (макс. 50MB)' }, { status: 400 });
        }

        // Проверяем тип
        const allowedTypes = type === 'video' ? ALLOWED_TYPES.video : ALLOWED_TYPES.image;
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: `Неподдерживаемый тип файла: ${file.type}` }, { status: 400 });
        }

        // Определяем папку для сохранения
        const folder = type === 'video' ? 'videos' : 'images';
        const uploadPath = path.join(UPLOAD_DIR, folder);

        // Создаём папку если её нет
        if (!existsSync(uploadPath)) {
            await mkdir(uploadPath, { recursive: true });
        }

        // Генерируем уникальное имя файла
        const ext = file.name.split('.').pop() || (type === 'video' ? 'mp4' : 'jpg');
        const fileName = `${randomUUID()}.${ext}`;
        const filePath = path.join(uploadPath, fileName);

        // Конвертируем File в Buffer и сохраняем
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Формируем публичный URL
        const publicUrl = `/media/${folder}/${fileName}`;

        return NextResponse.json({
            success: true,
            url: publicUrl,
            path: filePath,
            fileName: file.name
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Ошибка загрузки файла' }, { status: 500 });
    }
}
