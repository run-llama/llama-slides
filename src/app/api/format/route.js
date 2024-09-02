import { NextResponse } from 'next/server';
import { Anthropic } from 'llamaindex';
import { generateSlidePrompt } from '../../../utils/prompts';

export async function POST(request) {
  try {
    const { content, formattingInstructions } = await request.json();

    // Perform manipulation on the content here
    const formattedContent = await manipulateContent(content,formattingInstructions);

    return NextResponse.json({ formattedContent });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error processing the request' }, { status: 500 });
  }
}

async function manipulateContent(content,formattingInstructions) {
  const llm = new Anthropic({
    model: 'claude-3-5-sonnet',
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  console.log("Generating formatted slide from ", content)
  console.log("with additional instructions: ", formattingInstructions)

  let prompt = generateSlidePrompt(content,`<recommendations>${formattingInstructions}</recommendations>`)

  const response = await llm.complete({prompt: prompt});

  return response.text;
}
