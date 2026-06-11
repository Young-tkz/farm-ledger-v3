import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const CURRENCY_EXCHANGE_MAP = {
    'USD': 1.0,
    'ZIG': 0.074,
    'ZAR': 0.054
};

export async function POST(req) {
    let activeEntryId = null;

    try {
        const payload = await req.json();
        activeEntryId = payload?.entry_id;

        if (!activeEntryId) {
            console.error("❌ API Thread Abort: Missing entry_id inside request payload.");
            return NextResponse.json({ success: false, error: 'Missing entry_id context identifier.' }, { status: 400 });
        }

        // 1. Fetch target log row from Supabase
        const { data: entry, error: fetchError } = await supabaseAdmin
            .from('ledger_entries')
            .select('*')
            .eq('id', activeEntryId)
            .single();

        if (fetchError || !entry) {
            console.error(`❌ DB Pull Fault for Target Row ID [${activeEntryId}]:`, fetchError?.message);
            throw new Error(`Target document trace not found inside active tables.`);
        }

        if (entry.ai_status === 'done') {
            return NextResponse.json({ success: true, message: 'Node item already finalized.' });
        }

        // 2. Dispatch parameters straight to Groq's standard chat completions endpoint
        const groqApiKey = process.env.GROQ_API_KEY;
        const targetEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

        const response = await fetch(targetEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqApiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: `You are a specialized agricultural bookkeeping parser. Analyze the user's raw operational statement and return a strict JSON object with these exact keys:
                        - "item": string (clean descriptive name)
                        - "category": string (e.g., Seeds, Fertilizer, Fuel, Harvest, Wages, General)
                        - "type": string (must be exactly "income" or "expense")
                        - "input_amount": number (the literal raw number found)
                        - "input_currency": string (uppercase currency token like USD, ZIG, ZAR. Default to "USD" if undefined)
                        
                        Return ONLY the raw valid JSON block. Do not include markdown code block syntax elements or backticks.`
                    },
                    {
                        role: 'user',
                        content: entry.raw_text
                    }
                ],
                temperature: 0.1,
                // Force Groq to guarantee a clean programmatic structure output
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errTrace = await response.text();
            console.error(`🚨 Groq API Pipeline Error [Status ${response.status}]:`, errTrace);
            throw new Error(`Groq gateway connection failure status flag: ${response.status}`);
        }

        const dataPayload = await response.json();
        const generatedRawPayload = dataPayload.choices?.[0]?.message?.content?.trim();

        console.log(`🤖 Raw Groq Payload Received for ID [${activeEntryId}]:`, generatedRawPayload);

        const parsedData = JSON.parse(generatedRawPayload);

        // 3. Compute currency exchange running numbers
        const currencyToken = parsedData.input_currency?.toUpperCase() || 'USD';
        const rawValue = Number(parsedData.input_amount) || 0;
        const conversionRate = CURRENCY_EXCHANGE_MAP[currencyToken] || 1.0;
        const normalizedUsdAmount = rawValue * conversionRate;

        // 4. Update row records inside your public PostgreSQL table
        const { error: updateError } = await supabaseAdmin
            .from('ledger_entries')
            .update({
                item: parsedData.item || 'Unclassified entry item',
                category: parsedData.category || 'General',
                type: parsedData.type?.toLowerCase() === 'income' ? 'income' : 'expense',
                amount: normalizedUsdAmount,
                ai_status: 'done'
            })
            .eq('id', activeEntryId);

        if (updateError) throw updateError;

        console.log(`✅ Groq Engine Pipeline Completed Successfully for Row ID: [${activeEntryId}]`);
        return NextResponse.json({ success: true, message: 'Operational balances updated successfully.' });

    } catch (err) {
        console.error("🚨 Server API Route Thread Exception Panic:", err.message);

        if (activeEntryId) {
            await supabaseAdmin
                .from('ledger_entries')
                .update({ ai_status: 'error' })
                .eq('id', activeEntryId);
        }

        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}