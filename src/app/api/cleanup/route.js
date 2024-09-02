import { NextResponse } from 'next/server';
import { Anthropic } from 'llamaindex';
import { Anthropic as AnthropicApi } from '@anthropic-ai/sdk';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const screenshot = formData.get('screenshot');
    const slideIndex = formData.get('slideIndex');
    const rawText = formData.get('rawText');
    const apiKey = formData.get('apiKey')

    // Perform manipulation on the content here
    const recommendations = await manipulateContent(apiKey, screenshot, slideIndex, rawText);

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error processing the request' }, { status: 500 });
  }
}

// Function to analyze the screenshot
async function analyzeScreenshot(apiKey,screenshot,rawText) {

  // Initialize the Anthropic API client
  const anthropicApi = new AnthropicApi({
    apiKey: apiKey,
  });

  // Convert the screenshot to base64
  const buffer = await screenshot.arrayBuffer();
  const base64Image = Buffer.from(buffer).toString('base64');

  // Prepare the message for Claude
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: base64Image,
          },
        },
        {
          type: 'text',
          text: `This is a screenshot of a presentation slide generated from the raw text in <rawtext> tags below. Please analyze the image and suggest improvements to make the slide cleaner, in particular to prevent text overflowing along the bottom. Make sure to say what text is clearly visible on the slide so that a later cleanup operation can include only that text.
          
          Keep in mind a few things:
          1. The first line of rawtext is going to be included no matter what.
          2. Any lines beginning with ">" will be included no matter what.
          So if there's no room for additional content after that, recommend that no content be generated.
          
          <rawtext>
          ${rawText}
          </rawtext>`,
        },
      ],
    },
  ];

  // Send the request to Claude
  const response = await anthropicApi.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 1000,
    messages: messages,
  });

  let recommendations = response.content[0].text;

  console.log("Recommendations are", recommendations)

  return recommendations
}


async function manipulateContent(apiKey,screenshot, slideIndex, rawText) {

  // get recommendations about what to do with the screenshot
  let recommendations = analyzeScreenshot(apiKey,screenshot,rawText)
  return recommendations;
}
