"use client";

import { useState, useCallback, useRef } from "react";
import crypto from 'crypto';
import {
  Presentation, Slide, Text,
  Shape, Image, render as renderPptx
} from "react-pptx"
import Preview from "react-pptx/preview";
import pptxgen from "pptxgenjs";
import html2canvas from "html2canvas";

export default function Home() {
  const [rawText, setRawText] = useState("");
  const [rawTextSlides, setRawTextSlides] = useState<string[]>([]);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [intermediate, setIntermediate] = useState<IntermediateType | undefined>(undefined);
  const [presentationPreviews, setPresentationPreviews] = useState<JSX.Element[] | null>(null);
  const [formatCache] = useState(new Map());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);

  const hashContent = (content: string): string => {
    return crypto.createHash('md5').update(content).digest('hex');
  };

  // converts the intermediate representation to pptx
  const convertToPptx = async (intermediate: { children: any[] }) => {
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
      slide.addNotes(child.speakerNotes)
    }
    return pres
  }

  // this creates the actual file you download
  const generatePptx = async () => {
    if (!intermediate) {
      dialogRef.current?.showModal();
      return;
    }
    let pres = await convertToPptx(intermediate)
    let presBlob = await pres.write({outputType: "blob"})

    const a = document.createElement("a");
    const url = URL.createObjectURL(presBlob as Blob | MediaSource);
    a.href = url;
    a.download = "presentation.pptx";
    a.click();
  }

  const formatWithCache = useCallback(async (content: string, index: number) => {

    let formattingInstructions = null
    if (instructions[index]) {
      formattingInstructions = instructions[index]
    }

    const contentHash = hashContent(content+formattingInstructions);

    if (formatCache.has(contentHash)) {
      return formatCache.get(contentHash);
    }

    const response = await fetch("/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, formattingInstructions }),
    });

    if (!response.ok) {
      throw new Error('Failed to format content');
    }

    const formattedContent = (await response.json()).formattedContent;
    formatCache.set(contentHash, formattedContent);

    return formattedContent;
  }, [formatCache]);

  const generateIntermediateRepresentation = async (overrideRawTextSlides: string[] | null = null) => {

    let sourceTextSlides = rawTextSlides
    if (overrideRawTextSlides) {
      sourceTextSlides = overrideRawTextSlides
    }

    let slides = await Promise.all(sourceTextSlides.map(async (slideText, index) => {
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
      let formattedContent = await formatWithCache(slideText,index);
      console.log(`Formatted content: for slide ${index}:`, formattedContent)

      let slide: Slide = {
        type: "slide",
        children: [] as Record<string, any>[]
      }

      // first line is big
      if (firstline.startsWith("- ") || firstline.startsWith("# ")) {
        firstline = firstline.slice(2);
      }
      let yPosition = 0
      slide.children.push({
        type: "text",
        style: {
          x: 1,
          y: yPosition += 0.7,
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

      // lines with > are meant to be included verbatim
      let verbatim = slideText.split("\n").filter( (line) => line.startsWith("> "))
      if (verbatim.length > 0) yPosition += 0.5
      for (let line of verbatim) {
        slide.children.push({
          type: "text",
          style: {
            x: 1,
            y: yPosition += 0.5,
            w: 8,
            h: 1,
            fontSize: 25
          },
          children: [
            {
              type: "string",
              content: line.slice(2)
            }
          ]
        })  
      }

      let speakerNotes = slideText.split("\n").filter( (line, index) => {
        if (index == 0) return
        if (line.startsWith("> ")) return
        return line
      })
      slide.speakerNotes = speakerNotes

      if (formattedContent != "NO_EXTRA_CONTENT") {
        // subsequent lines are mostly bullet points
        slide.children = slide.children.concat(formattedContent.split("\n").map((line: string, index: number) => {
          //console.log("Line: ", line)
          if (line.startsWith("- ")) {
            return {
              type: "text.bullet",
              style: {
                x: 1,
                y: yPosition += 0.5,
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
                y: yPosition += 0.5,
                w: 8,
                h: 1,
                fontSize: 20
              },
              children: [
                {
                  type: "string",
                  content: line
                }
              ]
            }
          }
        }))
      }
      return slide
    }));

    let presentation = {
      type: "presentation",
      children: slides
    }

    return presentation
  }

  const convertPreviewChildren = (children: any[]) => {
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

  const convertToPreviews = async (tree: { children: any[] }) => {
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

    // FIXME: if the raw text has changed we should re-generate the raw slides
    let sourceTextSlides = rawTextSlides
    if (sourceTextSlides.length === 0) {
      sourceTextSlides = rawText.split("\n\n");
      console.log("Got raw text slides",sourceTextSlides)
      setRawTextSlides(sourceTextSlides)
    }

    // get intermediate state
    let newIntermediate = await generateIntermediateRepresentation(sourceTextSlides)
    setIntermediate(newIntermediate)
    console.log("Intermediate form ", newIntermediate)
    // convert it into an array of single-slide presentations plus notes etc.
    let presentationPreviews = await convertToPreviews(newIntermediate)
    console.log("Presentation previews", presentationPreviews)

    setPresentationPreviews(presentationPreviews)
  };

  const cleanUpSlide = async (slideIndex: number) => {
    if (!intermediate) return;

    let canvas = await html2canvas(document.querySelector(`[data-slide-number="${slideIndex}"]`) as HTMLElement)

    // Convert canvas to PNG
    const pngDataUrl = canvas.toDataURL('image/png');
    
    // Create a Blob from the data URL
    const blobBin = atob(pngDataUrl.split(',')[1]);
    const array = [];
    for (let i = 0; i < blobBin.length; i++) {
      array.push(blobBin.charCodeAt(i));
    }
    const pngBlob = new Blob([new Uint8Array(array)], {type: 'image/png'});

    // Create a File object from the Blob
    const pngFile = new File([pngBlob], `slide_${slideIndex}.png`, { type: 'image/png' });

    const formData = new FormData();
    formData.append('screenshot', pngFile);
    formData.append('slideIndex', slideIndex.toString());
    formData.append('rawText', rawTextSlides[slideIndex])

    const response = await fetch("/api/cleanup", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      console.error('Failed to clean up slide');
      return;
    }

    const recommendations = (await response.json()).recommendations;

    console.log("Cleanup recommendations are ", recommendations)

    // set the recommendation
    let newInstructions = instructions
    newInstructions[slideIndex] = recommendations
    setInstructions(newInstructions)

    // Regenerate previews
    let newIntermediate = await generateIntermediateRepresentation()
    setIntermediate(newIntermediate)
    const updatedPreviews = await convertToPreviews( newIntermediate );
    setPresentationPreviews(updatedPreviews);
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
            {presentationPreviews.map((ppt: JSX.Element, index) => {
              return <div key={index} style={{ position: 'relative' }}>
                <div className="previewOnly" data-slide-number={index}>
                  <Preview slideStyle={{
                    border: "1px solid black",
                    marginBottom: "45px",
                    boxShadow: "0px 0px 10px 0px rgba(0, 0, 0, 0.25)"
                  }}>
                    {ppt}
                  </Preview>
                </div>
                <div style={{ 
                  position: 'absolute', 
                  bottom: '-42px', 
                  left: '0', 
                  right: '0', 
                  padding: '10px', 
                  zIndex: 10 
                }}>
                  {activeNoteIndex === index && (
                    <div className="speakerNotesPopup">
                      {intermediate?.children[index].speakerNotes}
                    </div>
                  )}
                  <button onClick={() => setActiveNoteIndex(activeNoteIndex === index ? null : index)}>
                    {activeNoteIndex === index ? "Hide Notes" : "Show Notes"}
                  </button>
                  <button 
                    onClick={(e) => {
                      const button = e.target as HTMLButtonElement;
                      button.disabled = true;
                      button.textContent = "Cleaning up...";
                      cleanUpSlide(index).finally(() => {
                        button.disabled = false;
                        button.textContent = "Clean up";
                      });
                    }}
                    disabled={false}
                  >
                    Clean up
                  </button>
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

interface IntermediateType {
  type: string;
  children: any[];
}

interface Slide {
  type: string;
  children: Record<string, any>[];
  speakerNotes?: string[];
}
