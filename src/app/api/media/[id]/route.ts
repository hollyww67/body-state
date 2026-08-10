import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        const { data, error } = await supabase
            .from('media_gallery')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();

        const { data, error } = await supabase
            .from('media_gallery')
            .update({
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
                sort_order: body.sort_order || 0,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        const { error } = await supabase
            .from('media_gallery')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 });
    }
}
