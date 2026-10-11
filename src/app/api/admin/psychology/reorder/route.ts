import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';


export async function POST(request: NextRequest) {
    try {
        const items = await request.json();

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'Ожидается массив' }, { status: 400 });
        }

        // Обновляем sort_order для каждого элемента
        const updates = items.map(async (item) => {
            const { error } = await db
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
