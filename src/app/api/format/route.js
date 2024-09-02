import { NextResponse } from 'next/server';
import { Anthropic } from 'llamaindex';

export async function POST(request) {
  try {
    const { content } = await request.json();

    // Perform manipulation on the content here
    const formattedContent = await manipulateContent(content);

    return NextResponse.json({ formattedContent });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error processing the request' }, { status: 500 });
  }
}

async function manipulateContent(content) {
  const llm = new Anthropic({
    model: 'claude-3-5-sonnet',
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = `You will be given raw text inside of <rawtext> tags. These are the speaking notes for a slide in a presentation. Your job is to extract important points from these notes and format them into markdown that can be used in a slide. You should prefer brief bullet points, or if there is only one key point, you can just write it as a sentence.

  The first line of each slide is preceded by a "-" and represents the title of the slide. You do not need to include this title in your response.

  You do not need to generate heading tags (no # or ##), but you can use bold text for emphasis.

  Things that look like code should be formatted with backticks.

  Things that look like links should be made into markdown links.

  You should respond with only the formatted content, no preamble or explanations are necessary.

<rawtext>
${content}
</rawtext>`;

  const response = await llm.complete({prompt: prompt});

  return response.text;
}