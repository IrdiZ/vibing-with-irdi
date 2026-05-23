// Viral LinkedIn caption generator. Takes the article markdown + URL,
// returns a punchy first-person LinkedIn post in irdi's voice.
//
// Uses Claude (claude-sonnet-4-6) — better at the casual-but-credible
// engineer tone than gpt-4o-mini for this kind of writing.

import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are writing a LinkedIn post for irdi, a software engineer building voice AI for radiology. The post links to one of his articles.

Constraints (non-negotiable):
- First person. irdi wrote the article.
- 130-220 words. LinkedIn truncates after ~200 chars in the feed, so the first 1-2 lines MUST be a hook that makes a scroller stop.
- Engineer voice: direct, no hype words ("game-changing", "revolutionize", "leveraging"). No emojis. No corporate filler.
- Reference 1-2 specific technical details from the article (a concrete number, a name, a particular insight). Generic posts get ignored.
- Plain text only. Single line breaks between paragraphs. No markdown.
- End with the article URL on its own line.
- Optionally 2-3 lowercase hashtags at the very end, one space apart. Skip if they'd feel forced.
- NEVER use em dashes (—). Use commas, periods, or colons instead. This is a hard rule.
- Don't repeat the title verbatim in the hook. Reframe it.

Structure suggestion:
  [hook — 1-2 sentences that grab attention]
  [the problem in 2-3 sentences]
  [the insight or the resolution in 2-3 sentences]
  [the takeaway, 1 sentence]
  [URL]
  [optional 2-3 lowercase hashtags]

Output only the post text. No quotes, no preamble, no explanation.`

export type ViralCaptionInput = {
  title: string
  excerpt: string
  bodyMarkdown: string
  url: string
}

export async function generateViralCaption(input: ViralCaptionInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing env: ANTHROPIC_API_KEY')
  const client = new Anthropic({ apiKey })
  const userMessage =
    `Article title: ${input.title}\n\n` +
    `Article excerpt: ${input.excerpt}\n\n` +
    `Article URL: ${input.url}\n\n` +
    `Article body (markdown):\n\n${input.bodyMarkdown}`
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })
  // Concatenate all text blocks. Strip any stray em dashes Claude slipped in.
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
  return text.replace(/—/g, ',')
}
