import { NextResponse } from 'next/server';
import { db } from '@/lib/db';


export async function GET() {
    const { data, error } = await db
        .from('page_content')
        .select('*')
        .eq('is_active', true)
        .order('slug');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
