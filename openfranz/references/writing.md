# Writing: grounded hooks, scripts, CTAs, captions, and plans

Read this before writing any creative deliverable. The standard is not "a fast draft". The standard is a careful researcher and writer who uses the library as evidence.

## The standard

- A good answer usually takes several searches, several full reads, and a clear plan.
- Do not stop after one search. Do not write until you have something specific to say.
- The library is the evidence. The brand file is the factual grounding. The user's brief is the constraint.
- If the library has no relevant material, say "No library match for this" in one line and write from first principles. Do not silently skip the pass.

## Workflow

Follow these phases in order for every content request. Do not skip a phase because the request looks simple.

### 1. Read the brief

Before touching a tool, identify:

- the deliverable: hook, script, post, caption, CTA, strategy, rewrite, or plan;
- the brand and product;
- the audience;
- the platform and format;
- the goal: reach, trust, conversion, or retention;
- the length or timing;
- any hard constraint the user gave.

If the brief is missing something that would materially change the answer, ask up to three focused questions before writing. Ask about the audience, the platform, the goal, or the product fact you need. Do not ask questions you can answer from the brand file or the library.

If the user says "just do it", "you decide", or gives a complete brief, state your assumptions in one short line and continue. Do not ask for permission to proceed.

A message that starts with `[[deep]]` is a Deep mode request. See the Deep mode section below.

### 2. Research the library

This phase is mandatory and must produce evidence, not a single search result.

1. If a brand is named, read `brands/<slug>.md` first. Use the stored audience, products, tone, and proof points.
2. Search the library at least twice with different angles:
   - once with `--root arsenal` for hooks, lines, structures, and visual moves;
   - once with `--root knowledge` for psychology, strategy, and audience insight.
3. Read at least three files in full, and up to five when the topic is broad.
4. Use `library_search.mjs` to find adjacent material and `library_search.mjs related` to follow links from the best file. Follow at least one link hop.
5. If the answer depends on current facts, use web search and read at least two primary sources. Do not rely on snippets.

Do not start writing until you can name at least three concrete pieces of evidence: a specific hook or line, a structure or format, and a psychological or strategic mechanism.

A good answer usually uses at least five tool calls. If you have made fewer than five, you are probably guessing. Keep researching until the evidence is specific enough to change what you would write.

### 3. Plan before writing

Write a short plan for yourself before the first sentence:

- the three angles, one per variant;
- the mechanism that makes each angle work;
- the evidence you will use for each;
- the structure and timing.

For a complex request (strategy, multi-part deliverable, new brand, or a request with several constraints), show the plan to the user and ask for confirmation before writing the full deliverable. A slower, better answer is the goal.

For a simple request, keep the plan internal and proceed. Do not show a generic outline.

### 4. Write the deliverable

Lead with the deliverable. The first line should be the first variant, not a preamble.

- Always give three variants for a creative deliverable: three hooks, three scripts, three CTAs, three captions, or three rewrites. Each variant must take a different angle, not reword the same idea.
- After each variant, add one short line naming the mechanism that makes it work.
- Be specific. Name the mechanism, the audience, the product fact, or the number that makes the advice work.
- Be concise. Cut every sentence that does not change what the user would write or do.
- Never invent facts about the project, a brand, a product, or a source. If you do not know, say what is missing.
- Do not use emojis. Do not use hype words such as "game-changer", "unlock", "dive into", or "in today's fast-paced world".
- Do not pad with generic advice. "Be authentic" and "provide value" are not answers.

### 5. Self-check before sending

- Did you search the library at least twice, with different angles?
- Did you read at least three library files in full?
- Does each variant use a specific piece of evidence?
- Are there exactly three variants, each with a different angle?
- Does the first line deliver the thing the user asked for?
- Is every claim supported by the library, the brand file, a web source, or the user's message?
- For each script variant, can you name the exact brand fact it leans on? If not, rewrite it.
- Did you use the brand's actual products and audience?
- Is the format readable in chat, with no tables for scripts?
- If you wrote a script, is it inside one closed `script` fence with the beats one per line?
- If this was a content plan, did you read the active strategy first and stay inside its cadence, platforms, and constraints?
- Did you claim anything was saved that you did not save with `save_script.mjs` or `plan.mjs`?
- Is there a `Library:` line naming the files you used?
- If the message had `[[deep]]`, did you ask the questions before writing?
- Is there any sentence that could appear in any other answer? Cut it.

## Deep mode

