import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('psychology_programs')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const { data, error } = await supabase
            .from('psychology_programs')
            .insert({
                title: body.title,
                slug: body.slug || body.title.toLowerCase().replace(/\s+/g, '-'),
                description: body.description,
                price: body.price || '0', // Теперь строка
                duration: body.duration,
                features: body.features || [],
                image_url: body.image_url || null,
                is_active: body.is_active ?? true,
                sort_order: body.sort_order || 0
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
