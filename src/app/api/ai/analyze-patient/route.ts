import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { loadAiConfig } from '@/lib/ai/config';
import { generateReply } from '@/lib/ai/generate';

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => ({}));
    const { conversationId, contactId } = body;

    if (!conversationId && !contactId) {
      return NextResponse.json(
        { error: 'Either conversationId or contactId is required' },
        { status: 400 }
      );
    }

    let contact: any = null;
    let resolvedConvId = conversationId;

    if (contactId) {
      const { data: c } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('account_id', accountId)
        .maybeSingle();
      contact = c;

      if (!resolvedConvId && contact) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        resolvedConvId = conv?.id;
      }
    } else if (resolvedConvId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('*, contact:contacts(*)')
        .eq('id', resolvedConvId)
        .eq('account_id', accountId)
        .maybeSingle();
      if (conv?.contact) {
        contact = conv.contact;
      }
    }

    if (!contact) {
      return NextResponse.json(
        { error: 'Patient contact record not found' },
        { status: 404 }
      );
    }

    // Fetch messages
    let messages: any[] = [];
    if (resolvedConvId) {
      const { data: mData } = await supabase
        .from('messages')
        .select('content_text, sender_type, created_at')
        .eq('conversation_id', resolvedConvId)
        .order('created_at', { ascending: true })
        .limit(40);
      messages = mData || [];
    }

    // Fetch booking if any
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch notes if any
    const { data: notes } = await supabase
      .from('contact_notes')
      .select('note_text, created_at')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch tags for this account
    const { data: tags } = await supabase
      .from('tags')
      .select('name')
      .eq('account_id', accountId);

    const availableTagNames = (tags || []).map((t) => t.name).join(', ');

    const config = await loadAiConfig(supabase, accountId);
    if (!config) {
      return NextResponse.json(
        { error: 'AI Assistant not configured. Please enable in Settings.' },
        { status: 400 }
      );
    }

    const conversationText = messages
      .map((m) => `${m.sender_type === 'contact' ? 'Patient' : 'Gynocci Team'}: ${m.content_text}`)
      .join('\n');

    const systemPrompt = `You are a clinical patient-care and high-conversion telecalling expert for Gynocci (Gynocci Femtech Ltd.) — specializing in natural Ayurvedic treatment for PCOD/PCOS, Tubal Blockage, Infertility, Low AMH, Male Low Sperm Count, and Periods problems.
Provide an actionable, structured call pitch report in JSON format to help our telecalling team call this patient right now and convert them for an Ayurvedic doctor consultation. Output ONLY valid JSON, no markdown backticks.`;

    const userPrompt = `PATIENT INFORMATION:
- Name: ${contact.name || 'Unknown'}
- Phone: ${contact.phone}
- City: ${contact.city || booking?.city || 'Not provided'}
- Ad Campaign: ${contact.ad_name || 'Direct / Organic'}
- Existing Booking: ${booking ? `${booking.booking_query_id} (Status: ${booking.status}, Concern: ${booking.health_concern || 'N/A'})` : 'No booking confirmed'}
- Existing Notes: ${(notes || []).map((n) => n.note_text).join('; ') || 'None'}

RECENT WHATSAPP CHAT:
${conversationText || 'No previous messages logged in chat.'}

AVAILABLE CRM TAGS:
${availableTagNames || 'None'}

JSON SCHEMA REQUIRED:
{
  "patient_summary": {
    "concern": "Summary of health concern / problem (e.g. 3 years PCOD, conceiving issues)",
    "city": "Patient city / clinic city vs online video consultation",
    "mindset": "Patient mindset / emotional state / anxiety"
  },
  "dropout_reason": "Specific reason why the patient hasn't booked yet or stopped chatting",
  "key_objection": "Main objection or fear (e.g. fees before consultation, doubts about online treatment)",
  "telecalling_script": {
    "opening": "Warm opening in polite Hindi (Sir/Ma'am) referencing their exact concern",
    "empathy_and_reassurance": "Reassurance explaining how Gynocci treats root-cause naturally without surgery/side-effects",
    "objection_handling": "Exact spoken Hindi words to resolve their specific doubt",
    "closing_offer": "Closing pitch explaining the ₹499 lifetime free consultation offer"
  },
  "key_benefits_to_pitch": [
    "Benefit 1",
    "Benefit 2",
    "Benefit 3"
  ],
  "recommended_tag": "Best tag to assign after call"
}`;

    const genResult = await generateReply({
      config,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let analysis: any = null;
    try {
      const cleanJson = genResult.text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      analysis = JSON.parse(cleanJson);
    } catch {
      analysis = {
        patient_summary: {
          concern: contact.ad_name || 'Ayurvedic Reproductive Consultation',
          city: contact.city || 'Not specified',
          mindset: 'Interested lead awaiting personal consultation guidance',
        },
        dropout_reason: 'Awaiting telecaller follow-up on fees and consultation process',
        key_objection: 'Needs clarification on consultation process and fees',
        telecalling_script: {
          opening: `नमस्ते ${contact.name ? contact.name + ' जी' : ''}! मैं Gynocci Femtech से बात कर रही हूँ। आपने व्हाट्सएप पर परामर्श के लिए संपर्क किया था।`,
          empathy_and_reassurance: 'हम समझते हैं कि इस समस्या से आप काफी परेशान हैं, लेकिन आयुर्वेद में इसका 100% प्राकृतिक और जड़ से इलाज संभव है।',
          objection_handling: 'हमारी डॉक्टर के साथ कंसल्टेशन बिल्कुल फ्री है! हमारे यहाँ आप सिर्फ ₹499 में वन-टाइम रजिस्ट्रेशन करवाकर लाइफटाइम फ्री कंसल्टेशन ऑफर का फायदा उठा सकते हैं, जब तक आपका इलाज हमारे साथ चलता रहेगा।',
          closing_offer: 'क्या मैं आज हमारे सीनियर डॉक्टर के साथ आपका कंसल्टेशन शेड्यूल कर दूँ?',
        },
        key_benefits_to_pitch: [
          '100% प्राकृतिक आयुर्वेदिक उपचार (बिना सर्जरी/हार्मोनल साइड-इफेक्ट्स)',
          '45 मिनट का व्यक्तिगत सत्र सीनियर डॉक्टर के साथ',
          '₹499 में लाइफटाइम फ्री फॉलो-अप कंसल्टेशन',
        ],
        recommended_tag: 'Booking Pending Hot Lead',
      };
    }

    return NextResponse.json({
      ok: true,
      patient: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        city: contact.city || booking?.city || '',
        ad_name: contact.ad_name,
        conversationId: resolvedConvId,
      },
      analysis,
    });
  } catch (err: any) {
    console.error('[ai/analyze-patient] error:', err);
    return toErrorResponse(err);
  }
}
