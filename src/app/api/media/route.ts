import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';


export async function GET() {
    try {
        const { data, error } = await db
            .from('media_gallery')
            .select('*')
            .eq('is_published', true)
            .order('sort_order', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch {
        return NextResponse.json({ error: 'Ошибка загрузки медиа' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;
    try {
        const body = await request.json();

        const { data, error } = await db
            .from('media_gallery')
            .insert({
                title: body.title,
                description: body.description,
                media_type: body.media_type,
                before_image_url: body.before_image_url,
                after_image_url: body.after_image_url,
                video_url: body.video_url,
                thumbnail_url: body.thumbnail_url,
                category: body.category,
                client_name: body.client_name,
                service_type: body.service_type,
                is_published: body.is_published ?? true,
                sort_order: body.sort_order || 0
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Ошибка создания' }, { status: 500 });
    }
}
