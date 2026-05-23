---
title: openpriya
subtitle: how we taught a real-time STT model to spell proper names without retraining it.
date: 2026-05-24
excerpt: OpenAI's gpt-realtime-whisper kept fusing "open priya" into "openpriya". We couldn't pass a vocabulary to the model, so we built one client-side. Here's how that engine works and why hardcoding rules was the wrong move.
tags: [stt, vocab, engine, ml]
ogImage: /og-openpriya.png
---

So here's the problem.

We're building Zyren, a voice-driven radiology reporting tool. A doctor sits down, hits a mic button, says **open priya**, and the case for Priya Nambiar opens up. The kind of thing you'd assume just works in 2026.

It does not.

OpenAI's brand-new `gpt-realtime-whisper` (released this month) runs in our hot path doing real-time speech-to-text. The latency is fantastic. The general accuracy is fantastic. The way it handles **an uncommon verb immediately followed by an unusual proper noun** is not fantastic.

What the model emits when you say *"open priya"*:

```
openpriya
```

One token. No space. Because in its training corpus, "open" rarely precedes "Priya", so it just... fuses them. Sometimes you also get `openmarkus`, `casemarcus`, `showmepriya`, `gotomarcus`. Worse: when you say *"signed it"* instead of *"sign it"*, the regex bank that classifies intent doesn't recognize the past tense. So "signed it" becomes a **finding**, like the radiologist literally found "signed it" inside the patient's chest.

Cool. Cool cool cool.

## the thing OpenAI doesn't let you do

You can't pass a custom vocabulary to `gpt-realtime-whisper`. The Realtime API supports zero hotwording. Whisper itself accepts a `prompt` parameter via the HTTP endpoint, but the streaming WebSocket flavor doesn't. There is no knob.

So we had to fix it client-side. Post-processing the model's output as it streams. Every delta. Sub-50ms budget.

## attempt one: just write some rules

First instinct: when we see `openpriya`, split it. Hardcode a regex:

```ts
const PREFIX_RE = /^(open|case|find|sign|next|...)([a-z]{2,})$/i
```

That handles the simplest fusion. Then I added `BIGRAM_PREFIXES` for the multi-word ones:

```ts
const BIGRAM_PREFIXES = {
  showme: 'show me',
  goto: 'go to',
  pullup: 'pull up',
  // ...19 more
}
```

And `morphologicalStem` to handle past tense:

```ts
function morphologicalStem(token: string): string | null {
  if (token.endsWith('ing')) return token.slice(0, -3)
  if (token.endsWith('ed'))  return token.slice(0, -2)
  if (token.endsWith('es'))  return token.slice(0, -2)
  // ...
}
```

It worked. For the cases I'd thought of.

Then I caught myself. There were three hardcoded lists growing in parallel. Every new failure mode would need another rule. Six months in, nobody would remember why `openpriyam` doesn't split. This was the wrong shape.

## the actual insight

**The vocabulary IS the engine.**

You don't need a bigram lookup table if the vocab already contains `go` and `to` and `show` and `me` as speakable elements. You don't need a stemmer if the similarity score already recognizes that `sign` is a prefix of `signed`.

So I ripped all of it out. Replaced it with three primitives.

### 1. word-segmentation DP

Take a fused token. Try every split. For each split, ask the vocab whether each piece matches. Pick the segmentation that scores highest:

```
openpriya     → "open" + "priya"           (both exact matches)
signit        → "sign" + "it"              (both exact)
showmepriya   → "show" + "me" + "priya"    (three-piece, all exact)
gotomarcus    → "go" + "to" + "marcus"     (three-piece)
openmarkus    → "open" + "markus"          → "markus" fuzzy-matches "marcus"
```

The vocab is the dictionary. Adding a new vocab item (a new patient, a new button on screen) automatically enables new fusion patterns. Zero code changes.

### 2. prefix-containment in the similarity score

For morphology (`signed → sign`, `opening → open`, `pri → priya`), I added exactly one branch to the composite-similarity function:

```ts
function compositeScore(query: string, candidate: string): number {
  const minLen = Math.min(query.length, candidate.length)
  const maxLen = Math.max(query.length, candidate.length)
  if (minLen >= 3 && maxLen / minLen <= 2) {
    if (query.startsWith(candidate) || candidate.startsWith(query)) {
      return 0.92 + 0.07 * (minLen / maxLen)
    }
  }
  // ...fall through to phonetic + Levenshtein
}
```

