import { friendlyError, getGenAI, modelFor, stripFences, withRetry } from "@/lib/server/gemini";
import { DESIGN_SKILL } from "@/lib/server/design-skill";
import type { ModelTier, Theme } from "@/lib/types";

export const maxDuration = 120;

interface EditRequest {
  mode: "rewrite" | "edit";
  instruction: string;
  elementHtml: string;
  selectedText?: string;
  slideText: string;
  theme: Theme;
  tier?: ModelTier;
}

/**
 * Fast, element-scoped edits:
 *  - rewrite: returns new innerHTML for the element (copy changes only)
 *  - edit:    returns a new outerHTML for the element (copy and/or styling)
 */
export async function POST(request: Request) {
  const body = (await request.json()) as EditRequest;

  const prompt =
    body.mode === "rewrite"
      ? [
          `Rewrite text on a presentation slide.`,
          `Slide context (all text on the slide): ${body.slideText.slice(0, 1500)}`,
          `Element innerHTML:\n${body.elementHtml}`,
          body.selectedText
            ? `Only rewrite this highlighted part: "${body.selectedText}". Keep the rest of the element exactly as is.`
            : `Rewrite the whole text of the element.`,
          `Instruction: ${body.instruction || "Improve it: clearer, sharper, more compelling."}`,
          `Keep roughly the same length unless asked otherwise (it must still fit the layout), keep inline tags/styling,`,
          `and keep the language unless asked to translate. Return ONLY the new innerHTML, nothing else.`,
        ].join("\n\n")
      : [
          `${DESIGN_SKILL}\n\nYou are editing ONE element of an existing slide.`,
          `Theme tokens: ${JSON.stringify(body.theme.colors)} fonts ${body.theme.headingFont}/${body.theme.bodyFont}.`,
          `Slide context (all text on the slide): ${body.slideText.slice(0, 1500)}`,
          `Element outerHTML:\n${body.elementHtml}`,
          `Instruction: ${body.instruction}`,
          `Return ONLY the updated outerHTML of this element. Keep its tag and data-eid attribute. Prefer theme CSS variables.`,
        ].join("\n\n");

  try {
    const res = await withRetry(async () =>
      (await getGenAI()).models.generateContent({
        model: modelFor(body.tier === "pro" && body.mode === "edit" ? "pro" : "fast"),
        contents: prompt,
        config: { thinkingConfig: { thinkingLevel: "LOW" as never } },
      }),
    );
    const html = stripFences(res.text ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "");
    return Response.json({ html });
  } catch (e) {
    return Response.json({ error: friendlyError(e) }, { status: 500 });
  }
}
