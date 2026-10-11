import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ADMIN_COOKIE, requireAdmin, verifyAdminSessionToken } from '@/lib/admin-auth';


export async function GET(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await context.params;
        const isAdmin = await verifyAdminSessionToken(request.cookies.get(ADMIN_COOKIE)?.value);

        let query = db
            .from('page_content')
            .select('*')
            .eq('slug', slug);
        if (!isAdmin) query = query.eq('is_active', true);
        const { data, error } = await query.single();

        if (error) {
            console.error('PostgreSQL error:', error);
            return NextResponse.json({ error: error.message }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;
    try {
        const { slug } = await context.params;
        const body = await request.json();

        const updateData: any = {
            title: body.title,
            content: body.content,
            is_active: body.is_active ?? true,
            updated_at: new Date().toISOString()
        };

        // Добавляем meta-поля только если они есть в запросе
        if (body.meta_description !== undefined) {
            updateData.meta_description = body.meta_description;
        }
        if (body.meta_keywords !== undefined) {
            updateData.meta_keywords = body.meta_keywords;
        }

        const { data, error } = await db
            .from('page_content')
            .update(updateData)
            .eq('slug', slug)
            .select()
            .single();

        if (error) {
            console.error('PostgreSQL error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;
    try {
        const { slug } = await context.params;

        const { error } = await db
            .from('page_content')
            .delete()
            .eq('slug', slug);

        if (error) {
            console.error('PostgreSQL error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
