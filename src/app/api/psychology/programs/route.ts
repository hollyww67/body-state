import { NextResponse } from 'next/server';
import { db } from '@/lib/db';


export async function GET() {
    const { data, error } = await db
        .from('psychology_programs')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
