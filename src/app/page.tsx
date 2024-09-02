"use client";

import { useState, useCallback, useRef } from "react";
import crypto from 'crypto';
import {
  Presentation, Slide, Text,
  Shape, Image, render as renderPptx
} from "react-pptx"
import Preview from "react-pptx/preview";
import pptxgen from "pptxgenjs";

export default function Home() {
  const [rawText, setRawText] = useState("");
  const [intermediate, setIntermediate] = useState();
  const [presentationPreviews, setPresentationPreviews] = useState<JSX.Element[] | null>(null);
  const [formatCache] = useState(new Map());
  const dialogRef = useRef<HTMLDialogElement>(null);

  const hashContent = (content: string): string => {
    return crypto.createHash('md5').update(content).digest('hex');
  };

  const convertToPptx = async (intermediate) => {
    let pres = new pptxgen();
    for (let child of intermediate.children) {
      let slide = pres.addSlide()
      let content = child.children
      for (let el of content) {
        switch(el.type) {
          case "text.bullet":
            slide.addText(
              el.children[0].content, 
              {
                ...el.style,
                bullet: true
              }
            )
            break;
          case "text":
            slide.addText(
              el.children[0].content,
              el.style
            )  
        }
      }
    }
    return pres
  }

  const generatePptx = async () => {
    if (!intermediate) {
      dialogRef.current?.showModal();
      return;
    }
    let pres = await convertToPptx(intermediate)
    let presBlob = await pres.write("blob")

    const a = document.createElement("a");
    const url = URL.createObjectURL(presBlob as Blob | MediaSource);
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

  const generateIntermediateRepresentation = async () => {

    let rawTextSlides = rawText.split("\n\n");

    let slides = await Promise.all(rawTextSlides.map(async (slideText, index) => {
      /* the whole slide is 10 inches wide by 5.6 inches high */
      let firstline = slideText.split("\n")[0];

      // first slide is a title slide
      if (index === 0) {
        return {
          type: "slide",
          children: [
            {
              type: "text",
              style: {
                x: 1,
                y: 2,
                w: 8,
                h: 1,
                fontSize: 80
              },
              children: [
                {
                  type: "string",
                  content: firstline
                }
              ]
            }
          ]
        }
      }

      // all other slides follow the same format
      if (firstline.startsWith("- ")) {
        firstline = firstline.slice(2);
      }
      let formattedContent = await formatWithCache(slideText);
      console.log("Formatted content: ", formattedContent)

      let slide = {
        type: "slide",
        children: [] as Record<string, any>[],
        speakerNotes: slideText
      }

      // first line is big
      slide.children.push({
        type: "text",
        style: {
          x: 1,
          y: 0.7,
          w: 8,
          h: 1,
          fontSize: 40
        },
        children: [
          {
            type: "string",
            content: firstline
          }
        ]
      })

      // subsequent lines are mostly bullet points
      slide.children = slide.children.concat(formattedContent.split("\n").map((line: string, index: number) => {
        console.log("Line: ", line)
        if (line.startsWith("- ")) {
          return {
            type: "text.bullet",
            style: {
              x: 1,
              y: 1.4 + (0.7 * index),
              w: 8,
              h: 1,
              fontSize: 20
            },
            children: [
              {
                type: "string",
                content: line.slice(2)
              }
            ]
          }
        } else {
          return {
            type: "text",
            style: {
              x: 1,
              y: 1.4 + (0.7 * index),
              w: 8,
              h: 1,
              fontSize: 20
            },
            children: [
              {
                type: "string",
                content: line.slice(2)
              }
            ]
          }
        }
      }))
      return slide
    }));

    let presentation = {
      type: "presentation",
      children: slides
    }

    return presentation
  }

  const convertPreviewChildren = (children) => {
    return children.map((child) => {
      switch (child.type) {
        // in the previews, each slide is in its own presentation
        case "slide":
          return <Presentation><Slide>{convertPreviewChildren(child.children)}</Slide></Presentation>
        case "text":
          return <Text style={child.style}>{convertPreviewChildren(child.children)}</Text>
        case "text.bullet":
          return <Text style={child.style}><Text.Bullet>{convertPreviewChildren(child.children)}</Text.Bullet></Text>
        case "string":
          return child.content
      }
    })
  }

  const convertToPreviews = async (tree) => {
    return convertPreviewChildren(tree.children)
  }

  const generatePreviews = async () => {
    let waitPresentations: JSX.Element[] = [
      <Presentation key="waiting">
        <Slide>
          <Text style={{
            x: "10%", y: "20%", w: "80%", h: "40%",
            fontSize: 80,
          }}>Generating...</Text>
        </Slide>
      </Presentation>
    ];
    setPresentationPreviews(waitPresentations); // waiting state

    // get intermediate state
    let intermediate = await generateIntermediateRepresentation()
    setIntermediate(intermediate)
    console.log("Intermediate form ", intermediate)
    // convert it into an array of single-slide presentations plus notes etc.
    let presentationPreviews = await convertToPreviews(intermediate)
    console.log("Presentation previews", presentationPreviews)

    setPresentationPreviews(presentationPreviews)
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
          <button onClick={generatePreviews}>Slidify ➡️</button>
          <button onClick={generatePptx}>Download PPTX</button>
        </div>
        <div id="slides">
          {presentationPreviews ? (<div>
            {presentationPreviews.map((ppt: JSX.Element) => {
              return <div>
                <Preview slideStyle={{
                  border: "1px solid black",
                  marginBottom: "15px",
                  boxShadow: "0px 0px 10px 0px rgba(0, 0, 0, 0.25)"
                }}>
                  {ppt}
                </Preview>
                <div style={{ marginBottom: "10px" }}>
                  Notes etc.
                </div>
              </div>
            })}
          </div>) : (<div>No slides to display</div>)}
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
