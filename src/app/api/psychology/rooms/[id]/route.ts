import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Получение комнаты по ID
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        const { data, error } = await supabase
            .from('psychology_rooms')
            .select('*')
            .eq('room_id', id)
            .single();

        if (error) {
            return NextResponse.json({ error: 'Комната не найдена' }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка загрузки комнаты' }, { status: 500 });
    }
}

// Удаление комнаты
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        const { error } = await supabase
            .from('psychology_rooms')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка удаления комнаты' }, { status: 500 });
    }
}
