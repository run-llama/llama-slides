"use client";

import { useState, useCallback } from "react";
import crypto from 'crypto';

import {
  Presentation, Slide, Text,
  Shape, Image, render as renderPptx
} from "react-pptx"
import Preview from "react-pptx/preview";

export default function Home() {
  const [rawText, setRawText] = useState("");
  const [ppt, setPpt] = useState<JSX.Element | null>(null);
  const [formatCache] = useState(new Map());

  const hashContent = (content: string): string => {
    return crypto.createHash('md5').update(content).digest('hex');
  };

  const formatWithCache = useCallback(async (content: string) => {
    const contentHash = hashContent(content);

    if (formatCache.has(contentHash)) {
      return formatCache.get(contentHash);
    }

    const response = await fetch("/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error('Failed to format content');
    }

    const formattedContent = (await response.json()).formattedContent;
    formatCache.set(contentHash, formattedContent);

    return formattedContent;
  }, [formatCache]);

  const handleConvert = async () => {
    setPpt(null); // waiting state
    console.log("converting...")
    let slides = rawText.split("\n\n");

    let pptSlides = await Promise.all(slides.map(async (slide, index) => {
      let firstline = slide.split("\n")[0];

      // first slide is a title slide
      if (index === 0) {
        return <Slide>
          <Text style={{
            x: "10%", y: "20%", w: "80%", h: "40%",
            fontSize: 80,
          }}>{firstline}</Text>
        </Slide>
      }

      // all other slides follow the same format
      if (firstline.startsWith("- ")) {
        firstline = firstline.slice(2);
      }
      let formattedContent = await formatWithCache(slide);
      console.log("Formatted content: ", formattedContent)
      let pptContent = [
        <Text style={{
          x: "10%", y: "10%", w: "80%", h: "80%",
          fontSize: 40,
        }}>{firstline}</Text>
      ]
      console.log("Here")
      pptContent.push(formattedContent.split("\n").map((line: string, index: number) => {
        console.log("Line: ", line)
        if (line.startsWith("- ")) {
          return <Text style={{
            x: "10%", y: `${25 + (10*index)}%`, w: "80%", h: "65%",
            fontSize: 20,
          }}><Text.Bullet>{line.slice(2)}</Text.Bullet></Text>
        } else {
          return <Text style={{
            x: "10%", y: `${25 + (10*index)}%`, w: "80%", h: "65%",
            fontSize: 20,
          }}>{line}</Text>  
        }
      }))
      let pptSlide = <Slide>{pptContent}</Slide>
      return pptSlide
    }));

    let presentation = <Presentation>{pptSlides}</Presentation>
    setPpt(presentation)
    console.log(presentation)
  };

  return (
    <main>
      <div id="three-column">
        <div id="source">
          <textarea
            id="rawTextArea"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          ></textarea>
        </div>
        <div id="convertButton">
          <button onClick={handleConvert}>Slidify ➡️</button>
        </div>
        <div id="slides">
          <Preview slideStyle={{
            border: "1px solid black",
            marginBottom: "15px",
            boxShadow: "0px 0px 10px 0px rgba(0, 0, 0, 0.25)"
          }}>
            {ppt || <div>No slides to display</div>}
          </Preview>
        </div>
      </div>
    </main>
  );
}
