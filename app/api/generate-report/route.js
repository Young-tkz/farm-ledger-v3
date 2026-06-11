import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        // 1. Intercept the incoming compilation parameters from the UI frame
        const { period, entriesSummary, totalIncome, totalExpense } = await req.json();

        const netProfit = totalIncome - totalExpense;
        const groqApiKey = process.env.GROQ_API_KEY;
        const targetEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

        // 2. Draft the strategic engineering prompt for Llama 3.3
        const systemsDirective = `
            You are an expert Virtual CFO and veteran agricultural credit analyst. 
            Analyze the following farm financial ledger summary for the past ${period}:
            
            OPERATIONAL LOG TRACE SUMMARY:
            ${entriesSummary || 'No active transaction line records registered.'}
            
            AGGREGATED METRICS ACCUMULATION:
            - Gross Cash Inflows: $${Number(totalIncome).toFixed(2)} USD
            - Total Operating Outflows: $${Number(totalExpense).toFixed(2)} USD
            - Net Cash Position: $${Number(netProfit).toFixed(2)} USD

            Generate a concise, institutional-grade executive analysis summarizing farm productivity and capital allocation efficiency. 
            Highlight the primary cash drivers (like harvest returns) and isolate any heavy cost overruns (like fertilizer, fuel, or wages). 
            Provide clear, strategic operational guidance.
            
            Formatting Rules: Return plain text paragraphs separated by clear line breaks (\\n). Do NOT use markdown bold, lists, headers, or bullet points. Keep it professional, objective, and dense.
        `;

        // 3. Connect to Groq for sub-second generation
        const response = await fetch(targetEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqApiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'user', content: systemsDirective }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errTrace = await response.text();
            console.error(`🚨 Groq Report Engine Pipeline Error [Status ${response.status}]:`, errTrace);
            throw new Error(`Groq report generation gateway connection failure.`);
        }

        const dataPayload = await response.json();
        const generatedAnalysisText = dataPayload.choices?.[0]?.message?.content?.trim();

        console.log("✅ Strategic Financial Analysis Generated Successfully via Groq.");

        // 4. Return the calculated data along with the AI text block back to your UI view
        return NextResponse.json({
            success: true,
            analysis: generatedAnalysisText
        }, { status: 200 });

    } catch (err) {
        console.error("🚨 V-CFO Synthesis Endpoint Panic Error:", err.message);
        return NextResponse.json({
            success: false,
            error: "Failed to compile strategic performance analysis framework.",
            details: err.message
        }, { status: 500 });
    }
}