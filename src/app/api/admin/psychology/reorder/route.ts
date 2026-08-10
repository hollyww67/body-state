import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const items = await request.json();

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'Ожидается массив' }, { status: 400 });
        }

        // Обновляем sort_order для каждого элемента
        const updates = items.map(async (item) => {
            const { error } = await supabase
                .from('psychology_programs')
                .update({ sort_order: item.sort_order })
                .eq('id', item.id);

            if (error) {
                console.error('Update error for item', item.id, error);
                throw error;
            }
        });

        await Promise.all(updates);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reorder error:', error);
        return NextResponse.json({ error: 'Ошибка обновления порядка' }, { status: 500 });
    }
}
