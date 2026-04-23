import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

async function pushToBrevo(email: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const listId = process.env.BREVO_LIST_ID;

  console.log('[Brevo] apiKey present:', !!apiKey);
  console.log('[Brevo] listId:', listId);

  if (!apiKey || !listId) {
    console.warn('[Brevo] Variables manquantes — skip');
    return;
  }

  const payload = {
    email,
    listIds: [parseInt(listId, 10)],
    updateEnabled: true,
  };

  console.log('[Brevo] Sending payload:', JSON.stringify(payload));

  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'accept':       'application/json',
      'content-type': 'application/json',
      'api-key':      apiKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log('[Brevo] Response status:', res.status);
  console.log('[Brevo] Response body:', text);

  if (!res.ok) {
    console.error('[Brevo] Erreur:', res.status, text);
  }
}

// GET — liste des inscrits (admin)
export async function GET() {
  const { data, error } = await supabase
    .from('offers_newsletter')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json([], { status: 200 });
  return NextResponse.json(data);
}

// POST — inscription newsletter (Supabase + Brevo)
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }

  const clean = email.toLowerCase().trim();

  const { data: existing } = await supabase
    .from('offers_newsletter')
    .select('email')
    .eq('email', clean)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Vous êtes déjà inscrit !' }, { status: 409 });
  }

  const { error } = await supabase
    .from('offers_newsletter')
    .insert({ email: clean });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attendre Brevo (au lieu de fire-and-forget) pour éviter la coupure
  try {
    await pushToBrevo(clean);
  } catch (e) {
    console.error('[Brevo] Exception:', e);
  }

  return NextResponse.json({ success: true });
}

// DELETE — supprimer un inscrit
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await supabase
    .from('offers_newsletter')
    .delete()
    .eq('id', Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}