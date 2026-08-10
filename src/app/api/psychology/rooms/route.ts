import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateRoomId(): string {
    return randomBytes(4).toString('hex');
}

// Создание комнаты
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { room_name, created_by } = body;

        const roomId = generateRoomId();
        const host = process.env.JITSI_HOST || '85.198.71.172:8443';
        const meetingUrl = `https://${host}/${roomId}`;

        const { data, error } = await supabase
            .from('psychology_rooms')
            .insert({
                room_id: roomId,
                room_name: room_name || `Консультация ${new Date().toLocaleString()}`,
                created_by: created_by || 'Психолог',
                meeting_url: meetingUrl,
                is_active: true,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, room: data });
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка создания комнаты' }, { status: 500 });
    }
}

// Получение списка комнат
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('psychology_rooms')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка загрузки комнат' }, { status: 500 });
    }
}