A message may start with `[[deep]]`. When it does, the user has asked for the deeper workflow. Do not write the deliverable in the same turn.

1. Read the brief and the brand file first.
2. Ask 3 to 5 focused questions that close the gaps that would change the answer. Cover the audience, the platform and format, the goal, the product facts, the constraints, the examples the user likes, and how success will be measured. Ask only what you cannot answer from the brand file or the library.
3. Number the questions and keep each one to a single line. Offer the concrete options you see instead of asking a vague question. For example, "Is this a 30-second reel or a 60-second one?" is better than "What length?".
4. Stop after the questions. Do not include a draft, an outline, or a "here is a starting point" section.
5. When the user answers, treat the answers as the missing context. If gaps remain, ask a short follow-up. Only write the deliverable when the brief is complete.
6. Then run the full research phase and write the three variants in the normal format.

If the user says "just do it" or answers only some questions, state the assumptions you are making and proceed. Do not keep asking once the user has given you enough.

## Deliverable formats

Every creative request gets three variants. Use these shapes unless the user asks for something else.

- **Hooks:** three options. One line each, then a short note on why it works.
- **Scripts:** three shot-by-shot variants inside one `script` fence. Do not use a table. For each variant use a heading, then a short block:
  - **Angle:** one line naming the opening move.
  - **Beats:** a list of timing beats. Each beat is one line in the form `0-2s | on-screen: ... | spoken: ... | visual: ...`.
  - **Why it works:** one line naming the mechanism.
- **CTAs:** three options. Name the action and the reason someone would take it.
- **Captions and posts:** three variants. One short, one story-led, one proof-led.
- **Strategy:** a decision, the reasoning, and the next step. Do not give an option list without a recommendation.
- **Rewrites:** three before-and-after variants, then one sentence on what changed.

Tables are not allowed for scripts, captions, or any long-form deliverable. They are hard to read in chat and on mobile. Use headings, short paragraphs, and one-line beats.

## Script cards

When the deliverable is a script, put the whole thing inside a `script` fence. The chat and the script library render it as a designed card instead of plain Markdown, so the formatting rules matter:

````markdown
```script title="Cold brew launch reel" brand="Acme Coffee"
### Variant A - the contrast open
**Angle:** open on the problem, not the product.
0-2s | on-screen: black screen, white text | spoken: "Your cold brew is watered down" | visual: none
3-6s | on-screen: slow pour macro | spoken: "This one steeps for 18 hours" | visual: condensation
**Why it works:** the admission of a shared frustration buys the first three seconds.

### Variant B - ...
```
````

- The fence starts with `script title="..." brand="..."`. Keep the title short and specific. Omit `brand` when there is none.
- Keep every variant inside the same fence so the card holds the full deliverable.
- One beat per line, in the exact form `0-2s | on-screen: ... | spoken: ... | visual: ...`.
- The separator right after the timing is a pipe, never a colon. Colons belong inside the labels (`on-screen:`), not after the timing.
- Never put another triple-backtick fence inside the script fence.
- Close the fence. An unclosed fence breaks the card.

### Grounding a script

A script dramatizes the problem; it does not add product facts. Before writing a beat, list what the brand file actually states. Every on-screen and spoken line must trace to one of those facts, to the library, or to the brief.

- If the brand file says only "a better mail inbox powered with AI", the script may show an inbox, contrast clutter with calm, and name the product. It may not add "one-click connect", "manage every app in one place", "one address across your apps", or any other capability the file does not state.
- When the record is thin, write around the gap with the problem, the promise, and the audience. Do not fill the gap with plausible features.
- In the `**Why it works:**` line, name the exact brand fact the variant leans on. If you cannot name one, the variant is invented and must be rewritten.

## Saving scripts

The script library is a separate store from the library filesystem. It holds finished scripts with full version history.

- Use `save_script.mjs` when the user asks to save, keep, or store a script, or when they ask you to revise one that is already saved.
- Pass the same Markdown that appeared inside the script card.
- To add a version to an existing script, pass `--id-or-slug`. Call `save_script.mjs list` first if you need to find it.
- Never claim a script was saved unless the command returned a version.

`save_script.mjs` validates the script before writing: one `script` fence with a title, exactly three variants, an `**Angle:**` line, at least three beats per variant in the exact format, and a `**Why it works:**` line. Use `--no-validate` only for an older script that predates this contract.

```bash
"$OPENFRANZ_SKILL/scripts/validate_script.mjs" /tmp/script.md
```

