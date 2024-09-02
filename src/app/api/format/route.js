import { NextResponse } from 'next/server';
import { Anthropic } from 'llamaindex';

export async function POST(request) {
  try {
    const { content, formattingInstructions, apiKey } = await request.json();

    // Perform manipulation on the content here
    const formattedContent = await manipulateContent(apiKey, content,formattingInstructions);

    return NextResponse.json({ formattedContent });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error processing the request' }, { status: 500 });
  }
}

async function manipulateContent(apiKey,content,formattingInstructions) {
  const llm = new Anthropic({
    model: 'claude-3-5-sonnet',
    apiKey: apiKey,
  });

  console.log("Generating formatted slide from ", content)
  console.log("with additional instructions: ", formattingInstructions)

  let prompt = `
  You will be given raw text inside of <rawtext> tags. These are the speaking notes for a slide in a presentation. Your job is to extract important points from these notes and format them into markdown that can be used in a slide. You should prefer brief bullet points, or if there is only one key point, you can just write it as a sentence.

  The first line of each slide is preceded by a "-" and represents the title of the slide. You do not need to include this title in your response.

  Any lines that begin with ">" will be included automatically so you don't need to include them or repeat the content in them.

  You do not need to generate heading tags (no # or ##), but you can use bold text for emphasis.

  Things that look like code should be formatted with backticks.

  Things that look like links should be made into markdown links.

  You should respond with only the formatted content, no preamble or explanations are necessary.

  If there are <recommendations> tags below the rawtext, pay attention to what they suggest.

  If you don't want to render anything beyond what will get automatically included, respond with just the string "NO_EXTRA_CONTENT".

  <rawtext>
  ${content}
  </rawtext>
  
  `;  

  if (formattingInstructions) {
    prompt += `<recommendations>${formattingInstructions}</recommendations>`
  }

  const response = await llm.complete({prompt: prompt});

  console.log("Formatted content: ", response.text)

  return response.text;
}
