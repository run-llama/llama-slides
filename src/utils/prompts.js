const generateSlidePrompt = (content, customInstructions = '') => `
You will be given raw text inside of <rawtext> tags. These are the speaking notes for a slide in a presentation. Your job is to extract important points from these notes and format them into markdown that can be used in a slide. You should prefer brief bullet points, or if there is only one key point, you can just write it as a sentence.

The first line of each slide is preceded by a "-" and represents the title of the slide. You do not need to include this title in your response.

Any lines that begin with ">" will be included automatically so you don't need to include them or repeat the content in them.

You do not need to generate heading tags (no # or ##), but you can use bold text for emphasis.

Things that look like code should be formatted with backticks.

Things that look like links should be made into markdown links.

You should respond with only the formatted content, no preamble or explanations are necessary.

It's possible that because of what will get automatically rendered you shouldn't add anything, in which case you should respond with just the string "NO_EXTRA_CONTENT", especially if there are recommendations in <recommendations> tags below the rawtext that suggest you not add anything.

<rawtext>
${content}
</rawtext>

${customInstructions}
`;

export { generateSlidePrompt };