```bash
"$OPENFRANZ_SKILL/scripts/save_script.mjs" \
  --workspace "$OPENFRANZ_WORKSPACE" \
  --title "Cold brew launch reel" \
  --brand "acme-coffee" \
  --content-file /tmp/script.md \
  --note "Tighter first three seconds"
```

## Content planning

The user may ask what to post, when to post it, which days to post on, or for a content plan. The plan lives in `plans/plan.json`, separate from the library. A plan is only as good as the strategy behind it: read the active strategy first, plan inside it, and say so when a request fights it.

1. Read the active strategy in `strategies/`. It sets the cadence, the platforms, the priorities, and the constraints. If no strategy is active, ask the user how they want to plan, then save it before scheduling anything.
2. List the existing plan so you know what is already scheduled and do not double-book a day.
3. Research before proposing dates:
   - search the library for posting psychology, cadence, or audience attention;
   - use web search and read at least one source when the best days or times for the platform matter. Do not invent engagement data or made-up statistics.
4. Propose the plan in chat first: each item with its day, platform, format, and a one-line rationale naming the mechanism or source, and where the strategy shaped the choice. Then save it.
5. Save each item with `plan.mjs add` when the user agrees, or right away when they asked you to build the plan. Use real dates in `YYYY-MM-DD` form.
6. When the item delivers a script from the library, pass its id with `--script-id`.
7. `plan.mjs update` can move a date or change the format.

When the user asks "what is my content plan", read the active strategy and list the plan, then summarize both: the strategy the plan follows, then the items grouped by week with the platform and format, flagging gaps where nothing is scheduled.

## The library pass

For every content request, gather library material before writing. This is not optional.

1. Search with the user's topic and the technique you intend to use.
2. If the result is thin, search again with a second angle, or read the best match in full.
3. Use at least one specific line, structure, or mechanism from the library in the deliverable. Adapt it to the user's brand and topic. Do not dump it.
4. End the answer with a `Library:` line naming the files you actually used.

If the library has no relevant material, say "No library match for this" in one line and write from first principles. Do not silently skip the pass.

Do not write to the library unless the user asks you to save something. When they do, use the same shape as ingestion: title, source, evidence, application, related links.

## Brands

- A brand file lives at `brands/<slug>.md`. It contains the name, slug, summary, website, audience, tone, products with features and pricing, and notes.
- When the user mentions a brand or product by name, read the file before answering so the copy matches the stored product facts.
- A user message may start with a marker like `[[brand:acme-coffee|Acme Coffee]]` or `[[brand:acme-coffee|Acme Coffee|Cold Brew]]`. The third segment is the product the user chose. When it is present, use that product's description, features, and pricing. When it is absent, use the brand-level facts and ask which product if the answer depends on it.
- Never invent a product, price, feature, or audience detail that is not in the brand file. If the record is incomplete, say which field is missing.
- Only update a brand file when the user explicitly asks to save or change brand information.

## Web research

- Use web search to find current information, then read the page in full.
- Cite the URLs you used when an answer depends on them.
- Prefer primary sources over aggregators.
- Do not present a search snippet as a verified fact. Read the page first.

## Instagram

- Ingestion is a separate step, not a chat action. If the user wants to add a post to the library, point them to the ingest command or run it.
- Only public content is supported. Private posts, stories, and profiles are rejected.
- Do not claim to have downloaded or analyzed media unless the ingest produced a context file and you actually read it.

## Worked example

Brief: "Write three hooks for a cold brew launch reel for Acme Coffee."

Research:

- Read `brands/acme-coffee.md`: audience is home coffee drinkers, tone is dry and practical, product is an 18-hour steep.
- Search `/arsenal` for "contrast hook" and "admission hook".
- Search `/knowledge` for "curiosity gap" and "shared frustration".
- Read three files: a contrast-hook example, a curiosity-gap note, and a language-bank entry for opening lines.

Output:

```text
1. "Your cold brew is watered down. This one steeps for 18 hours."
   Mechanism: a shared failure followed by a specific number.

2. "I stopped buying cold brew after I learned what 18 hours does."
   Mechanism: a personal change of behaviour creates a curiosity gap.

3. "The first sip is the test. Most cold brew fails it."
   Mechanism: a concrete sensory test the viewer can run immediately.

Library: /arsenal/hooks-attention/contrast-hook.md, /knowledge/psychology-attention/curiosity-gap.md, /arsenal/language-bank/opening-lines.md
```

Each variant uses a different mechanism. None of them invent a product fact. The `Library:` line names the evidence.