`signed` and `sign` score 0.95 because "sign" is a prefix of "signed". Same code path catches `opening → open` (0.95), `pri → priya` (0.9). No suffix table. No verb list. Just: **one token is a prefix of the other and the lengths are close enough**.

### 3. beam search with intent disambiguation

The hardest case: *"finding marcus"*. The vocab has both:
- `findings`: a section title in the active template (weight-boosted to 1.18)
- `find`: a command verb (weight 1.0)

A greedy per-token matcher picks `findings`. The rewrite becomes `findings marcus`, which still classifies as a finding. Nothing happens.

Engine fix: enumerate the top-K vocab matches per token. Try every combination. Pick the one whose joined text classifies as the strongest actionable intent.

```
finding marcus
  → combo A: "findings marcus" → finding (default)         [not actionable]
  → combo B: "find marcus"     → navigation                 [actionable ✓]
```

Navigation wins. We picked `find` over `findings` without ever telling the engine that commands beat sections. **The classifier is the disambiguator.**

## the safety net

The scariest thing about auto-rewriting STT is the inverse direction: rewriting a *finding* into a command. *"Marcus has aneurysm"* → some clever score makes us think the radiologist said *"open marcus"* and we silently throw away "has aneurysm". Doctor signs the report. Hospital sues us. Etc.

Three gates protect dictation:

1. **`FINDING_MARKERS_RE`**: a regex over anatomy, measurements, laterality, common medical adjectives. If any of these appear in the chunk, we refuse to rewrite. *"marcus has aneurysm"* trips the gate on "aneurysm" → no change.
2. **5-token cap**: commands are short, dictation is long. Anything > 5 tokens is dictation by definition.
3. **Intent-gain requirement**: a rewrite only sticks if the *output* classifies as actionable (command / navigation / session-switch). If the rewrite makes the text *more* like a finding, we throw it away.

I wrote a property-based test that takes real radiology dictation strings, randomly mutates them (caps, punctuation, dropped letters, doubled letters), and asserts the corrector NEVER turns them into a command. 200 mutations. Zero false rewrites.

## three tiers

The local engine catches ~90% of real failures. For the rest, two more layers fire on commit, outside the per-delta hot path, so they get to be slower.

**Warm path**: OpenAI's `text-embedding-3-small` against pre-cached intent templates. Catches paraphrases the local engine can't reach phonetically: *"give me marcus"* ≈ *"open marcus"*, *"I'm done with this one"* ≈ *"sign it"*. One embed call per utterance, ~200ms. Cheap.

**Cold path**: `gpt-4o-mini` as a fallback for anything the warm path can't resolve. Already existed. The improvement: the prompt now includes the current vocab as context, so the model sees *"Patient names: Marcus, Priya, Lin, …"* and *"Commands: sign, generate, next, …"* and routes accordingly. Same model, way better behaviour.

## the numbers

```
$ pnpm test:corrector

vocab: 137 entries, 123 phonetic codes

Group 1: fused / morph / phonetic positives    ✓
Group 2: canonical commands                    ✓
Group 3: findings / safety negatives           ✓
Group 4: STT artefacts                         ✓
Group 5: 200 randomized finding mutations      ✓
Group 6: navigation under clean vocab          ✓

Total: 273 passed, 0 failed
```

~1ms per chunk in the hot path. Zero false rewrites on dictated findings. Past tense, fused commands, phonetic typos, paraphrases. All resolved.

## the lesson

The hardcoded approach felt productive at first. Each new failure mode just needed another rule! But each rule competes with the others. Each one is a thing you have to *remember exists* to debug a regression. The complexity grows quadratically.

The vocab-driven approach is harder to *write* but trivial to *extend*. New button on the UI? It's already in the vocab via the DOM crawler. New patient name? Picked up by the data-source walker. New command? Add it to one list, the engine figures out segmentation and morphology automatically.

This is the lesson I keep relearning: **make the data speak for itself, then build a small engine around it**. Stop writing rules.

The Zyren commit is [magdyf/Zyren@826d507](https://github.com/magdyf/Zyren/commit/826d507) if you want to see the wiring.

irdi
