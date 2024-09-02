"use client";

import { useState, useCallback, useRef } from "react";
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  const hashContent = (content: string): string => {
    return crypto.createHash('md5').update(content).digest('hex');
  };

  const downloadPptx = async () => {
    if (!ppt) {
      dialogRef.current?.showModal();
      return;
    }
    let pptx = await renderPptx(ppt,{ outputType: "blob" })
    const a = document.createElement("a");
    const url = URL.createObjectURL(pptx as Blob | MediaSource);
    a.href = url;
    a.download = "presentation.pptx";
    a.click();
  }

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
    setPpt(<Presentation>
      <Slide>
        <Text style={{
            x: "10%", y: "20%", w: "80%", h: "40%",
            fontSize: 80,
        }}>Generating...</Text>
      </Slide>
    </Presentation>); // waiting state
    
    let slides = rawText.split("\n\n");

    let pptSlides = await Promise.all(slides.map(async (slide, index) => {
      /* the whole slide is 10 inches wide by 5.6 inches high */
      let firstline = slide.split("\n")[0];

      // first slide is a title slide
      if (index === 0) {
        return <Slide>
          <Text style={{
            x: 1, y: 2, w: 8, h: 1,
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

      // first line is big
      let pptContent = [
        <Text style={{
          x: 1, y: 0.7, w: 8, h: 1,
          fontSize: 40,
        }}>{firstline}</Text>
      ]

      // subsequent lines are mostly bullet points
      pptContent.push(formattedContent.split("\n").map((line: string, index: number) => {
        console.log("Line: ", line)
        if (line.startsWith("- ")) {
          return <Text style={{
            x: 1, y: 1.4 + (0.7*index), w: 8, h: 1,
            fontSize: 20,
          }}><Text.Bullet>{line.slice(2)}</Text.Bullet></Text>
        } else {
          return <Text style={{
            x: 1, y: 1.4 + (0.7*index), w: 8, h: 1,
            fontSize: 20,
          }}>{line}</Text>  
        }
      }))
      let pptSlide = <Slide>{pptContent}</Slide>
      return pptSlide
    }));

    let presentation = <Presentation>{pptSlides}</Presentation>
    setPpt(presentation)
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
          <button onClick={downloadPptx}>Download PPTX</button>
        </div>
        <div id="slides">
          {ppt ? <Preview slideStyle={{
            border: "1px solid black",
            marginBottom: "15px",
            boxShadow: "0px 0px 10px 0px rgba(0, 0, 0, 0.25)"
          }}>
            {ppt}
          </Preview> : <div>No slides to display</div>}
        </div>
      </div>
      <dialog ref={dialogRef}>
        <p>No slides to download</p>
        <form method="dialog">
          <button>Close</button>
        </form>
      </dialog>
    </main>
  );
}
